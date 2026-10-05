/** Blättern in der Gruppenliste (rein): Ausgaben und Zahlungen gemeinsam, neueste zuerst. */

export const PAGE_SIZES = [50, 100] as const;
export type PageSize = (typeof PAGE_SIZES)[number];

export function parsePageSize(v: unknown): PageSize {
  return Number(v) === 100 ? 100 : 50;
}

export function parsePage(v: unknown): number {
  const n = Math.floor(Number(v));
  return Number.isFinite(n) && n >= 1 ? Math.min(n, 1_000_000) : 1;
}

export type FeedKey = { kind: "e" | "p"; id: string; date: string; at: number };

/** Gleiche Reihenfolge wie die SQL-Abfrage: Datum absteigend, dann Anlagezeit, dann ID. */
export function compareFeed(a: FeedKey, b: FeedKey): number {
  if (a.date !== b.date) return a.date < b.date ? 1 : -1;
  if (a.at !== b.at) return b.at - a.at;
  return a.id < b.id ? 1 : a.id > b.id ? -1 : 0;
}

/**
 * Seite `page` (ab 1) mit `size` Einträgen aus den neuesten Ausgaben-Schlüsseln (mindestens `page * size` Stück,
 * soweit vorhanden) und allen Zahlungs-Schlüsseln. `total` = Anzahl aller Einträge; eine zu große Seitenzahl wird
 * auf die letzte Seite begrenzt.
 */
export function feedPage(expenseKeys: FeedKey[], paymentKeys: FeedKey[], total: number, page: number, size: number) {
  const pages = Math.max(1, Math.ceil(total / size));
  const p = Math.min(Math.max(1, page), pages);
  const all = [...expenseKeys, ...paymentKeys].sort(compareFeed);
  return { items: all.slice((p - 1) * size, p * size), page: p, pages };
}
