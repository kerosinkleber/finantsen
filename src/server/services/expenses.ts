import { alias } from "drizzle-orm/pg-core";
import { and, desc, eq, exists, gte, ilike, isNotNull, isNull, lte, or, sql, type SQL } from "drizzle-orm";
import { getDb, type Tx } from "../db";
import { expenseHistory, expensePayers, expenseShares, expenses, users } from "../schema";
import { ApiError, notFound } from "../http";
import { computeShares, convertMinor, mainPayer, normalizeRate, rescale, validatePayers, type SplitInput } from "@/lib/money";
import { getRate } from "../rates";
import type { ExpenseBody } from "@/lib/schemas";
import { memberIds, requireMember } from "./access";
import { notifyGroup } from "./notifications";
import { checkBudgetAlert } from "./budget";

export type ExpenseDetail = {
  id: string;
  groupId: string;
  title: string;
  amountMinor: number;
  currency: string;
  date: string;
  category: string;
  splitType: string;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
  baseCurrency: string;
  baseAmountMinor: number;
  /** 1 Einheit `currency` = rate Einheiten `baseCurrency` */
  rate: string;
  rateSource: string;
  items: ItemsData | null;
  /** Gesetzt bei automatischen Buchungen aus einer wiederkehrenden Vorlage */
  recurringId: string | null;
  isRefund: boolean;
  paymentMethod: string | null;
  payers: { userId: string; amountMinor: number; baseAmountMinor: number }[];
  shares: { userId: string; amountMinor: number; baseAmountMinor: number; input: number | null }[];
};

export type ItemsData = {
  items: { name: string; amountMinor: number; participants: string[] }[];
  taxMinor: number;
  tipMinor: number;
};

function toSplitInput(split: ExpenseBody["split"]): SplitInput {
  switch (split.type) {
    case "equal":
      return { type: "equal", participants: split.participants };
    case "percent":
      return { type: "percent", entries: split.entries.map((e) => ({ id: e.userId, bp: e.bp })) };
    case "exact":
      return { type: "exact", entries: split.entries.map((e) => ({ id: e.userId, amount: e.amountMinor })) };
    case "shares":
      return { type: "shares", entries: split.entries.map((e) => ({ id: e.userId, shares: e.shares })) };
    case "adjust":
      return { type: "adjust", entries: split.entries.map((e) => ({ id: e.userId, adjust: e.adjustMinor })) };
    case "full":
      return { type: "full", owner: split.owner };
    case "items":
      return {
        type: "items",
        items: split.items.map((i) => ({ name: i.name, amount: i.amountMinor, participants: i.participants })),
        tax: split.taxMinor,
        tip: split.tipMinor,
      };
  }
}

function rawInput(split: ExpenseBody["split"]): Map<string, number> {
  const m = new Map<string, number>();
  if (split.type === "percent") split.entries.forEach((e) => m.set(e.userId, e.bp));
  if (split.type === "exact") split.entries.forEach((e) => m.set(e.userId, e.amountMinor));
  if (split.type === "shares") split.entries.forEach((e) => m.set(e.userId, e.shares));
  if (split.type === "adjust") split.entries.forEach((e) => m.set(e.userId, e.adjustMinor));
  return m;
}

