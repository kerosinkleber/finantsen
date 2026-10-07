/** Auswertungen über Ausgaben; je Währung getrennt (Umrechnung folgt in Phase 3). */

export type StatExpense = {
  currency: string;
  amountMinor: number;
  date: string; // YYYY-MM-DD
  category: string;
  payers: { userId: string; amountMinor: number }[];
  shares: { userId: string; amountMinor: number }[];
  /** optional: Zahlungsart und Titel (für „größte Ausgaben“) */
  paymentMethod?: string | null;
  title?: string;
};

export type CurrencyStats = {
  total: number;
  count: number;
  byCategory: { category: string; total: number }[];
  byMonth: { month: string; total: number }[]; // aufsteigend, YYYY-MM
  byPerson: { userId: string; paid: number; share: number }[];
  /** Durchschnitt je Ausgabe (gerundet) */
  avgPerExpense: number;
  /** Durchschnitt je Monat über den Zeitraum vom ersten bis zum letzten Monat mit Ausgaben (gerundet) */
  avgPerMonth: number;
  byMethod: { method: string; total: number }[];
  /** Die größten Ausgaben (höchstens 5) */
  top: { title: string; date: string; amount: number }[];
};

export function computeStats(expenses: StatExpense[]): Record<string, CurrencyStats> {
  const out: Record<string, CurrencyStats> = {};
  const cats: Record<string, Map<string, number>> = {};
  const months: Record<string, Map<string, number>> = {};
  const people: Record<string, Map<string, { paid: number; share: number }>> = {};
  const methods: Record<string, Map<string, number>> = {};
  const tops: Record<string, { title: string; date: string; amount: number }[]> = {};
  for (const e of expenses) {
    const c = (out[e.currency] ??= { total: 0, count: 0, byCategory: [], byMonth: [], byPerson: [], avgPerExpense: 0, avgPerMonth: 0, byMethod: [], top: [] });
    const meth = (methods[e.currency] ??= new Map());
    const mk = e.paymentMethod ?? "none";
    meth.set(mk, (meth.get(mk) ?? 0) + e.amountMinor);
    if (e.amountMinor > 0) (tops[e.currency] ??= []).push({ title: e.title ?? "", date: e.date, amount: e.amountMinor });
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
    const o = out[cur];
    o.avgPerExpense = o.count ? Math.round(o.total / o.count) : 0;
    o.avgPerMonth = Math.round(o.total / monthSpan(o.byMonth[0]?.month, o.byMonth[o.byMonth.length - 1]?.month));
    o.byMethod = [...methods[cur]].filter(([, v]) => v !== 0).map(([method, total]) => ({ method, total })).sort((a, b) => b.total - a.total || (a.method < b.method ? -1 : 1));
    o.top = (tops[cur] ?? []).sort((a, b) => b.amount - a.amount || (a.date < b.date ? 1 : -1)).slice(0, 5);
    out[cur].byPerson = [...people[cur]].map(([userId, v]) => ({ userId, ...v })).sort((a, b) => b.paid - a.paid || (a.userId < b.userId ? -1 : 1));
  }
  return out;
}

/** Anzahl Monate von `a` bis `b` (je inklusive, Format YYYY-MM), mindestens 1. */
export function monthSpan(a?: string, b?: string): number {
  if (!a || !b) return 1;
  const [ya, ma] = a.split("-").map(Number);
  const [yb, mb] = b.split("-").map(Number);
  return Math.max(1, (yb - ya) * 12 + (mb - ma) + 1);
}
