/** Auswertungen über Ausgaben; je Währung getrennt (Umrechnung folgt in Phase 3). */

export type StatExpense = {
  currency: string;
  amountMinor: number;
  date: string; // YYYY-MM-DD
  category: string;
  payers: { userId: string; amountMinor: number }[];
  shares: { userId: string; amountMinor: number }[];
};

export type CurrencyStats = {
  total: number;
  count: number;
  byCategory: { category: string; total: number }[];
  byMonth: { month: string; total: number }[]; // aufsteigend, YYYY-MM
  byPerson: { userId: string; paid: number; share: number }[];
};

export function computeStats(expenses: StatExpense[]): Record<string, CurrencyStats> {
  const out: Record<string, CurrencyStats> = {};
  const cats: Record<string, Map<string, number>> = {};
  const months: Record<string, Map<string, number>> = {};
  const people: Record<string, Map<string, { paid: number; share: number }>> = {};
  for (const e of expenses) {
    const c = (out[e.currency] ??= { total: 0, count: 0, byCategory: [], byMonth: [], byPerson: [] });
    c.total += e.amountMinor;
    c.count += 1;
    const cm = (cats[e.currency] ??= new Map());
    cm.set(e.category, (cm.get(e.category) ?? 0) + e.amountMinor);
    const mm = (months[e.currency] ??= new Map());
    const month = e.date.slice(0, 7);
    mm.set(month, (mm.get(month) ?? 0) + e.amountMinor);
    const pm = (people[e.currency] ??= new Map());
    for (const p of e.payers) {
      const cur = pm.get(p.userId) ?? { paid: 0, share: 0 };
      cur.paid += p.amountMinor;
      pm.set(p.userId, cur);
    }
    for (const s of e.shares) {
      const cur = pm.get(s.userId) ?? { paid: 0, share: 0 };
      cur.share += s.amountMinor;
      pm.set(s.userId, cur);
    }
  }
  for (const cur of Object.keys(out)) {
    out[cur].byCategory = [...cats[cur]].map(([category, total]) => ({ category, total })).sort((a, b) => b.total - a.total || (a.category < b.category ? -1 : 1));
    out[cur].byMonth = [...months[cur]].map(([month, total]) => ({ month, total })).sort((a, b) => (a.month < b.month ? -1 : 1));
    out[cur].byPerson = [...people[cur]].map(([userId, v]) => ({ userId, ...v })).sort((a, b) => b.paid - a.paid || (a.userId < b.userId ? -1 : 1));
  }
  return out;
}
