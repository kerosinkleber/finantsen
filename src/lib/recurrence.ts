/**
 * Wiederkehrende Termine (rein, ohne Datenbank). Datumswerte sind "YYYY-MM-DD" und werden in UTC gerechnet.
 * Der n-te Termin wird immer vom Startdatum aus berechnet (nicht vom Vorgänger), damit z. B. der 31. nach einem
 * kurzen Monat wieder der 31. ist: 31.1. → 28.2. → 31.3.
 */
export const UNITS = ["day", "week", "month", "year"] as const;
export type Unit = (typeof UNITS)[number];

const parse = (d: string): [number, number, number] => {
  const [y, m, day] = d.split("-").map(Number);
  return [y, m, day];
};
const fmt = (y: number, m: number, d: number) => `${String(y).padStart(4, "0")}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
const daysInMonth = (y: number, m: number) => new Date(Date.UTC(y, m, 0)).getUTCDate();

export const isIsoDate = (d: string) => /^\d{4}-\d{2}-\d{2}$/.test(d) && fmt(...parse(d)) === new Date(`${d}T00:00:00Z`).toISOString().slice(0, 10);

/** Der i-te Termin (i = 0 ist das Startdatum). */
export function occurrence(start: string, unit: Unit, every: number, i: number): string {
  const [y, m, d] = parse(start);
  if (unit === "day" || unit === "week") {
    const t = Date.UTC(y, m - 1, d) + i * every * (unit === "week" ? 7 : 1) * 86400_000;
    return new Date(t).toISOString().slice(0, 10);
  }
  const months = i * every * (unit === "year" ? 12 : 1);
  const total = y * 12 + (m - 1) + months;
  const ny = Math.floor(total / 12);
  const nm = (total % 12) + 1;
  return fmt(ny, nm, Math.min(d, daysInMonth(ny, nm)));
}

/** Alle Termine ab Index `from` bis einschließlich `until` (und `end`, falls gesetzt), höchstens `limit` Stück. */
export function dueOccurrences(opts: { start: string; unit: Unit; every: number; from: number; until: string; end?: string | null; limit?: number }) {
  const out: { index: number; date: string }[] = [];
  const limit = opts.limit ?? 400;
  for (let i = opts.from; out.length < limit; i++) {
    const date = occurrence(opts.start, opts.unit, opts.every, i);
    if (date > opts.until || (opts.end && date > opts.end)) break;
    out.push({ index: i, date });
  }
  return out;
}
