import { describe, expect, it } from "vitest";
import { digestMail, linkMail, notificationMail, testMail, utcStamp } from "./templates";

const APP = "https://finanzen.example.org/";

describe("Mail-Vorlagen", () => {
  it("Aktivierungs- und Reset-Link in der Sprache des Empfängers, Zeit in UTC", () => {
    const exp = new Date("2026-10-08T14:05:00Z");
    const a = linkMail("de", APP, { name: "Anna", username: "anna", email: "a@x.de" }, { url: "https://x/activate/T", expiresAt: exp, purpose: "activation" });
    expect(a.to).toBe("a@x.de");
    expect(a.subject).toBe("Finantsen: Konto aktivieren");
    expect(a.text).toContain("Hallo Anna,");
    expect(a.text).toContain("https://x/activate/T");
    expect(a.text).toContain("2026-10-08 14:05 UTC");
    expect(a.text).toContain("Finantsen (https://finanzen.example.org)");
    const r = linkMail("en", APP, { name: "Ben", username: "ben", email: "b@x.de" }, { url: "u", expiresAt: exp, purpose: "reset" });
    expect(r.subject).toBe("Finantsen: set a new password");
    expect(r.text).toContain("If you did not request this");
    expect(utcStamp(exp)).toBe("2026-10-08 14:05 UTC");
  });

  it("Benachrichtigung mit Link zur Ausgabe und zum Abschalten", () => {
    const m = notificationMail("de", APP, { name: "Ben", email: "b@x.de" }, { group: "WG", text: "Anna hat „Pizza“ hinzugefügt.", path: "/groups/g/expenses/e" });
    expect(m.subject).toBe("Finantsen: WG");
    expect(m.text).toContain("Anna hat „Pizza“ hinzugefügt.");
    expect(m.text).toContain("https://finanzen.example.org/groups/g/expenses/e");
    expect(m.text).toContain("https://finanzen.example.org/settings");
  });

  it("Zusammenfassung: nur offene Salden, Summen je Währung; nichts offen → keine Mail", () => {
    const to = { name: "Anna", email: "a@x.de" };
    expect(digestMail("de", APP, to, [])).toBeNull();
    expect(digestMail("de", APP, to, [{ group: "WG", currency: "EUR", amount: 0 }])).toBeNull();
    const m = digestMail("de", APP, to, [
      { group: "WG", currency: "EUR", amount: 1250 },
      { group: "Urlaub", currency: "EUR", amount: -500 },
      { group: "Trip", currency: "USD", amount: -100 },
    ])!;
    expect(m.text).toContain("WG: du bekommst 12,50");
    expect(m.text).toContain("Urlaub: du schuldest 5,00");
    expect(m.text).toMatch(/Insgesamt: \+7,50\s?€, −1,00\s?\$/);
    const en = digestMail("en", APP, to, [{ group: "WG", currency: "EUR", amount: -1 }])!;
    expect(en.text).toContain("WG: you owe €0.01");
  });

  it("Test-Mail", () => {
    expect(testMail("en", APP, { name: "Admin", email: "x@y.z" }).subject).toBe("Finantsen: test e-mail");
  });
});
