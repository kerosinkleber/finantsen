import { formatMoney } from "@/lib/money";

/** Betrag mit Farbe: positiv grün, negativ rot. */
export function Money({ minor, currency, locale, signed = false }: { minor: number; currency: string; locale: string; signed?: boolean }) {
  const cls = minor > 0 ? "pos" : minor < 0 ? "neg" : "";
  const text = formatMoney(minor, currency, locale);
  return <span className={`tabular-nums ${cls}`}>{signed && minor > 0 ? "+" : ""}{text}</span>;
}