async function hydrate(rows: (typeof expenses.$inferSelect)[]): Promise<ExpenseDetail[]> {
  if (!rows.length) return [];
  const db = getDb();
  const ids = rows.map((r) => r.id);
  // Ein Array-Parameter statt einer IN-Liste: keine Grenze bei 65 535 Parametern, ein vorbereitbares Statement
  const idArray = sql`${sql.param(ids)}::uuid[]`;
  const [payers, shares] = await Promise.all([
    db.select().from(expensePayers).where(sql`${expensePayers.expenseId} = any(${idArray})`),
    db.select().from(expenseShares).where(sql`${expenseShares.expenseId} = any(${idArray})`),
  ]);
  // Einmal gruppieren (linear); vorher wurde je Ausgabe die ganze Liste gefiltert (quadratisch)
  const byExpense = <T extends { expenseId: string }>(list: T[]) => {
    const m = new Map<string, T[]>();
    for (const x of list) {
      const a = m.get(x.expenseId);
      if (a) a.push(x);
      else m.set(x.expenseId, [x]);
    }
    return m;
  };
  const payersOf = byExpense(payers);
  const sharesOf = byExpense(shares);
  return rows.map((r) => ({
    id: r.id,
    groupId: r.groupId,
    title: r.title,
    amountMinor: r.amountMinor,
    currency: r.currency,
    date: r.date,
    category: r.category,
    splitType: r.splitType,
    createdBy: r.createdBy,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
    deletedAt: r.deletedAt,
    baseCurrency: r.baseCurrency,
    baseAmountMinor: r.baseAmountMinor,
    rate: r.rate,
    rateSource: r.rateSource,
    items: (r.items as ItemsData | null) ?? null,
    recurringId: r.recurringId,
    isRefund: r.isRefund,
    paymentMethod: r.paymentMethod,
    payers: (payersOf.get(r.id) ?? []).map((p) => ({ userId: p.userId, amountMinor: p.amountMinor, baseAmountMinor: p.baseAmountMinor })),
    shares: (sharesOf.get(r.id) ?? []).map((s) => ({ userId: s.userId, amountMinor: s.amountMinor, baseAmountMinor: s.baseAmountMinor, input: s.input })),
  }));
}

export type ExpenseFilter = {
  q?: string;
  minMinor?: number;
  maxMinor?: number;
  /** Währung, in der min/max gelten; verglichen wird nur mit Ausgaben dieser Abrechnungswährung */
  amountCurrency?: string;
  from?: string;
  to?: string;
  category?: string;
  /** Nutzer, der Zahler oder Anteilsträger sein muss */
  person?: string;
  paymentMethod?: string;
};

export async function listExpenses(
  userId: string,
  groupId: string,
  opts: LoadOpts = {},
) {
  await requireMember(userId, groupId);
  return loadExpenses(groupId, opts);
}

type LoadOpts = { includeDeleted?: boolean; onlyDeleted?: boolean; filter?: ExpenseFilter; limit?: number; ids?: string[] };

function expenseConds(groupId: string, opts: LoadOpts): (SQL | undefined)[] {
  const f = opts.filter ?? {};
  const conds: (SQL | undefined)[] = [eq(expenses.groupId, groupId)];
  if (opts.ids) conds.push(sql`${expenses.id} = any(${sql.param(opts.ids)}::uuid[])`);
  if (opts.onlyDeleted) conds.push(isNotNull(expenses.deletedAt));
  else if (!opts.includeDeleted) conds.push(isNull(expenses.deletedAt));
  if (f.q) conds.push(ilike(expenses.title, `%${f.q.replace(/[\\%_]/g, (c) => "\\" + c)}%`));
  // Minor-Units sind nur innerhalb einer Währung vergleichbar (z. B. nach Wechsel der Gruppenwährung)
  if ((f.minMinor !== undefined || f.maxMinor !== undefined) && f.amountCurrency) conds.push(eq(expenses.baseCurrency, f.amountCurrency));
  if (f.minMinor !== undefined) conds.push(gte(expenses.baseAmountMinor, f.minMinor));
  if (f.maxMinor !== undefined) conds.push(lte(expenses.baseAmountMinor, f.maxMinor));
  if (f.from) conds.push(gte(expenses.date, f.from));
  if (f.to) conds.push(lte(expenses.date, f.to));
  if (f.category) conds.push(eq(expenses.category, f.category));
  if (f.paymentMethod) conds.push(eq(expenses.paymentMethod, f.paymentMethod));
  if (f.person) {
    const db = getDb();
    conds.push(
      or(
        exists(db.select({ x: expensePayers.userId }).from(expensePayers).where(and(eq(expensePayers.expenseId, expenses.id), eq(expensePayers.userId, f.person)))),
        exists(db.select({ x: expenseShares.userId }).from(expenseShares).where(and(eq(expenseShares.expenseId, expenses.id), eq(expenseShares.userId, f.person)))),
      ),
    );
  }
  return conds;
}

