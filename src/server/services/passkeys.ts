import { and, asc, count, eq, inArray, sql } from "drizzle-orm";
import { generateAuthenticationOptions, generateRegistrationOptions, verifyAuthenticationResponse, verifyRegistrationResponse } from "@simplewebauthn/server";
import type { AuthenticationResponseJSON, RegistrationResponseJSON } from "@simplewebauthn/server";
import { getDb } from "../db";
import { passkeys, users } from "../schema";
import { ApiError } from "../http";
import { verifyPassword } from "../auth";
import { hmacHex, signToken, verifyToken } from "../secrets";
import { recordFailure } from "./accounts";

type UserRow = typeof users.$inferSelect;

/** Relying Party aus der Anfrage: Domain und Origin, so wie der Browser sie sieht (Hinter Caddy: x-forwarded-*). */
export type Rp = { id: string; origin: string };
export function rpFromRequest(req: Request): Rp {
  const host = (req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? "localhost").split(",")[0].trim();
  const proto = (req.headers.get("x-forwarded-proto") ?? (host.startsWith("localhost") || host.startsWith("127.") ? "http" : "https")).split(",")[0].trim();
  return { id: host.replace(/:\d+$/, ""), origin: `${proto}://${host}` };
}

const CHALLENGE_SECONDS = 300;
const NAME = "Finantsen";

export const passkeyCount = async (userId: string): Promise<number> => {
  const [{ n }] = await getDb().select({ n: count() }).from(passkeys).where(eq(passkeys.userId, userId));
  return n;
};

async function loadUser(id: string): Promise<UserRow> {
  const [u] = await getDb().select().from(users).where(eq(users.id, id));
  if (!u || u.kind !== "user") throw new ApiError(401, "unauthorized");
  return u;
}

async function checkPassword(u: UserRow, password: string) {
  if (!u.passwordHash || !(await verifyPassword(u.passwordHash, password))) throw new ApiError(403, "wrong_password");
}

const pub = (r: typeof passkeys.$inferSelect) => ({ id: r.id, name: r.name, createdAt: r.createdAt, lastUsedAt: r.lastUsedAt });

export async function listPasskeys(userId: string) {
  const rows = await getDb().select().from(passkeys).where(eq(passkeys.userId, userId)).orderBy(asc(passkeys.createdAt));
  return rows.map(pub);
}

// ---------------------------------------------------------------- Einrichten

/** Schritt 1: nach erneuter Passworteingabe Optionen für den Browser. Die Challenge steckt signiert im Token. */
export async function registrationOptions(userId: string, password: string, rp: Rp) {
  const u = await loadUser(userId);
  await checkPassword(u, password);
  const existing = await getDb().select().from(passkeys).where(eq(passkeys.userId, u.id));
  const options = await generateRegistrationOptions({
    rpName: NAME,
    rpID: rp.id,
    userName: u.username,
    userDisplayName: u.name,
    userID: new TextEncoder().encode(u.id),
    attestationType: "none",
    excludeCredentials: existing.map((p) => ({ id: p.credentialId, transports: p.transports ? p.transports.split(",") : undefined })),
    authenticatorSelection: { residentKey: "discouraged", userVerification: "required" },
  });
  return { options, token: signToken({ t: "pk-reg", uid: u.id, ch: options.challenge }, CHALLENGE_SECONDS) };
}

/** Schritt 2: Antwort des Authenticators prüfen und speichern. */
export async function registerPasskey(userId: string, input: { token: string; response: RegistrationResponseJSON; name: string }, rp: Rp) {
  const data = verifyToken<{ t: string; uid: string; ch: string }>(input.token);
  if (!data || data.t !== "pk-reg" || data.uid !== userId) throw new ApiError(400, "challenge_invalid");
  let verified;
  try {
    verified = await verifyRegistrationResponse({
      response: input.response,
      expectedChallenge: data.ch,
      expectedOrigin: rp.origin,
      expectedRPID: rp.id,
      requireUserVerification: true,
    });
  } catch {
    throw new ApiError(400, "passkey_invalid");
  }
  if (!verified.verified) throw new ApiError(400, "passkey_invalid");
  const c = verified.registrationInfo.credential;
  const name = input.name.trim().slice(0, 60) || "Passkey";
  try {
    const [row] = await getDb()
      .insert(passkeys)
      .values({
        userId,
        credentialId: c.id,
        publicKey: Buffer.from(c.publicKey).toString("base64url"),
        counter: c.counter,
        transports: c.transports?.join(",") ?? null,
        name,
      })
      .returning();
    return pub(row);
  } catch (e) {
    const x = e as { code?: string; cause?: { code?: string } };
    if (x.code === "23505" || x.cause?.code === "23505") throw new ApiError(409, "passkey_exists");
    throw e;
  }
}

