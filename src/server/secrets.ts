import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { env } from "./env";

/**
 * Kleine Krypto-Helfer, alle aus APP_SECRET abgeleitet (getrennte Schlüssel je Zweck):
 * - encryptSecret/decryptSecret: AES-256-GCM für TOTP-Geheimnisse in der Datenbank
 * - hmacHex: Hash für Wiederherstellungscodes (ohne APP_SECRET nicht nachrechenbar)
 * - signToken/verifyToken: signierte, kurzlebige Zwischenstufe nach dem Passwort (TOTP-Schritt beim Login)
 */
const key = (purpose: string) => createHash("sha256").update(`finantsen/${purpose}/v1\0${env.appSecret}`).digest();

export function encryptSecret(plain: string): string {
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", key("secret-box"), iv);
  const ct = Buffer.concat([c.update(plain, "utf8"), c.final()]);
  return ["v1", iv.toString("base64url"), c.getAuthTag().toString("base64url"), ct.toString("base64url")].join(".");
}

/** Wirft bei manipuliertem Wert oder falschem APP_SECRET. */
export function decryptSecret(boxed: string): string {
  const [v, iv, tag, ct] = boxed.split(".");
  if (v !== "v1" || !iv || !tag || !ct) throw new Error("invalid secret box");
  const d = createDecipheriv("aes-256-gcm", key("secret-box"), Buffer.from(iv, "base64url"));
  d.setAuthTag(Buffer.from(tag, "base64url"));
  return Buffer.concat([d.update(Buffer.from(ct, "base64url")), d.final()]).toString("utf8");
}

export const hmacHex = (purpose: string, value: string) => createHmac("sha256", key(purpose)).update(value).digest("hex");

const sig = (payload: string) => createHmac("sha256", key("token")).update(payload).digest("base64url");

export function signToken(data: Record<string, unknown>, ttlSeconds: number): string {
  const payload = Buffer.from(JSON.stringify({ ...data, exp: Math.floor(Date.now() / 1000) + ttlSeconds })).toString("base64url");
  return `${payload}.${sig(payload)}`;
}

/** Liefert die Daten oder null (falsche Signatur, abgelaufen, kaputt). */
export function verifyToken<T extends Record<string, unknown>>(token: string): T | null {
  const [payload, s] = token.split(".");
  if (!payload || !s) return null;
  const expected = sig(payload);
  if (s.length !== expected.length || !timingSafeEqual(Buffer.from(s), Buffer.from(expected))) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as T & { exp?: number };
    return typeof data.exp === "number" && data.exp > Math.floor(Date.now() / 1000) ? data : null;
  } catch {
    return null;
  }
}
