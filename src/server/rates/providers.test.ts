import { afterEach, describe, expect, it, vi } from "vitest";
import { fawazahmed0, frankfurter, openErApi, providerFromEnv, staticProvider } from "./providers";

// Hinweis: Die Antwortformate der Fake-Server entsprechen der öffentlichen Dokumentation der Anbieter.
// Echte Netzwerkaufrufe finden in den Tests nicht statt.
const json = (body: unknown, ok = true) => ({ ok, status: ok ? 200 : 500, json: async () => body }) as Response;

afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.EXCHANGE_RATES_STATIC;
  delete process.env.EXCHANGE_RATE_PROVIDER;
});

describe("rate providers", () => {
  it("fawazahmed0: liest Tabelle, Großbuchstaben, Historie über Datums-URL, Fallback-Domain", async () => {
    const urls: string[] = [];
    vi.stubGlobal("fetch", async (u: string) => {
      urls.push(u);
      if (u.includes("jsdelivr")) throw new Error("cdn down");
      return json({ date: "2026-01-02", eur: { usd: 1.1, jpy: 160, btc: 0.00001, bad: "x" } });
    });
    const r = await fawazahmed0.fetchRates("EUR", "2026-01-02", "2026-03-01");
    expect(r).toMatchObject({ USD: 1.1, JPY: 160 });
    expect(r.BAD).toBeUndefined();
    expect(urls[0]).toContain("currency-api@2026-01-02/v1/currencies/eur.json");
    expect(urls[1]).toContain("2026-01-02.currency-api.pages.dev");
    await fawazahmed0.fetchRates("EUR", "2026-03-01", "2026-03-01");
    expect(urls.some((u) => u.includes("@latest"))).toBe(true);
  });
  it("fawazahmed0: Fehler, wenn beide Quellen scheitern", async () => {
    vi.stubGlobal("fetch", async () => json({}, false));
    await expect(fawazahmed0.fetchRates("EUR", "2026-01-02", "2026-03-01")).rejects.toThrow();
  });
  it("open-er-api und frankfurter", async () => {
    vi.stubGlobal("fetch", async (u: string) =>
      u.includes("er-api") ? json({ result: "success", rates: { USD: 1.2 } }) : json({ rates: { USD: 1.3 } }),
    );
    expect(await openErApi.fetchRates("EUR", "2026-01-01", "2026-01-02")).toEqual({ USD: 1.2 });
    expect(await frankfurter.fetchRates("EUR", "2026-01-01", "2026-01-02")).toEqual({ USD: 1.3 });
    vi.stubGlobal("fetch", async () => json({ result: "error" }));
    await expect(openErApi.fetchRates("EUR", "", "")).rejects.toThrow();
  });
  it("static: Kreuzkurse über EUR", async () => {
    process.env.EXCHANGE_RATES_STATIC = '{"USD":1.1,"JPY":160}';
    const r = await staticProvider.fetchRates("USD", "", "");
    expect(r.EUR).toBeCloseTo(1 / 1.1, 12);
    expect(r.JPY).toBeCloseTo(160 / 1.1, 10);
    await expect(staticProvider.fetchRates("CHF", "", "")).rejects.toThrow();
  });
  it("Auswahl per Umgebungsvariable", () => {
    expect(providerFromEnv().name).toBe("fawazahmed0");
    process.env.EXCHANGE_RATE_PROVIDER = "static";
    expect(providerFromEnv().name).toBe("static");
    process.env.EXCHANGE_RATE_PROVIDER = "nope";
    expect(() => providerFromEnv()).toThrow(/Unknown/);
  });
});
