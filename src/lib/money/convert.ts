/**
 * Währungsumrechnung mit Ganzzahl-Arithmetik (BigInt). Kurse sind Dezimalstrings
 * ("1.087300000000000"): 1 Einheit der Quellwährung = rate Einheiten der Zielwährung.
 */
import { minorUnits } from "./currency";
import { allocate } from "./split";

export const RATE_DECIMALS = 15;
const SCALE = 10n ** BigInt(RATE_DECIMALS);

/** Normalisiert einen Kurs (String oder Zahl) auf einen Dezimalstring; null bei ungültig/<=0. */
export function normalizeRate(input: string | number): string | null {
  let s: string;
  if (typeof input === "number") {
    if (!Number.isFinite(input) || input <= 0) return null;
    s = input.toFixed(RATE_DECIMALS);
  } else {
    s = input.trim().replace(",", ".");
    if (!/^\d+(\.\d+)?$/.test(s)) return null;
  }
  const [int, frac = ""] = s.split(".");
  let scaled = BigInt(int) * SCALE;
  const padded = frac.padEnd(RATE_DECIMALS + 1, "0");
  scaled += BigInt(padded.slice(0, RATE_DECIMALS));
  if (Number(padded[RATE_DECIMALS]) >= 5) scaled += 1n; // kaufmännisch runden
  if (scaled <= 0n) return null;
  const str = scaled.toString().padStart(RATE_DECIMALS + 1, "0");
  return `${str.slice(0, str.length - RATE_DECIMALS)}.${str.slice(str.length - RATE_DECIMALS)}`;
}

function toScaled(rate: string): bigint {
  const n = normalizeRate(rate);
  if (!n) throw new Error(`invalid rate: ${rate}`);
  return BigInt(n.replace(".", ""));
}

/** Rechnet einen Betrag in Minor-Units um; kaufmännisch gerundet (0,5 weg von 0). */
export function convertMinor(amountMinor: number, from: string, to: string, rate: string): number {
  if (!Number.isSafeInteger(amountMinor)) throw new Error("invalid amount");
  if (from === to) return amountMinor;
  const fd = minorUnits(from);
  const td = minorUnits(to);
  const neg = amountMinor < 0;
  const abs = BigInt(neg ? -amountMinor : amountMinor);
  const num = abs * toScaled(rate) * 10n ** BigInt(Math.max(0, td - fd));
  const den = SCALE * 10n ** BigInt(Math.max(0, fd - td));
  const q = (num * 2n + den) / (2n * den);
  const n = Number(q);
  if (!Number.isSafeInteger(n)) throw new Error("amount out of range");
  return neg ? -n : n;
}

/** Kehrwert eines Kurses (für Anzeige "1 EUR = x USD"). */
export function invertRate(rate: string): string {
  const inv = (SCALE * SCALE * 2n + toScaled(rate)) / (2n * toScaled(rate));
  const n = normalizeRate(inv.toString().padStart(RATE_DECIMALS + 1, "0").replace(new RegExp(`(\\d{${RATE_DECIMALS}})$`), ".$1"));
  if (!n) throw new Error("rate out of range");
  return n;
}

/**
 * Verteilt `total` (bereits umgerechnet) proportional zu den Originalbeträgen neu, damit die
 * umgerechneten Anteile exakt dem umgerechneten Gesamtbetrag entsprechen.
 */
export function rescale(total: number, originals: number[]): number[] {
  if (originals.length === 0) return [];
  if (originals.every((x) => x === 0)) return originals.map(() => 0);
  return allocate(total, originals);
}