/** Löschen nur mit Passwort. */
export async function deletePasskey(userId: string, id: string, password: string) {
  const u = await loadUser(userId);
  await checkPassword(u, password);
  if (!/^[0-9a-f-]{36}$/i.test(id)) throw new ApiError(404, "not_found");
  const del = await getDb().delete(passkeys).where(and(eq(passkeys.id, id), eq(passkeys.userId, userId))).returning({ id: passkeys.id });
  if (del.length === 0) throw new ApiError(404, "not_found");
}

/** Admin: alle Passkeys eines Kontos entfernen (zusammen mit dem TOTP-Reset). */
export async function clearPasskeys(userId: string) {
  await getDb().delete(passkeys).where(eq(passkeys.userId, userId));
}

// ------------------------------------------------------------------ Anmeldung

// Sieht aus wie eine echte Credential-ID (base64url, 32 Byte), ist aber für jede Kennung fest (kein Zufall → keine Unterscheidung über Wiederholungen)
const fakeCredential = (identifier: string) => Buffer.from(hmacHex("passkey-fake", identifier.toLowerCase()), "hex").subarray(0, 32).toString("base64url");

/**
 * Optionen für die Anmeldung zu einem Nutzernamen/einer E-Mail. Die Antwort sieht für unbekannte Konten und Konten ohne
 * Passkey gleich aus (erfundene Credential-ID), damit man so nicht herausfindet, wer Passkeys hat.
 */
export async function authenticationOptions(identifier: string, rp: Rp) {
  const id = identifier.trim().toLowerCase();
  const db = getDb();
  const rows = await db
    .select({ p: passkeys })
    .from(passkeys)
    .innerJoin(users, eq(users.id, passkeys.userId))
    .where(and(eq(users.kind, "user"), eq(users.status, "active"), id.includes("@") ? sql`lower(${users.email}) = ${id}` : eq(users.username, id)));
  const allow = rows.length
    ? rows.map(({ p }) => ({ id: p.credentialId, transports: p.transports ? p.transports.split(",") : undefined }))
    : [{ id: fakeCredential(id) }];
  const options = await generateAuthenticationOptions({ rpID: rp.id, allowCredentials: allow, userVerification: "required" });
  return { options, token: signToken({ t: "pk-auth", ch: options.challenge }, CHALLENGE_SECONDS) };
}

async function registerFailure(u: UserRow): Promise<never> {
  await recordFailure(u.id, "login");
  throw new ApiError(401, "invalid_credentials");
}

/** Prüft die Antwort des Authenticators; zählt Fehlversuche auf dem Konto-Zähler (wie beim Passwort). */
export async function completePasskeyLogin(token: string, response: AuthenticationResponseJSON, rp: Rp): Promise<UserRow> {
  const data = verifyToken<{ t: string; ch: string }>(token);
  if (!data || data.t !== "pk-auth") throw new ApiError(401, "challenge_invalid");
  const [row] = await getDb()
    .select({ p: passkeys, u: users })
    .from(passkeys)
    .innerJoin(users, eq(users.id, passkeys.userId))
    .where(eq(passkeys.credentialId, response.id));
  if (!row || row.u.kind !== "user") throw new ApiError(401, "invalid_credentials");
  const u = row.u;
  if (u.lockedUntil && u.lockedUntil.getTime() > Date.now()) {
    throw new ApiError(429, "account_locked", "account_locked", { retryAfter: Math.ceil((u.lockedUntil.getTime() - Date.now()) / 1000) });
  }
  let verified;
  try {
    verified = await verifyAuthenticationResponse({
      response,
      expectedChallenge: data.ch,
      expectedOrigin: rp.origin,
      expectedRPID: rp.id,
      requireUserVerification: true,
      credential: {
        id: row.p.credentialId,
        publicKey: new Uint8Array(Buffer.from(row.p.publicKey, "base64url")),
        counter: row.p.counter,
        transports: row.p.transports ? (row.p.transports.split(",") as never) : undefined,
      },
    });
  } catch {
    return registerFailure(u);
  }
  if (!verified.verified) return registerFailure(u);
  // Status erst nach erfolgreicher Prüfung offenlegen (wie beim Passwort)
  if (u.status === "pending") throw new ApiError(403, "account_pending");
  if (u.status !== "active") throw new ApiError(403, "account_disabled");
  await getDb().update(passkeys).set({ counter: verified.authenticationInfo.newCounter, lastUsedAt: new Date() }).where(eq(passkeys.id, row.p.id));
  if (u.failedAttempts > 0 || u.lockedUntil) await getDb().update(users).set({ failedAttempts: 0, lockedUntil: null }).where(eq(users.id, u.id));
  return u;
}

/** Hat eines der Konten Passkeys? (für die Anmeldelogik) */
export async function hasPasskey(userIds: string[]): Promise<Set<string>> {
  if (userIds.length === 0) return new Set();
  const rows = await getDb().selectDistinct({ id: passkeys.userId }).from(passkeys).where(inArray(passkeys.userId, userIds));
  return new Set(rows.map((r) => r.id));
}
