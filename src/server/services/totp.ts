import { randomInt } from "node:crypto";
import { and, count, eq, isNull, sql } from "drizzle-orm";
import { getDb } from "../db";
import { recoveryCodes, users } from "../schema";
import { ApiError } from "../http";
import { endSessions, verifyPassword } from "../auth";
import { decryptSecret, encryptSecret, hmacHex, signToken, verifyToken } from "../secrets";
import { generateSecret, otpauthUri, base32Decode, verifyTotp } from "../totp";
import { lockSeconds } from "./accounts";
import { recoveryCodeCount, totpRequiredAll } from "./settings";

type UserRow = typeof users.$inferSelect;

const ISSUER = "Finantsen";
const CHALLENGE_SECONDS = 300;
const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // ohne leicht verwechselbare Zeichen

async function loadUser(id: string): Promise<UserRow> {
  const [u] = await getDb().select().from(users).where(eq(users.id, id));
  if (!u || u.kind !== "user") throw new ApiError(401, "unauthorized");
  return u;
}

/** Muss dieses Konto TOTP haben (Admin-Flag am Konto oder globaler Schalter)? */
export async function totpRequiredFor(u: Pick<UserRow, "totpRequired">): Promise<boolean> {
  return u.totpRequired || (await totpRequiredAll());
}

// ------------------------------------------------------------ Wiederherstellungscodes

export function normalizeRecoveryCode(input: string): string {
  const s = input.toUpperCase().replace(/[^A-Z0-9]/g, "");
  return s.length === 10 ? `${s.slice(0, 5)}-${s.slice(5)}` : s;
}

function newRecoveryCode(): string {
  const pick = () => CODE_ALPHABET[randomInt(CODE_ALPHABET.length)];
  return Array.from({ length: 10 }, pick).join("").replace(/^(.{5})(.{5})$/, "$1-$2");
}

const hashCode = (code: string) => hmacHex("recovery", normalizeRecoveryCode(code));

/** Ersetzt alle Codes des Kontos durch neue (Anzahl laut Einstellung); liefert sie im Klartext, einmalig. */
async function replaceRecoveryCodes(userId: string): Promise<string[]> {
  const n = await recoveryCodeCount();
  const codes = Array.from({ length: n }, newRecoveryCode);
  await getDb().transaction(async (tx) => {
    await tx.delete(recoveryCodes).where(eq(recoveryCodes.userId, userId));
    if (codes.length) await tx.insert(recoveryCodes).values(codes.map((c) => ({ userId, codeHash: hashCode(c) })));
  });
  return codes;
}

async function remainingCodes(userId: string): Promise<number> {
  const [{ n }] = await getDb().select({ n: count() }).from(recoveryCodes).where(and(eq(recoveryCodes.userId, userId), isNull(recoveryCodes.usedAt)));
  return n;
}

// ------------------------------------------------------------------- Prüfung

function assertNotLocked(u: UserRow) {
  if (u.totpLockedUntil && u.totpLockedUntil.getTime() > Date.now()) {
    throw new ApiError(429, "account_locked", "account_locked", { retryAfter: Math.ceil((u.totpLockedUntil.getTime() - Date.now()) / 1000) });
  }
}

async function registerFailure(u: UserRow): Promise<never> {
  const failed = u.totpFailedAttempts + 1;
  const secs = lockSeconds(failed);
  await getDb()
    .update(users)
    .set({ totpFailedAttempts: failed, totpLockedUntil: secs ? new Date(Date.now() + secs * 1000) : null })
    .where(eq(users.id, u.id));
  throw new ApiError(401, "invalid_code");
}

/**
 * Prüft einen TOTP-Code oder Wiederherstellungscode. Jeder Code gilt nur einmal (Zeitschritt-Replay-Schutz
 * bzw. Code verbraucht). Fehlversuche haben einen eigenen Zähler, den ein richtiges Passwort nicht löscht.
 */
async function verifyCode(u: UserRow, input: string): Promise<{ via: "totp" | "recovery" }> {
  assertNotLocked(u);
  if (!u.totpSecret) throw new ApiError(409, "totp_not_enabled");
  const db = getDb();
  const clean = input.replace(/\s/g, "");
  if (/^\d{6}$/.test(clean)) {
    const step = verifyTotp(base32Decode(decryptSecret(u.totpSecret)), clean, { afterStep: u.totpLastStep });
    if (step === null) return registerFailure(u);
    // atomar: nur weiterschalten, wenn kein anderer Aufruf den Schritt schon verbraucht hat
    const upd = await db
      .update(users)
      .set({ totpLastStep: step, totpFailedAttempts: 0, totpLockedUntil: null })
      .where(and(eq(users.id, u.id), sqlStepBefore(u.totpLastStep)))
      .returning({ id: users.id });
    if (upd.length === 0) return registerFailure(u);
    return { via: "totp" };
  }
  const used = await db
    .update(recoveryCodes)
    .set({ usedAt: new Date() })
    .where(and(eq(recoveryCodes.userId, u.id), eq(recoveryCodes.codeHash, hashCode(clean)), isNull(recoveryCodes.usedAt)))
    .returning({ id: recoveryCodes.id });
  if (used.length === 0) return registerFailure(u);
  await db.update(users).set({ totpFailedAttempts: 0, totpLockedUntil: null }).where(eq(users.id, u.id));
  return { via: "recovery" };
}

