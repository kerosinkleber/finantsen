import { computeBalances, pairwiseDebts, simplifyDebts, type Balances } from "@/lib/money";
import { getDb } from "../db";
import { eq, sql } from "drizzle-orm";
import { groups } from "../schema";
import { requireMember } from "./access";
import { loadExpenses } from "./expenses";
import { loadPayments } from "./payments";

export type Transfer = { from: string; to: string; amount: number };
export type GroupBalances = {
  /** currency -> userId -> net */
  net: Balances;
  /** currency -> Überweisungen (vereinfacht oder paarweise, je nach Gruppeneinstellung) */
  transfers: Record<string, Transfer[]>;
  simplified: boolean;
};

/**
 * Nettosalden mehrerer Gruppen direkt in der Datenbank summiert (Zahler +, Anteile −, Zahlungen von +/an −), ohne
 * Ausgaben einzeln zu laden. Ergebnis wie `computeBalances` (Abrechnungswährung, Nullsalden entfernt).
 */
export async function netBalancesSql(groupIds: string[]): Promise<Map<string, Balances>> {
  const out = new Map<string, Balances>();
  if (!groupIds.length) return out;
  const ids = sql`${sql.param(groupIds)}::uuid[]`;
  const rows = (await getDb().execute(sql`
    select group_id, currency, user_id, sum(amount)::text as amount from (
      select e.group_id, e.base_currency as currency, p.user_id, case when e.is_refund then -p.base_amount_minor else p.base_amount_minor end as amount
        from expense_payers p join expenses e on e.id = p.expense_id
        where e.group_id = any(${ids}) and e.deleted_at is null
      union all
      select e.group_id, e.base_currency, s.user_id, case when e.is_refund then s.base_amount_minor else -s.base_amount_minor end
        from expense_shares s join expenses e on e.id = s.expense_id
        where e.group_id = any(${ids}) and e.deleted_at is null
      union all
      select group_id, currency, from_user, amount_minor from payments where group_id = any(${ids}) and deleted_at is null
      union all
      select group_id, currency, to_user, -amount_minor from payments where group_id = any(${ids}) and deleted_at is null
    ) x
    group by group_id, currency, user_id
    having sum(amount) <> 0
  `)) as unknown as { group_id: string; currency: string; user_id: string; amount: string }[];
  for (const r of rows) {
    const b = out.get(r.group_id) ?? {};
    (b[r.currency] ??= {})[r.user_id] = Number(r.amount);
    out.set(r.group_id, b);
  }
  return out;
}

function simplifiedTransfers(net: Balances) {
  const transfers: Record<string, Transfer[]> = {};
  for (const [cur, m] of Object.entries(net)) transfers[cur] = simplifyDebts(m);
  return transfers;
}

/** Berechnet die Salden einer Gruppe (ohne Berechtigungsprüfung; intern). */
export async function groupBalances(groupId: string): Promise<GroupBalances> {
  const [g] = await getDb().select({ simplify: groups.simplifyDebts }).from(groups).where(eq(groups.id, groupId));
  // Vereinfachte Schulden brauchen nur die Nettosalden: Summen in SQL statt aller Ausgaben
  if (g?.simplify ?? true) {
    const net = (await netBalancesSql([groupId])).get(groupId) ?? {};
    return { net, transfers: simplifiedTransfers(net), simplified: true };
  }
  return groupBalancesFull(groupId, false);
}

/** Vollständiger Weg über alle Ausgaben (nötig für paarweise Schulden ohne Vereinfachung). */
export async function groupBalancesFull(groupId: string, simplified: boolean): Promise<GroupBalances> {
  const [exps, pays] = await Promise.all([loadExpenses(groupId), loadPayments(groupId)]);
  const expLike = exps.map((e) => {
    // Salden werden in der Abrechnungswährung der Ausgabe geführt (umgerechnet beim Buchen)
    const payers = e.payers.map((p) => ({ userId: p.userId, amount: p.baseAmountMinor }));
    const shares = e.shares.map((s) => ({ userId: s.userId, amount: s.baseAmountMinor }));
    // Rückerstattung wirkt umgekehrt: wer das Geld erhalten hat, schuldet es denen, denen es zusteht
    return e.isRefund ? { currency: e.baseCurrency, payers: shares, shares: payers } : { currency: e.baseCurrency, payers, shares };
  });
  const payLike = pays.map((p) => ({ currency: p.currency, fromUser: p.fromUser, toUser: p.toUser, amount: p.amountMinor }));
  const net = computeBalances(expLike, payLike);
  const transfers = simplified ? simplifiedTransfers(net) : pairwiseDebts(expLike, payLike);
  return { net, transfers, simplified };
}

export async function getGroupBalances(userId: string, groupId: string) {
  await requireMember(userId, groupId);
  return groupBalances(groupId);
}

export type OverallBalances = {
  /** currency -> Gesamtsaldo des Nutzers (positiv: bekommt) */
  totals: Record<string, number>;
  /** Gegenüber anderen Personen, über alle Gruppen aufgerechnet: positiv = die Person schuldet dem Nutzer */
  people: { userId: string; name: string; currency: string; amount: number }[];
  /** Saldo des Nutzers je Gruppe */
  perGroup: Record<string, Record<string, number>>;
};

export async function overallBalances(userId: string): Promise<OverallBalances> {
  const { listGroups } = await import("./groups");
  const list = await listGroups(userId);
  const names = new Map<string, string>();
  const totals: Record<string, number> = {};
  const perGroup: Record<string, Record<string, number>> = {};
  const pair = new Map<string, number>(); // "currency|other" -> amount (positiv: other schuldet mir)
  // Alle Gruppen mit vereinfachten Schulden in einer Abfrage, die übrigen parallel über den vollständigen Weg
  const flags = list.length
    ? await getDb()
        .select({ id: groups.id, simplify: groups.simplifyDebts })
        .from(groups)
        .where(sql`${groups.id} = any(${sql.param(list.map((g) => g.id))}::uuid[])`)
    : [];
  const simple = new Set(flags.filter((f) => f.simplify).map((f) => f.id));
  const nets = await netBalancesSql([...simple]);
  const full = new Map(
    await Promise.all(list.filter((g) => !simple.has(g.id)).map(async (g) => [g.id, await groupBalancesFull(g.id, false)] as const)),
  );
  for (const g of list) {
    g.members.forEach((m) => names.set(m.id, m.name));
    const net = nets.get(g.id) ?? {};
    const b = full.get(g.id) ?? { net, transfers: simplifiedTransfers(net), simplified: true };
    for (const [cur, m] of Object.entries(b.net)) {
      const mine = m[userId] ?? 0;
      if (mine === 0) continue;
      totals[cur] = (totals[cur] ?? 0) + mine;
      (perGroup[g.id] ??= {})[cur] = mine;
    }
    for (const [cur, ts] of Object.entries(b.transfers)) {
      for (const t of ts) {
        if (t.to === userId) pair.set(`${cur}|${t.from}`, (pair.get(`${cur}|${t.from}`) ?? 0) + t.amount);
        else if (t.from === userId) pair.set(`${cur}|${t.to}`, (pair.get(`${cur}|${t.to}`) ?? 0) - t.amount);
      }
    }
  }
  for (const k of Object.keys(totals)) if (totals[k] === 0) delete totals[k];
  const people = [...pair.entries()]
    .filter(([, v]) => v !== 0)
    .map(([k, amount]) => {
      const [currency, other] = k.split("|");
      return { userId: other, name: names.get(other) ?? "?", currency, amount };
    })
    .sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount));
  return { totals, people, perGroup };
}
