import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

/** TOTP nach RFC 6238 (HMAC-SHA1, 6 Stellen, 30 Sekunden), ohne Fremdbibliothek. */

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
export const STEP_SECONDS = 30;

export function base32Encode(buf: Buffer): string {
  let bits = 0;
  let value = 0;
  let out = "";
  for (const byte of buf) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += ALPHABET[(value << (5 - bits)) & 31];
  return out;
}

/** Ignoriert Leerzeichen, Bindestriche, Padding und Groß-/Kleinschreibung; wirft bei ungültigen Zeichen. */
export function base32Decode(input: string): Buffer {
  const clean = input.toUpperCase().replace(/[\s-]/g, "").replace(/=+$/, "");
  let bits = 0;
  let value = 0;
  const out: number[] = [];
  for (const ch of clean) {
    const idx = ALPHABET.indexOf(ch);
    if (idx < 0) throw new Error("invalid base32");
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(out);
}

export function hotp(secret: Buffer, counter: number, digits = 6): string {
  const msg = Buffer.alloc(8);
  msg.writeBigUInt64BE(BigInt(counter));
  const h = createHmac("sha1", secret).update(msg).digest();
  const off = h[h.length - 1] & 0xf;
  const bin = ((h[off] & 0x7f) << 24) | (h[off + 1] << 16) | (h[off + 2] << 8) | h[off + 3];
  return String(bin % 10 ** digits).padStart(digits, "0");
}

export const stepAt = (ms = Date.now()) => Math.floor(ms / 1000 / STEP_SECONDS);

export const totpAt = (secret: Buffer, step: number, digits = 6) => hotp(secret, step, digits);

const safeEq = (a: string, b: string) => a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));

/**
 * Prüft einen Code im Fenster ±`window` Schritte um die aktuelle Zeit. Gibt den passenden Schritt zurück oder
 * null. Mit `afterStep` werden Codes eines bereits verwendeten (oder älteren) Schritts abgelehnt (Replay-Schutz).
 */
export function verifyTotp(secret: Buffer, code: string, opts: { nowMs?: number; window?: number; afterStep?: number | null } = {}): number | null {
  if (!/^\d{6}$/.test(code)) return null;
  const now = stepAt(opts.nowMs);
  const window = opts.window ?? 1;
  let found: number | null = null;
  for (let s = now - window; s <= now + window; s++) {
    // alle Kandidaten vergleichen (kein frühes Beenden), damit die Laufzeit nichts verrät
    if (safeEq(totpAt(secret, s), code) && found === null && (opts.afterStep == null || s > opts.afterStep)) found = s;
  }
  return found;
}

/** 160-Bit-Geheimnis als Base32 (so erwarten es Authenticator-Apps). */
export const generateSecret = () => base32Encode(randomBytes(20));

export function otpauthUri(opts: { secret: string; account: string; issuer: string }): string {
  const label = `${encodeURIComponent(opts.issuer)}:${encodeURIComponent(opts.account)}`;
  return `otpauth://totp/${label}?secret=${opts.secret}&issuer=${encodeURIComponent(opts.issuer)}&algorithm=SHA1&digits=6&period=${STEP_SECONDS}`;
}