/** `limit`: nur die neuesten n Ausgaben; `ids`: nur diese (Seite der Gruppenliste). Salden/Statistik/Export laden immer alles. */
export async function loadExpenses(groupId: string, opts: LoadOpts = {}) {
  const rows = await getDb()
    .select()
    .from(expenses)
    .where(and(...expenseConds(groupId, opts)))
    .orderBy(desc(expenses.date), desc(expenses.createdAt), desc(expenses.id))
    .limit(opts.limit ?? 1_000_000_000);
  return hydrate(rows);
}

/**
 * Nur Sortierschlüssel (ID, Datum, Anlagezeit) der neuesten `limit` Ausgaben plus die Gesamtzahl: Grundlage für das
 * Blättern in der Gruppenliste, ohne Zahler/Anteile aller Ausgaben zu laden.
 */
export async function listExpenseKeys(userId: string, groupId: string, opts: { filter?: ExpenseFilter; limit: number }) {
  await requireMember(userId, groupId);
  const where = and(...expenseConds(groupId, { filter: opts.filter }));
  const [keys, [{ n }]] = await Promise.all([
    getDb()
      .select({ id: expenses.id, date: expenses.date, createdAt: expenses.createdAt })
      .from(expenses)
      .where(where)
      .orderBy(desc(expenses.date), desc(expenses.createdAt), desc(expenses.id))
      .limit(opts.limit),
    getDb().select({ n: sql<number>`count(*)::int` }).from(expenses).where(where),
  ]);
  return { keys, total: n };
}

export async function getExpense(userId: string, groupId: string, expenseId: string): Promise<ExpenseDetail> {
  await requireMember(userId, groupId);
  if (!/^[0-9a-f-]{36}$/i.test(expenseId)) throw notFound();
  const rows = await getDb()
    .select()
    .from(expenses)
    .where(and(eq(expenses.id, expenseId), eq(expenses.groupId, groupId)))
    .limit(1);
  if (!rows[0]) throw notFound();
  return (await hydrate(rows))[0];
}

/** Bestimmt Kurs und Quelle: gleiche Währung = 1, manueller Kurs, wiederverwendeter gespeicherter Kurs oder Anbieter. */
async function resolveRate(
  body: ExpenseBody,
  baseCurrency: string,
  reuse?: { rate: string; rateSource: string; currency: string; date: string; baseCurrency: string },
): Promise<{ rate: string; source: "same" | "provider" | "manual" }> {
  if (body.currency === baseCurrency) return { rate: "1.000000000000000", source: "same" };
  if (body.rate) {
    const r = normalizeRate(body.rate);
    if (!r) throw new ApiError(400, "invalid_rate");
    return { rate: r, source: "manual" };
  }
  if (reuse && reuse.currency === body.currency && reuse.date === body.date && reuse.baseCurrency === baseCurrency && reuse.rateSource !== "same") {
    return { rate: reuse.rate, source: reuse.rateSource === "manual" ? "manual" : "provider" };
  }
  const r = await getRate(body.currency, baseCurrency, body.date);
  return { rate: r.rate, source: "provider" };
}

/** Prüft eine Ausgaben-Vorlage ohne Kurs und ohne zu speichern (Zahler, Aufteilung, Mitgliedschaft). */
export async function validateTemplate(groupId: string, body: Omit<ExpenseBody, "date" | "rate">) {
  const members = new Set(await memberIds(groupId));
  const payerList = body.payers.map((p) => ({ id: p.userId, amount: p.amountMinor })).sort((a, b) => (a.id < b.id ? -1 : 1));
  validatePayers(body.amountMinor, payerList);
  const shares = computeShares(body.amountMinor, toSplitInput(body.split), mainPayer(payerList));
  const involved = [...payerList.map((p) => p.id), ...shares.map((s) => s.id)];
  if (involved.some((u) => !members.has(u))) throw new ApiError(400, "not_a_member");
  return { involved: [...new Set(involved)] };
}

