import { allocate } from "./split";
/** Salden: pro Währung und Nutzer. Positiv = bekommt Geld, negativ = schuldet Geld. */

export type ExpenseLike = {
  currency: string;
  payers: { userId: string; amount: number }[];
  shares: { userId: string; amount: number }[];
};
export type PaymentLike = { currency: string; fromUser: string; toUser: string; amount: number };

/** currency -> userId -> net (Minor-Units) */
export type Balances = Record<string, Record<string, number>>;

function add(b: Balances, cur: string, user: string, delta: number) {
  const m = (b[cur] ??= {});
  m[user] = (m[user] ?? 0) + delta;
}

export function computeBalances(expenses: ExpenseLike[], payments: PaymentLike[] = []): Balances {
  const b: Balances = {};
  for (const e of expenses) {
    for (const p of e.payers) add(b, e.currency, p.userId, p.amount);
    for (const s of e.shares) add(b, e.currency, s.userId, -s.amount);
  }
  // Zahlung from -> to: from hat to Geld gegeben, also steigt Saldo von from, sinkt Saldo von to.
  for (const p of payments) {
    add(b, p.currency, p.fromUser, p.amount);
    add(b, p.currency, p.toUser, -p.amount);
  }
  // Nullsalden entfernen
  for (const cur of Object.keys(b)) {
    for (const u of Object.keys(b[cur])) if (b[cur][u] === 0) delete b[cur][u];
    if (Object.keys(b[cur]).length === 0) delete b[cur];
  }
  return b;
}

export function mergeBalances(list: Balances[]): Balances {
  const out: Balances = {};
  for (const b of list)
    for (const [cur, users] of Object.entries(b))
      for (const [u, v] of Object.entries(users)) add(out, cur, u, v);
  for (const cur of Object.keys(out)) {
    for (const u of Object.keys(out[cur])) if (out[cur][u] === 0) delete out[cur][u];
    if (Object.keys(out[cur]).length === 0) delete out[cur];
  }
  return out;
}

/**
 * Nicht vereinfachte, paarweise Schulden: Jeder Anteil wird proportional zu den Zahlerbeträgen
 * auf die Zahler verteilt (deterministisch gerundet). Ergebnis je Währung: Liste from -> to,
 * bereits gegeneinander aufgerechnet. Zahlungen verringern die Schuld.
 */
export function pairwiseDebts(
  expenses: ExpenseLike[],
  payments: PaymentLike[] = [],
): Record<string, { from: string; to: string; amount: number }[]> {
  // currency -> "a|b" (a<b) -> Betrag, den a an b schuldet (negativ: b schuldet a)
  const acc: Record<string, Map<string, number>> = {};
  const owe = (cur: string, debtor: string, creditor: string, amount: number) => {
    if (debtor === creditor || amount === 0) return;
    const m = (acc[cur] ??= new Map());
    const flip = debtor > creditor;
    const key = flip ? `${creditor}|${debtor}` : `${debtor}|${creditor}`;
    m.set(key, (m.get(key) ?? 0) + (flip ? -amount : amount));
  };
  for (const e of expenses) {
    const payers = [...e.payers].sort((a, b) => (a.userId < b.userId ? -1 : 1)).filter((p) => p.amount > 0);
    if (payers.length === 0) continue;
    const weights = payers.map((p) => p.amount);
    for (const s of e.shares) {
      if (s.amount === 0) continue;
      const parts = allocate(s.amount, weights);
      payers.forEach((p, i) => owe(e.currency, s.userId, p.userId, parts[i]));
    }
  }
  for (const p of payments) owe(p.currency, p.toUser, p.fromUser, p.amount);

  const out: Record<string, { from: string; to: string; amount: number }[]> = {};
  for (const [cur, m] of Object.entries(acc)) {
    const list: { from: string; to: string; amount: number }[] = [];
    for (const [key, v] of m) {
      if (v === 0) continue;
      const [a, b] = key.split("|");
      list.push(v > 0 ? { from: a, to: b, amount: v } : { from: b, to: a, amount: -v });
    }
    if (list.length) out[cur] = list.sort((x, y) => y.amount - x.amount || (x.from < y.from ? -1 : 1));
  }
  return out;
}
