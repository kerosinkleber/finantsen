import { eq, inArray, sql } from "drizzle-orm";
import { getDb } from "../db";
import { groupMembers, groups, users } from "../schema";
import { requireMember } from "./access";
import { loadExpenses } from "./expenses";
import { loadPayments } from "./payments";
import { groupBalances } from "./balances";
import { minorUnits } from "@/lib/money";
import { decimal, toCsv } from "@/lib/csv";
import { translate, type Locale } from "@/i18n";

/** Anzeigenamen inkl. Kennzeichnung für Test- und Gastkonten. */
async function namesOf(ids: string[], locale: Locale = "de") {
  if (ids.length === 0) return new Map<string, string>();
  const rows = await getDb()
    .select({
      id: users.id,
      name: sql<string>`case when ${users.kind} = 'test' then ${users.name} || ' (Test)' when ${users.kind} = 'guest' then ${users.name} || ${' (' + translate(locale, "guest.label") + ')'} else ${users.name} end`,
    })
    .from(users)
    .where(inArray(users.id, ids));
  return new Map(rows.map((r) => [r.id, r.name]));
}

/**
 * CSV einer Gruppe: eine Zeile je Ausgabe und Zahlung, je Person die Spalten „bezahlt“ und „Anteil“ in der
 * Abrechnungswährung, am Ende eine Saldo-Zeile je Währung. Trennzeichen und Dezimalkomma passend zur Sprache.
 */
export async function groupCsv(userId: string, groupId: string, locale: Locale) {
  const { group } = await requireMember(userId, groupId);
  const sep = locale === "de" ? ";" : ",";
  const t = (k: Parameters<typeof translate>[1], p?: Record<string, string | number>) => translate(locale, k, p);
  const [exps, pays, bal, members] = await Promise.all([
    loadExpenses(groupId),
    loadPayments(groupId),
    groupBalances(groupId),
    getDb().select({ id: groupMembers.userId }).from(groupMembers).where(eq(groupMembers.groupId, groupId)),
  ]);
  const ids = new Set(members.map((m) => m.id));
  for (const e of exps) [...e.payers, ...e.shares].forEach((x) => ids.add(x.userId));
  for (const p of pays) [p.fromUser, p.toUser].forEach((x) => ids.add(x));
  const names = await namesOf([...ids], locale);
  const people = [...ids].sort((a, b) => (names.get(a) ?? "").localeCompare(names.get(b) ?? "", locale));
  const money = (m: number, cur: string) => decimal(m, minorUnits(cur), sep);

  const header = [
    t("export.type"), t("export.date"), t("export.title"), t("export.category"), t("export.amount"), t("export.currency"),
    t("export.baseAmount"), t("export.baseCurrency"),
    ...people.flatMap((p) => [t("export.paid", { name: names.get(p) ?? "?" }), t("export.share", { name: names.get(p) ?? "?" })]),
  ];
  type Row = { date: string; cells: (string | number)[] };
  const rows: Row[] = [];
  for (const e of exps) {
    const cur = e.baseCurrency;
    rows.push({
      date: e.date,
      cells: [
        t("export.expense"), e.date, e.title, translate(locale, `cat.${e.category}` as never), money(e.amountMinor, e.currency), e.currency,
        money(e.baseAmountMinor, cur), cur,
        ...people.flatMap((p) => {
          const paid = e.payers.find((x) => x.userId === p)?.baseAmountMinor ?? 0;
          const share = e.shares.find((x) => x.userId === p)?.baseAmountMinor ?? 0;
          return [paid ? money(paid, cur) : "", share ? money(share, cur) : ""];
        }),
      ],
    });
  }
  for (const p of pays) {
    rows.push({
      date: p.date,
      cells: [
        t("export.payment"), p.date, p.note ?? `${names.get(p.fromUser) ?? "?"} → ${names.get(p.toUser) ?? "?"}`, "", money(p.amountMinor, p.currency), p.currency,
        money(p.amountMinor, p.currency), p.currency,
        // Zahlung: der Zahlende „bezahlt“, der Empfänger „bekommt“ (zählt wie ein Anteil)
        ...people.flatMap((u) => [u === p.fromUser ? money(p.amountMinor, p.currency) : "", u === p.toUser ? money(p.amountMinor, p.currency) : ""]),
      ],
    });
  }
  rows.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  const balanceRows = Object.entries(bal.net).map(([cur, m]) => [
    t("export.balance"), "", "", "", "", "", "", cur,
    ...people.flatMap((p) => [money(m[p] ?? 0, cur), ""]),
  ]);
  const csv = toCsv([header, ...rows.map((r) => r.cells), ...balanceRows], sep);
  const safe = group.name.replace(/[^\p{L}\p{N}_-]+/gu, "-").replace(/^-+|-+$/g, "").slice(0, 50) || "gruppe";
  return { csv, filename: `finantsen-${group.kind === "direct" ? "freund" : safe}-${new Date().toISOString().slice(0, 10)}.csv` };
}

/** Alle eigenen Daten als JSON (Profil ohne Geheimnisse, Gruppen mit Ausgaben, Zahlungen und Salden). */
export async function accountExport(userId: string) {
  const db = getDb();
  const [u] = await db.select().from(users).where(eq(users.id, userId));
  const mine = await db
    .select({ group: groups, role: groupMembers.role, archivedAt: groupMembers.archivedAt })
    .from(groupMembers)
    .innerJoin(groups, eq(groups.id, groupMembers.groupId))
    .where(eq(groupMembers.userId, userId));
  const out = [];
  for (const { group, role, archivedAt } of mine) {
    const [exps, pays, bal, mem] = await Promise.all([
      loadExpenses(group.id),
      loadPayments(group.id),
      groupBalances(group.id),
      db.select({ id: groupMembers.userId, role: groupMembers.role }).from(groupMembers).where(eq(groupMembers.groupId, group.id)),
    ]);
    const names = await namesOf([...new Set([...mem.map((m) => m.id), ...exps.flatMap((e) => [...e.payers, ...e.shares].map((x) => x.userId)), ...pays.flatMap((p) => [p.fromUser, p.toUser])])]);
    out.push({
      id: group.id,
      name: group.name,
      kind: group.kind,
      defaultCurrency: group.defaultCurrency,
      myRole: role,
      archived: !!archivedAt,
      members: mem.map((m) => ({ id: m.id, name: names.get(m.id) ?? "?", role: m.role })),
      people: Object.fromEntries(names),
      expenses: exps.map((e) => ({
        id: e.id, date: e.date, title: e.title, category: e.category, amountMinor: e.amountMinor, currency: e.currency,
        baseAmountMinor: e.baseAmountMinor, baseCurrency: e.baseCurrency, rate: e.rate, rateSource: e.rateSource,
        splitType: e.splitType, items: e.items, recurringId: e.recurringId, createdBy: e.createdBy,
        payers: e.payers, shares: e.shares.map((s) => ({ userId: s.userId, amountMinor: s.amountMinor, baseAmountMinor: s.baseAmountMinor })),
      })),
      payments: pays.map((p) => ({ id: p.id, date: p.date, fromUser: p.fromUser, toUser: p.toUser, amountMinor: p.amountMinor, currency: p.currency, note: p.note })),
      balances: bal.net,
    });
  }
  return {
    format: "finantsen-export/1",
    exportedAt: new Date().toISOString(),
    note: "Beträge in Minor-Units (z. B. Cent). Keine Passwörter, TOTP-Geheimnisse oder Passkeys enthalten.",
    user: { id: u.id, username: u.username, name: u.name, email: u.email, locale: u.locale, createdAt: u.createdAt },
    groups: out,
  };
}
