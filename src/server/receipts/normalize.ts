import { isValidCurrency, parseAmount } from "@/lib/money";

/** Rohausgabe des Vision-Modells: Beträge als Dezimalstrings (keine Floats). */
export type RawReceipt = {
  merchant: string | null;
  date: string | null;
  currency: string | null;
  items: { name: string; price: string }[];
  tax: string | null;
  tip: string | null;
  total: string | null;
};

export type ScannedReceipt = {
  merchant: string | null;
  date: string | null;
  currency: string;
  items: { name: string; amountMinor: number }[];
  taxMinor: number;
  tipMinor: number;
  totalMinor: number | null;
  /** Summe der erkannten Positionen + Steuer + Trinkgeld weicht vom Belegtotal ab */
  mismatch: boolean;
  /** Positionen, die verworfen wurden (unlesbarer Preis, Rabatt/negativ) */
  dropped: number;
};

/**
 * Wandelt die Modellausgabe in validierte Minor-Units um. Das Ergebnis ist nur ein Vorschlag:
 * Der Nutzer prüft und korrigiert es immer im Formular, bevor etwas gespeichert wird.
 */
export function normalizeReceipt(raw: RawReceipt, fallbackCurrency: string): ScannedReceipt {
  const cur = raw.currency?.trim().toUpperCase();
  const currency = cur && isValidCurrency(cur) ? cur : fallbackCurrency;
  const items: ScannedReceipt["items"] = [];
  let dropped = 0;
  for (const it of raw.items.slice(0, 200)) {
    const amount = parseAmount(it.price, currency);
    const name = it.name.trim().slice(0, 200);
    if (amount === null || amount < 0 || !name) {
      dropped++;
      continue;
    }
    items.push({ name, amountMinor: amount });
  }
  const opt = (v: string | null) => {
    const n = v ? parseAmount(v, currency) : null;
    return n !== null && n >= 0 ? n : 0;
  };
  const taxMinor = opt(raw.tax);
  const tipMinor = opt(raw.tip);
  const totalParsed = raw.total ? parseAmount(raw.total, currency) : null;
  const totalMinor = totalParsed !== null && totalParsed > 0 ? totalParsed : null;
  const sum = items.reduce((a, i) => a + i.amountMinor, 0) + taxMinor + tipMinor;
  const validDate = (d: string) => /^\d{4}-\d{2}-\d{2}$/.test(d) && !Number.isNaN(Date.parse(d)) && new Date(d).toISOString().startsWith(d);
  const date = raw.date && validDate(raw.date) ? raw.date : null;
  return {
    merchant: raw.merchant?.trim().slice(0, 200) || null,
    date,
    currency,
    items,
    taxMinor,
    tipMinor,
    totalMinor,
    mismatch: totalMinor !== null ? sum !== totalMinor : dropped > 0,
    dropped,
  };
}
