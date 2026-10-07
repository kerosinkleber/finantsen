import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { base32Decode, base32Encode, generateSecret, hotp, otpauthUri, stepAt, totpAt, verifyTotp } from "./totp";

const RFC_SECRET = Buffer.from("12345678901234567890"); // RFC 6238 Anhang B (SHA-1)

describe("Base32 (RFC 4648)", () => {
  it("Testvektoren", () => {
    const v: [string, string][] = [["", ""], ["f", "MY"], ["fo", "MZXQ"], ["foo", "MZXW6"], ["foob", "MZXW6YQ"], ["fooba", "MZXW6YTB"], ["foobar", "MZXW6YTBOI"]];
    for (const [plain, enc] of v) {
      expect(base32Encode(Buffer.from(plain))).toBe(enc);
      expect(base32Decode(enc).toString()).toBe(plain);
    }
  });
  it("Decodieren ist tolerant (Leerzeichen, Bindestriche, Kleinbuchstaben, Padding), lehnt Unsinn ab", () => {
    expect(base32Decode("mzxw 6ytb-oi======").toString()).toBe("foobar");
    expect(() => base32Decode("MZXW1")).toThrow(); // 1 ist kein Base32-Zeichen
  });
  it("Rundreise für Zufallsdaten", () => {
    const s = generateSecret();
    expect(s).toMatch(/^[A-Z2-7]{32}$/);
    expect(base32Encode(base32Decode(s))).toBe(s);
  });
});

describe("TOTP (RFC 6238)", () => {
  it("offizielle Testvektoren (8 Stellen)", () => {
    const v: [number, string][] = [[59, "94287082"], [1111111109, "07081804"], [1111111111, "14050471"], [1234567890, "89005924"], [2000000000, "69279037"], [20000000000, "65353130"]];
    for (const [t, code] of v) expect(hotp(RFC_SECRET, Math.floor(t / 30), 8)).toBe(code);
  });
  it("6-stellig = letzte 6 Stellen der 8-stelligen Vektoren", () => {
    expect(totpAt(RFC_SECRET, stepAt(59 * 1000))).toBe("287082");
    expect(totpAt(RFC_SECRET, stepAt(1111111109 * 1000))).toBe("081804");
  });
  it("Fenster ±1: vorheriger, aktueller und nächster Schritt gelten, ±2 nicht", () => {
    const now = 1111111109 * 1000;
    const s = stepAt(now);
    for (const d of [-1, 0, 1]) expect(verifyTotp(RFC_SECRET, totpAt(RFC_SECRET, s + d), { nowMs: now })).toBe(s + d);
    for (const d of [-2, 2]) expect(verifyTotp(RFC_SECRET, totpAt(RFC_SECRET, s + d), { nowMs: now })).toBeNull();
  });
  it("Replay-Schutz: Schritte bis einschließlich afterStep werden abgelehnt", () => {
    const now = 1111111109 * 1000;
    const s = stepAt(now);
    expect(verifyTotp(RFC_SECRET, totpAt(RFC_SECRET, s), { nowMs: now, afterStep: s })).toBeNull();
    expect(verifyTotp(RFC_SECRET, totpAt(RFC_SECRET, s - 1), { nowMs: now, afterStep: s })).toBeNull();
    expect(verifyTotp(RFC_SECRET, totpAt(RFC_SECRET, s + 1), { nowMs: now, afterStep: s })).toBe(s + 1);
  });
  it("lehnt ungültige Formate ab", () => {
    for (const c of ["", "12345", "1234567", "abcdef", "12 456", "٠١٢٣٤٥"]) expect(verifyTotp(RFC_SECRET, c)).toBeNull();
  });
  it("otpauth-URI enthält Aussteller, Konto, Geheimnis", () => {
    const u = otpauthUri({ secret: "ABC234", account: "anna@x", issuer: "Finantsen" });
    expect(u).toBe("otpauth://totp/Finantsen:anna%40x?secret=ABC234&issuer=Finantsen&algorithm=SHA1&digits=6&period=30");
  });
});

describe("Geheimnisse und Tokens (aus APP_SECRET)", () => {
  const old = process.env.APP_SECRET;
  let sec: typeof import("./secrets");
  beforeAll(async () => {
    process.env.APP_SECRET = "test-secret-for-unit-tests-0123456789";
    sec = await import("./secrets");
  });
  afterEach(() => {
    process.env.APP_SECRET = "test-secret-for-unit-tests-0123456789";
    vi.useRealTimers();
  });

  it("Verschlüsselung: Rundreise, jedes Mal anderer Wert, nie Klartext", () => {
    const a = sec.encryptSecret("JBSWY3DPEHPK3PXP");
    expect(sec.decryptSecret(a)).toBe("JBSWY3DPEHPK3PXP");
    expect(sec.encryptSecret("JBSWY3DPEHPK3PXP")).not.toBe(a);
    expect(a).not.toContain("JBSWY3DPEHPK3PXP");
  });
  it("Manipulation und falsches APP_SECRET werden erkannt", () => {
    const a = sec.encryptSecret("geheim");
    const parts = a.split(".");
    const tampered = [parts[0], parts[1], parts[2], Buffer.from("andere").toString("base64url")].join(".");
    expect(() => sec.decryptSecret(tampered)).toThrow();
    expect(() => sec.decryptSecret("kaputt")).toThrow();
    process.env.APP_SECRET = "ein-ganz-anderes-geheimnis-0123456789";
    expect(() => sec.decryptSecret(a)).toThrow();
  });
  it("fehlendes oder zu kurzes APP_SECRET ist ein klarer Fehler", () => {
    process.env.APP_SECRET = "kurz";
    expect(() => sec.encryptSecret("x")).toThrow(/APP_SECRET/);
    delete process.env.APP_SECRET;
    expect(() => sec.signToken({ u: "1" }, 60)).toThrow(/APP_SECRET/);
  });
  it("HMAC ist deterministisch und je Zweck verschieden", () => {
    expect(sec.hmacHex("recovery", "ABC")).toBe(sec.hmacHex("recovery", "ABC"));
    expect(sec.hmacHex("recovery", "ABC")).not.toBe(sec.hmacHex("other", "ABC"));
    expect(sec.hmacHex("recovery", "ABC")).not.toBe(sec.hmacHex("recovery", "ABD"));
  });
  it("signierte Tokens: gültig, manipuliert, abgelaufen, fremdes Secret", () => {
    const t = sec.signToken({ u: "user-1" }, 300);
    expect(sec.verifyToken<{ u: string }>(t)?.u).toBe("user-1");
    const [payload, s] = t.split(".");
    const forged = Buffer.from(JSON.stringify({ u: "admin", exp: 9999999999 })).toString("base64url");
    expect(sec.verifyToken(`${forged}.${s}`)).toBeNull();
    expect(sec.verifyToken(`${payload}.${s.slice(0, -2)}xx`)).toBeNull();
    expect(sec.verifyToken("nur-ein-teil")).toBeNull();
    vi.useFakeTimers();
    vi.setSystemTime(Date.now() + 301_000);
    expect(sec.verifyToken(t)).toBeNull();
    vi.useRealTimers();
    process.env.APP_SECRET = "ein-ganz-anderes-geheimnis-0123456789";
    expect(sec.verifyToken(t)).toBeNull();
  });
  it("Cleanup", () => {
    if (old === undefined) delete process.env.APP_SECRET;
    else process.env.APP_SECRET = old;
  });
});
