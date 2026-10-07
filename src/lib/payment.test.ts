import { describe, expect, it } from "vitest";
import { epcPayload, formatIban, isValidIban, isValidPaypalName, paypalMeUrl } from "./payment";

describe("Bezahlhilfen", () => {
  it("IBAN-Prüfung mit Prüfsumme", () => {
    expect(isValidIban("DE89 3704 0044 0532 0130 00")).toBe(true);
    expect(isValidIban("de89370400440532013000")).toBe(true);
    expect(isValidIban("DE89 3704 0044 0532 0130 01")).toBe(false);
    expect(isValidIban("GB82WEST12345698765432")).toBe(true);
    expect(isValidIban("AT611904300234573201")).toBe(true);
    expect(isValidIban("DE00")).toBe(false);
    expect(isValidIban("")).toBe(false);
    expect(formatIban("de89370400440532013000")).toBe("DE89 3704 0044 0532 0130 00");
  });

  it("GiroCode nach EPC069-12 Version 002", () => {
    const p = epcPayload({ name: "Anna Müller", iban: "DE89 3704 0044 0532 0130 00", amountMinor: 2350, currency: "EUR", text: "Finantsen: WG" });
    expect(p).toBe(["BCD", "002", "1", "SCT", "", "Anna Müller", "DE89370400440532013000", "EUR23.50", "", "", "Finantsen: WG"].join("\n"));
    expect(epcPayload({ name: "A", iban: "DE89370400440532013000", amountMinor: 5, currency: "EUR", text: "" })).toContain("EUR0.05");
    // nur Euro, gültige IBAN, Name nötig, Zeilenumbrüche entfernt
    expect(epcPayload({ name: "A", iban: "DE89370400440532013000", amountMinor: 100, currency: "USD", text: "" })).toBeNull();
    expect(epcPayload({ name: "A", iban: "DE89370400440532013001", amountMinor: 100, currency: "EUR", text: "" })).toBeNull();
    expect(epcPayload({ name: " ", iban: "DE89370400440532013000", amountMinor: 100, currency: "EUR", text: "" })).toBeNull();
    expect(epcPayload({ name: "A\nB", iban: "DE89370400440532013000", amountMinor: 100, currency: "EUR", text: "x\ny" })!.split("\n")).toHaveLength(11);
    expect(epcPayload({ name: "A", iban: "DE89370400440532013000", amountMinor: 0, currency: "EUR", text: "" })).toBeNull();
  });

  it("PayPal.me-Links", () => {
    expect(isValidPaypalName("anna123")).toBe(true);
    expect(isValidPaypalName("anna/evil")).toBe(false);
    expect(paypalMeUrl("anna", 2350, "EUR", 2)).toBe("https://paypal.me/anna/23.50EUR");
    expect(paypalMeUrl("anna", 2350, "JPY", 0)).toBe("https://paypal.me/anna");
    expect(paypalMeUrl("x y", 1, "EUR", 2)).toBeNull();
  });
});