/** Validiert Teilnehmer/Zahler, berechnet Anteile und rechnet alles in die Abrechnungswährung um. */
async function prepare(groupId: string, body: ExpenseBody, baseCurrency: string, reuse?: Parameters<typeof resolveRate>[2]) {
  const members = new Set(await memberIds(groupId));
  const payerList = body.payers.map((p) => ({ id: p.userId, amount: p.amountMinor })).sort((a, b) => (a.id < b.id ? -1 : 1));
  validatePayers(body.amountMinor, payerList);
  const shares = computeShares(body.amountMinor, toSplitInput(body.split), mainPayer(payerList));
  const involved = [...payerList.map((p) => p.id), ...shares.map((s) => s.id)];
  if (involved.some((u) => !members.has(u))) throw new ApiError(400, "not_a_member");
  const { rate, source } = await resolveRate(body, baseCurrency, reuse);
  const baseAmount = convertMinor(body.amountMinor, body.currency, baseCurrency, rate);
  // Anteile und Zahler proportional neu verteilen, damit die Summen exakt dem umgerechneten Betrag entsprechen.
  const basePayers = rescale(baseAmount, payerList.map((x) => x.amount));
  const baseShares = rescale(baseAmount, shares.map((x) => x.amount));
  const itemsData: ItemsData | null =
    body.split.type === "items"
      ? { items: body.split.items, taxMinor: body.split.taxMinor, tipMinor: body.split.tipMinor }
      : null;
  return {
    payerList: payerList.map((x, i) => ({ ...x, base: basePayers[i] })),
    shares: shares.map((x, i) => ({ ...x, base: baseShares[i] })),
    raw: rawInput(body.split),
    rate,
    source,
    baseCurrency,
    baseAmount,
    itemsData,
  };
}

async function writeParts(tx: Tx, expenseId: string, p: Awaited<ReturnType<typeof prepare>>) {
  await tx
    .insert(expensePayers)
    .values(p.payerList.filter((x) => x.amount > 0).map((x) => ({ expenseId, userId: x.id, amountMinor: x.amount, baseAmountMinor: x.base })));
  await tx.insert(expenseShares).values(
    p.shares.map((s) => ({ expenseId, userId: s.id, amountMinor: s.amount, baseAmountMinor: s.base, input: p.raw.get(s.id) ?? null })),
  );
}

function snapshot(e: ExpenseDetail) {
  return {
    title: e.title,
    amountMinor: e.amountMinor,
    currency: e.currency,
    date: e.date,
    category: e.category,
    splitType: e.splitType,
    baseCurrency: e.baseCurrency,
    baseAmountMinor: e.baseAmountMinor,
    rate: e.rate,
    items: e.items,
    isRefund: e.isRefund,
    paymentMethod: e.paymentMethod,
    payers: e.payers,
    shares: e.shares,
    deleted: e.deletedAt !== null,
  };
}

export async function createExpense(
  userId: string,
  groupId: string,
  body: ExpenseBody,
  actedBy: string | null = null,
  opts: { recurringId?: string; /** Import: keine Benachrichtigung je Ausgabe */ silent?: boolean } = {},
) {
  const { group } = await requireMember(userId, groupId);
  const p = await prepare(groupId, body, group.defaultCurrency);
  const id = await getDb().transaction(async (tx) => {
    const [row] = await tx
      .insert(expenses)
      .values({
        groupId,
        title: body.title,
        amountMinor: body.amountMinor,
        currency: body.currency,
        date: body.date,
        category: body.category,
        splitType: body.split.type,
        baseCurrency: p.baseCurrency,
        baseAmountMinor: p.baseAmount,
        rate: p.rate,
        rateSource: p.source,
        items: p.itemsData,
        isRefund: !!body.isRefund,
        paymentMethod: body.paymentMethod ?? null,
        recurringId: opts.recurringId ?? null,
        createdBy: userId,
      })
      .returning();
    await writeParts(tx, row.id, p);
    return row.id;
  });
  const detail = await getExpense(userId, groupId, id);
  await getDb().insert(expenseHistory).values({ expenseId: id, userId, actedBy, action: "create", snapshot: snapshot(detail) });
  if (!opts.silent) await notifyGroup({
    type: "expense_created",
    auto: !!opts.recurringId,
    refund: detail.isRefund,
    groupId,
    expenseId: id,
    actorId: userId,
    title: detail.title,
    amountMinor: detail.amountMinor,
    currency: detail.currency,
  });
  await checkBudgetAlert(groupId);
  return detail;
}

