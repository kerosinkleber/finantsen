import { formatMoney } from "@/lib/money";

/** Betrag mit Farbe: positiv grün, negativ rot. */
export function Money({ minor, currency, locale, signed = false, absolute = false }: { minor: number; currency: string; locale: string; signed?: boolean; absolute?: boolean }) {
  const cls = minor > 0 ? "pos" : minor < 0 ? "neg" : "";
  // absolute: Betrag ohne Vorzeichen (der Text daneben nennt die Richtung), Farbe bleibt
  const text = formatMoney(absolute ? Math.abs(minor) : minor, currency, locale);
  return <span className={`tabular-nums ${cls}`}>{signed && minor > 0 ? "+" : ""}{text}</span>;
}
