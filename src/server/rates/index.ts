import { and, eq } from "drizzle-orm";
import { getDb } from "../db";
import { exchangeRates } from "../schema";
import { ApiError } from "../http";
import { isValidCurrency, normalizeRate } from "@/lib/money";
import { providerFromEnv, type RateProvider } from "./providers";

let override: RateProvider | null = null;
/** Nur für Tests: Anbieter austauschen (null = zurück zur Konfiguration). */
export function setRateProvider(p: RateProvider | null) {
  override = p;
  supportedCache = null;
}
const provider = () => override ?? providerFromEnv();

const today = () => new Date().toISOString().slice(0, 10);
const TODAY_TTL_MS = 6 * 3600_000;

export type RateResult = { rate: string; source: "same" | "provider"; provider?: string; date: string };

/** Kurse von `base` an einem Datum aus dem Cache oder vom Anbieter. Vergangene Tage ändern sich nicht mehr. */
async function ratesFor(base: string, date: string): Promise<Record<string, number>> {
  const p = provider();
  const t = today();
  const day = date > t ? t : date;
  const key = p.historical ? day : t;
  const db = getDb();
  const [hit] = await db
    .select()
    .from(exchangeRates)
    .where(and(eq(exchangeRates.provider, p.name), eq(exchangeRates.base, base), eq(exchangeRates.date, key)));
  const fresh = hit && (key < t || Date.now() - hit.fetchedAt.getTime() < TODAY_TTL_MS);
  if (hit && fresh) return hit.rates as Record<string, number>;
  try {
    const rates = await p.fetchRates(base, key, t);
    await db
      .insert(exchangeRates)
      .values({ provider: p.name, base, date: key, rates })
      .onConflictDoUpdate({ target: [exchangeRates.provider, exchangeRates.base, exchangeRates.date], set: { rates, fetchedAt: new Date() } });
    return rates;
  } catch (e) {
    console.error(`[rates] ${p.name} failed for ${base} ${key}:`, (e as Error).message);
    if (hit) return hit.rates as Record<string, number>; // veralteter Cache ist besser als kein Kurs
    throw new ApiError(503, "rate_unavailable");
  }
}

/** Kurs: 1 `from` = rate `to` zum Buchungsdatum. Wirft 503 `rate_unavailable` / 422 `currency_unsupported`. */
export async function getRate(from: string, to: string, date: string): Promise<RateResult> {
  if (!isValidCurrency(from) || !isValidCurrency(to)) throw new ApiError(400, "invalid_currency");
  if (from === to) return { rate: "1.000000000000000", source: "same", date };
  const rates = await ratesFor(from, date);
  const raw = rates[to];
  const rate = raw === undefined ? null : normalizeRate(raw);
  if (!rate) throw new ApiError(422, "currency_unsupported");
  return { rate, source: "provider", provider: provider().name, date };
}

let supportedCache: { at: number; list: string[] } | null = null;

/** Währungen, die der Anbieter kennt, geschnitten mit gültigen ISO-Codes (Intl); Fallback: alle Intl-Währungen. */
export async function getSupportedCurrencies(): Promise<string[]> {
  if (supportedCache && Date.now() - supportedCache.at < 24 * 3600_000) return supportedCache.list;
  const intl = Intl.supportedValuesOf("currency");
  let list = intl;
  try {
    const rates = await ratesFor("EUR", today());
    const known = new Set([...Object.keys(rates), "EUR"]);
    const inter = intl.filter((c) => known.has(c));
    if (inter.length > 0) list = inter;
  } catch {
    /* Anbieter nicht erreichbar: Intl-Liste, aber nicht cachen */
    return list;
  }
  supportedCache = { at: Date.now(), list };
  return list;
}