const sqlStepBefore = (last: number | null) => (last === null ? sql`${users.totpLastStep} is null` : sql`${users.totpLastStep} = ${last}`);

// ------------------------------------------------------------------- Anmeldung

export const issueChallenge = (userId: string) => signToken({ t: "totp-login", uid: userId }, CHALLENGE_SECONDS);

/** Zweiter Anmeldeschritt: gültige Challenge (nach Passwort) plus Code. Liefert das Konto. */
export async function completeLogin(challenge: string, code: string): Promise<UserRow> {
  const data = verifyToken<{ t: string; uid: string }>(challenge);
  if (!data || data.t !== "totp-login") throw new ApiError(401, "challenge_invalid");
  const u = await loadUser(data.uid);
  if (u.status !== "active") throw new ApiError(401, "challenge_invalid");
  await verifyCode(u, code);
  return u;
}

// ------------------------------------------------------------------ Einrichtung

export async function totpStatus(userId: string) {
  const u = await loadUser(userId);
  return {
    enabled: !!u.totpSecret,
    required: await totpRequiredFor(u),
    recoveryRemaining: u.totpSecret ? await remainingCodes(u.id) : 0,
  };
}

/** Beginnt die Einrichtung: neues, noch unbestätigtes Geheimnis. */
export async function startEnrollment(userId: string) {
  const u = await loadUser(userId);
  if (u.totpSecret) throw new ApiError(409, "totp_already_enabled");
  const secret = generateSecret();
  await getDb().update(users).set({ totpPendingSecret: encryptSecret(secret) }).where(eq(users.id, u.id));
  return { secret, uri: otpauthUri({ secret, account: u.username, issuer: ISSUER }) };
}

/** Bestätigt die Einrichtung mit einem gültigen Code; liefert die Wiederherstellungscodes (nur jetzt sichtbar). */
export async function confirmEnrollment(userId: string, code: string): Promise<{ recoveryCodes: string[] }> {
  const u = await loadUser(userId);
  if (u.totpSecret) throw new ApiError(409, "totp_already_enabled");
  if (!u.totpPendingSecret) throw new ApiError(409, "totp_not_started");
  assertNotLocked(u);
  const step = verifyTotp(base32Decode(decryptSecret(u.totpPendingSecret)), code.replace(/\s/g, ""));
  if (step === null) return registerFailure(u);
  await getDb()
    .update(users)
    .set({ totpSecret: u.totpPendingSecret, totpPendingSecret: null, totpEnabledAt: new Date(), totpLastStep: step, totpFailedAttempts: 0, totpLockedUntil: null })
    .where(eq(users.id, u.id));
  return { recoveryCodes: await replaceRecoveryCodes(u.id) };
}

async function checkPassword(u: UserRow, password: string) {
  if (!u.passwordHash || !(await verifyPassword(u.passwordHash, password))) throw new ApiError(403, "invalid_credentials");
}

/** Ausschalten: nur freiwillig (nicht, wenn verlangt), mit Passwort und aktuellem Code. */
export async function disableTotp(userId: string, password: string, code: string) {
  const u = await loadUser(userId);
  if (!u.totpSecret) throw new ApiError(409, "totp_not_enabled");
  if (await totpRequiredFor(u)) throw new ApiError(403, "totp_required");
  await checkPassword(u, password);
  await verifyCode(u, code);
  await clearTotp(u.id);
}

export async function regenerateRecoveryCodes(userId: string, password: string): Promise<{ recoveryCodes: string[] }> {
  const u = await loadUser(userId);
  if (!u.totpSecret) throw new ApiError(409, "totp_not_enabled");
  await checkPassword(u, password);
  return { recoveryCodes: await replaceRecoveryCodes(u.id) };
}

async function clearTotp(userId: string) {
  await getDb().transaction(async (tx) => {
    await tx.delete(recoveryCodes).where(eq(recoveryCodes.userId, userId));
    await tx
      .update(users)
      .set({ totpSecret: null, totpPendingSecret: null, totpEnabledAt: null, totpLastStep: null, totpFailedAttempts: 0, totpLockedUntil: null })
      .where(eq(users.id, userId));
  });
}

/** Admin: TOTP zurücksetzen (z. B. Gerät verloren). Alle Sitzungen enden. */
export async function resetTotp(userId: string) {
  await clearTotp(userId);
  const { clearPasskeys } = await import("./passkeys");
  await clearPasskeys(userId);
  await endSessions(userId);
}
