import { computeBalances, pairwiseDebts, simplifyDebts, type Balances } from "@/lib/money";
import { getDb } from "../db";
import { eq } from "drizzle-orm";
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

/** Berechnet die Salden einer Gruppe (ohne Berechtigungsprüfung; intern). */
export async function groupBalances(groupId: string): Promise<GroupBalances> {
  const [g] = await getDb().select({ simplify: groups.simplifyDebts }).from(groups).where(eq(groups.id, groupId));
  const [exps, pays] = await Promise.all([loadExpenses(groupId), loadPayments(groupId)]);
  const expLike = exps.map((e) => ({
    currency: e.currency,
    payers: e.payers.map((p) => ({ userId: p.userId, amount: p.amountMinor })),
    shares: e.shares.map((s) => ({ userId: s.userId, amount: s.amountMinor })),
  }));
  const payLike = pays.map((p) => ({ currency: p.currency, fromUser: p.fromUser, toUser: p.toUser, amount: p.amountMinor }));
  const net = computeBalances(expLike, payLike);
  const simplified = g?.simplify ?? true;
  const transfers: Record<string, Transfer[]> = {};
  if (simplified) {
    for (const [cur, m] of Object.entries(net)) transfers[cur] = simplifyDebts(m);
  } else {
    Object.assign(transfers, pairwiseDebts(expLike, payLike));
  }
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
  for (const g of list) {
    g.members.forEach((m) => names.set(m.id, m.name));
    const b = await groupBalances(g.id);
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
