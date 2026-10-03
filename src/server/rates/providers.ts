/**
 * Wechselkursanbieter hinter einem Interface. Konfiguration per .env:
 *   EXCHANGE_RATE_PROVIDER = fawazahmed0 (Standard) | open-er-api | frankfurter | static
 * Neue Anbieter: Interface implementieren und in `providers` eintragen.
 */

export interface RateProvider {
  name: string;
  /** Unterstützt der Anbieter historische Kurse? Sonst werden immer aktuelle Kurse geliefert. */
  historical: boolean;
  /** Kurse von `base` in alle anderen Währungen (Großbuchstaben): 1 base = rates[X] X. date = YYYY-MM-DD. */
  fetchRates(base: string, date: string, today: string): Promise<Record<string, number>>;
}

const TIMEOUT_MS = 8000;

async function getJson(url: string): Promise<unknown> {
  const res = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS), headers: { accept: "application/json" } });
  if (!res.ok) throw new Error(`${url} -> HTTP ${res.status}`);
  return res.json();
}

function upper(obj: Record<string, unknown>): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(obj)) if (typeof v === "number" && Number.isFinite(v) && v > 0) out[k.toUpperCase()] = v;
  return out;
}

/**
 * Standard: fawazahmed0/currency-api (kostenlos, ohne API-Key, über 200 Währungen, tägliche
 * historische Kurse, ausgeliefert über CDN mit Fallback-Domain).
 */
export const fawazahmed0: RateProvider = {
  name: "fawazahmed0",
  historical: true,
  async fetchRates(base, date, today) {
    const b = base.toLowerCase();
    const v = date >= today ? "latest" : date;
    const urls = [
      `https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@${v}/v1/currencies/${b}.json`,
      `https://${v}.currency-api.pages.dev/v1/currencies/${b}.json`,
    ];
    let lastErr: unknown;
    for (const u of urls) {
      try {
        const j = (await getJson(u)) as Record<string, Record<string, unknown>>;
        const table = j[b];
        if (table && typeof table === "object") return upper(table);
        throw new Error("unexpected response shape");
      } catch (e) {
        lastErr = e;
      }
    }
    throw lastErr;
  },
};

/** open.er-api.com: kostenlos ohne Key, ~160 Währungen, nur aktuelle Kurse (täglich aktualisiert). */
export const openErApi: RateProvider = {
  name: "open-er-api",
  historical: false,
  async fetchRates(base) {
    const j = (await getJson(`https://open.er-api.com/v6/latest/${base}`)) as { result?: string; rates?: Record<string, unknown> };
    if (j.result !== "success" || !j.rates) throw new Error("open-er-api: unexpected response");
    return upper(j.rates);
  },
};

/** Frankfurter (EZB-Referenzkurse): nur ca. 30 Währungen, dafür historisch. */
export const frankfurter: RateProvider = {
  name: "frankfurter",
  historical: true,
  async fetchRates(base, date, today) {
    const v = date >= today ? "latest" : date;
    const j = (await getJson(`https://api.frankfurter.dev/v1/${v}?base=${base}`)) as { rates?: Record<string, unknown> };
    if (!j.rates) throw new Error("frankfurter: unexpected response");
    return upper(j.rates);
  },
};

/**
 * Feste Kurstabelle aus der Umgebung (Offline-/Air-gapped-Betrieb, Tests):
 * EXCHANGE_RATES_STATIC='{"USD":1.1,"JPY":160}' = Einheiten pro 1 EUR. Beliebige Paare via Kreuzkurs.
 */
export const staticProvider: RateProvider = {
  name: "static",
  historical: false,
  async fetchRates(base) {
    let table: Record<string, number>;
    try {
      table = upper(JSON.parse(process.env.EXCHANGE_RATES_STATIC ?? "{}"));
    } catch {
      throw new Error("EXCHANGE_RATES_STATIC is not valid JSON");
    }
    table.EUR = 1;
    const b = table[base];
    if (!b) throw new Error(`static: no rate for ${base}`);
    const out: Record<string, number> = {};
    for (const [k, v] of Object.entries(table)) if (k !== base) out[k] = v / b;
    return out;
  },
};

export const providers: Record<string, RateProvider> = {
  fawazahmed0,
  "open-er-api": openErApi,
  frankfurter,
  static: staticProvider,
};

export function providerFromEnv(): RateProvider {
  const name = process.env.EXCHANGE_RATE_PROVIDER || "fawazahmed0";
  const p = providers[name];
  if (!p) throw new Error(`Unknown EXCHANGE_RATE_PROVIDER "${name}" (valid: ${Object.keys(providers).join(", ")})`);
  return p;
}
