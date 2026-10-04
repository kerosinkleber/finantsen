/**
 * Währungs-Hilfen. Beträge sind immer ganze Zahlen in der kleinsten Einheit
 * (z. B. Cent). Die Anzahl der Nachkommastellen kommt aus ISO 4217 via Intl
 * (JPY = 0, EUR = 2, KWD = 3).
 */

const cache = new Map<string, number>();

let known: Set<string> | null = null;

/** Gültiger ISO-4217-Code laut ICU (Intl akzeptiert sonst jedes Dreibuchstaben-Kürzel, z. B. "XXZ"). */
export function isValidCurrency(code: string): boolean {
  if (!/^[A-Z]{3}$/.test(code)) return false;
  known ??= new Set(Intl.supportedValuesOf("currency"));
  return known.has(code);
}

export function minorUnits(currency: string): number {
  const hit = cache.get(currency);
  if (hit !== undefined) return hit;
  const digits = new Intl.NumberFormat("en", { style: "currency", currency }).resolvedOptions()
    .maximumFractionDigits as number;
  cache.set(currency, digits);
  return digits;
}

/**
 * Parst "12,50", "12.5", "1.234,56", "1,234.56" in Minor-Units; null bei ungültiger Eingabe.
 * Regel: Das letzte Trennzeichen ist das Dezimaltrennzeichen, außer dasselbe Zeichen kommt
 * mehrfach vor (dann sind alle Tausendertrenner). Überzählige Nachkommastellen sind nur
 * erlaubt, wenn sie 0 sind (keine stille Rundung).
 */
export function parseAmount(input: string, currency: string): number | null {
  const digits = minorUnits(currency);
  let s = input.trim().replace(/\s/g, "");
  if (!/^[+-]?[\d.,]+$/.test(s)) return null;
  let neg = false;
  if (s.startsWith("-")) {
    neg = true;
    s = s.slice(1);
  } else if (s.startsWith("+")) s = s.slice(1);

  const lastDot = s.lastIndexOf(".");
  const lastComma = s.lastIndexOf(",");
  const sepIdx = Math.max(lastDot, lastComma);
  let intPart = s;
  let fracPart = "";
  if (sepIdx >= 0) {
    const sepChar = s[sepIdx];
    const sameSepCount = s.split(sepChar).length - 1;
    const mixed = lastDot >= 0 && lastComma >= 0;
    if (sameSepCount > 1 && !mixed) {
      intPart = s.replace(/[.,]/g, "");
    } else {
      intPart = s.slice(0, sepIdx).replace(/[.,]/g, "");
      fracPart = s.slice(sepIdx + 1);
    }
  }
  if (intPart === "" && fracPart === "") return null;
  if (fracPart.length > digits) {
    if (/[1-9]/.test(fracPart.slice(digits))) return null;
    fracPart = fracPart.slice(0, digits);
  }
  fracPart = fracPart.padEnd(digits, "0");
  const value = Number((intPart || "0") + fracPart);
  if (!Number.isSafeInteger(value)) return null;
  return neg ? -value : value;
}

/** Minor-Units -> Dezimalstring ohne Locale ("12.50"). */
export function toDecimalString(minor: number, currency: string): string {
  const digits = minorUnits(currency);
  const neg = minor < 0;
  const abs = Math.abs(minor).toString().padStart(digits + 1, "0");
  const int = abs.slice(0, abs.length - digits);
  const frac = digits ? "." + abs.slice(abs.length - digits) : "";
  return (neg ? "-" : "") + int + frac;
}

/** Wert für Eingabefelder: wie toDecimalString, aber mit dem Dezimaltrennzeichen der Sprache ("12,50" auf Deutsch). */
export function toInputString(minor: number, currency: string, locale = "de"): string {
  const s = toDecimalString(minor, currency);
  return locale.startsWith("de") ? s.replace(".", ",") : s;
}

/** Dezimalzahl (z. B. Prozent oder Kurs) mit dem Dezimaltrennzeichen der Sprache, ohne Tausendertrenner. */
export function localDecimal(value: string | number, locale = "de"): string {
  const s = String(value);
  return locale.startsWith("de") ? s.replace(".", ",") : s;
}

/** Locale-abhängige Anzeige, z. B. "12,50 €". */
export function formatMoney(minor: number, currency: string, locale = "de"): string {
  const digits = minorUnits(currency);
  const value = Number(toDecimalString(minor, currency));
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(value);
}
