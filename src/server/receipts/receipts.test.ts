import { describe, expect, it } from "vitest";
import { normalizeReceipt, type RawReceipt } from "./normalize";
import { createAnthropicScanner } from "./scanner";

const raw = (over: Partial<RawReceipt> = {}): RawReceipt => ({
  merchant: " Trattoria ",
  date: "2026-01-02",
  currency: "eur",
  items: [
    { name: "Pizza", price: "12,50" },
    { name: "Wein", price: "5.00" },
  ],
  tax: "1.00",
  tip: "2",
  total: "20.50",
  ...over,
});

describe("normalizeReceipt", () => {
  it("wandelt in Minor-Units um und prüft die Summe", () => {
    const r = normalizeReceipt(raw(), "USD");
    expect(r).toMatchObject({ merchant: "Trattoria", currency: "EUR", date: "2026-01-02", taxMinor: 100, tipMinor: 200, totalMinor: 2050, mismatch: false, dropped: 0 });
    expect(r.items).toEqual([{ name: "Pizza", amountMinor: 1250 }, { name: "Wein", amountMinor: 500 }]);
  });
  it("meldet Abweichung, verwirft Rabatte und unlesbare Zeilen", () => {
    const r = normalizeReceipt(raw({ items: [{ name: "Pizza", price: "12.50" }, { name: "Rabatt", price: "-2.00" }, { name: "??", price: "abc" }, { name: "", price: "1" }] }), "EUR");
    expect(r.items).toHaveLength(1);
    expect(r.dropped).toBe(3);
    expect(r.mismatch).toBe(true);
  });
  it("nutzt Fallback-Währung bei unbekanntem Code; JPY ohne Nachkommastellen; ungültiges Datum -> null", () => {
    const r = normalizeReceipt(raw({ currency: "XXZ", date: "2026-13-45", items: [{ name: "a", price: "500" }], tax: null, tip: null, total: "500" }), "JPY");
    expect(r.currency).toBe("JPY");
    expect(r.items[0].amountMinor).toBe(500);
    expect(r.date).toBeNull();
    expect(r.mismatch).toBe(false);
  });
  it("ohne Total: kein Mismatch, solange nichts verworfen wurde", () => {
    expect(normalizeReceipt(raw({ total: null }), "EUR").mismatch).toBe(false);
  });
});

describe("Anthropic-Scanner", () => {
  const img = { mediaType: "image/jpeg" as const, base64: "AAAA" };
  it("sendet Bild als base64 und liefert die geparste Ausgabe", async () => {
    let captured: Record<string, unknown> = {};
    const client = {
      messages: {
        parse: async (p: Record<string, unknown>) => {
          captured = p;
          return { stop_reason: "end_turn", parsed_output: raw() };
        },
      },
    };
    const s = createAnthropicScanner("k", { client: client as never, model: "test-model" });
    expect(await s.scan(img)).toEqual(raw());
    expect(captured.model).toBe("test-model");
    const content = (captured.messages as { content: { type: string; source?: { data: string } }[] }[])[0].content;
    expect(content[0].type).toBe("image");
    expect(content[0].source?.data).toBe("AAAA");
  });
  it("Refusal, abgeschnittene oder fehlende Ausgabe und API-Fehler -> scan_failed", async () => {
    const mk = (fn: () => Promise<unknown>) => createAnthropicScanner("k", { client: { messages: { parse: fn } } as never });
    await expect(mk(async () => ({ stop_reason: "refusal", parsed_output: null })).scan(img)).rejects.toMatchObject({ code: "scan_failed" });
    await expect(mk(async () => ({ stop_reason: "max_tokens", parsed_output: raw() })).scan(img)).rejects.toMatchObject({ code: "scan_failed" });
    await expect(mk(async () => ({ stop_reason: "end_turn", parsed_output: null })).scan(img)).rejects.toMatchObject({ code: "scan_failed" });
    await expect(mk(async () => { throw new Error("boom"); }).scan(img)).rejects.toMatchObject({ status: 502, code: "scan_failed" });
  });
});