export async function updateExpense(userId: string, groupId: string, expenseId: string, body: ExpenseBody, actedBy: string | null = null) {
  const existing = await getExpense(userId, groupId, expenseId);
  if (existing.deletedAt) throw new ApiError(409, "expense_deleted");
  // Abrechnungswährung bleibt die der Ausgabe, auch wenn die Gruppenwährung inzwischen geändert wurde.
  const p = await prepare(groupId, body, existing.baseCurrency, existing);
  await getDb().transaction(async (tx) => {
    await tx
      .update(expenses)
      .set({
        title: body.title,
        amountMinor: body.amountMinor,
        currency: body.currency,
        date: body.date,
        category: body.category,
        splitType: body.split.type,
        baseAmountMinor: p.baseAmount,
        rate: p.rate,
        rateSource: p.source,
        items: p.itemsData,
        isRefund: !!body.isRefund,
        paymentMethod: body.paymentMethod ?? null,
        updatedAt: new Date(),
      })
      .where(eq(expenses.id, expenseId));
    await tx.delete(expensePayers).where(eq(expensePayers.expenseId, expenseId));
    await tx.delete(expenseShares).where(eq(expenseShares.expenseId, expenseId));
    await writeParts(tx, expenseId, p);
  });
  const detail = await getExpense(userId, groupId, expenseId);
  await getDb().insert(expenseHistory).values({ expenseId, userId, actedBy, action: "update", snapshot: snapshot(detail) });
  await checkBudgetAlert(groupId);
  return detail;
}

export async function deleteExpense(userId: string, groupId: string, expenseId: string, actedBy: string | null = null) {
  const existing = await getExpense(userId, groupId, expenseId);
  if (existing.deletedAt) return;
  await getDb().update(expenses).set({ deletedAt: new Date(), updatedAt: new Date() }).where(eq(expenses.id, expenseId));
  const detail = await getExpense(userId, groupId, expenseId);
  await getDb().insert(expenseHistory).values({ expenseId, userId, actedBy, action: "delete", snapshot: snapshot(detail) });
}

/** Holt eine gelöschte Ausgabe zurück (jedes Mitglied darf das; im Verlauf als „Wiederhergestellt“). */
export async function restoreExpense(userId: string, groupId: string, expenseId: string, actedBy: string | null = null) {
  const existing = await getExpense(userId, groupId, expenseId);
  if (!existing.deletedAt) return existing; // schon aktiv: nichts zu tun
  await getDb().update(expenses).set({ deletedAt: null, updatedAt: new Date() }).where(eq(expenses.id, expenseId));
  const detail = await getExpense(userId, groupId, expenseId);
  await getDb().insert(expenseHistory).values({ expenseId, userId, actedBy, action: "restore", snapshot: snapshot(detail) });
  await notifyGroup({
    type: "expense_restored",
    groupId,
    expenseId,
    actorId: userId,
    title: detail.title,
    amountMinor: detail.amountMinor,
    currency: detail.currency,
  });
  await checkBudgetAlert(groupId);
  return detail;
}

export async function expenseHistoryFor(userId: string, groupId: string, expenseId: string) {
  await getExpense(userId, groupId, expenseId);
  const actor = alias(users, "actor");
  return getDb()
    .select({
      id: expenseHistory.id,
      action: expenseHistory.action,
      snapshot: expenseHistory.snapshot,
      createdAt: expenseHistory.createdAt,
      userId: expenseHistory.userId,
      userName: sql<string>`case when ${users.kind} = 'test' then ${users.name} || ' (Test)' else ${users.name} end`,
      /** Name des Admins, der als Testnutzer gehandelt hat (sonst null) */
      actedByName: actor.name,
    })
    .from(expenseHistory)
    .innerJoin(users, eq(users.id, expenseHistory.userId))
    .leftJoin(actor, eq(actor.id, expenseHistory.actedBy))
    .where(eq(expenseHistory.expenseId, expenseId))
    .orderBy(desc(expenseHistory.createdAt));
}
