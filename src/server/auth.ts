import { createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { hash, verify } from "@node-rs/argon2";
import { and, eq, gt, ne, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { getDb } from "./db";
import { env } from "./env";
import { sessions, users } from "./schema";

export const SESSION_COOKIE = "fs_session";
const SESSION_DAYS = 30;

export type SessionUser = {
  /** Effektive Identität: bei „Handeln als“ der Testnutzer, sonst der angemeldete Nutzer */
  id: string;
  username: string;
  email: string | null;
  name: string;
  /** Effektiv: ein Testnutzer ist nie Admin, auch wenn ein Admin als er handelt */
  isAdmin: boolean;
  locale: string;
  kind: "user" | "test";
  /** Muss vor allem anderen sein Passwort ändern (gilt für das echte Konto) */
  mustChangePassword: boolean;
  /** Der angemeldete (echte) Nutzer; entspricht dem effektiven Nutzer, wenn niemand als Testnutzer handelt */
  real: { id: string; name: string; isAdmin: boolean };
  /** Ein Admin handelt gerade als Testnutzer */
  impersonating: boolean;
};

export const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");

export const hashPassword = (pw: string) => hash(pw); // argon2id, sichere Defaults
export const verifyPassword = (h: string, pw: string) => verify(h, pw).catch(() => false);

export async function createSession(userId: string) {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 86400_000);
  await getDb().insert(sessions).values({ id: sha256(token), userId, expiresAt });
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: env.secureCookies,
    path: "/",
    expires: expiresAt,
  });
}

export async function destroySession() {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) await getDb().delete(sessions).where(eq(sessions.id, sha256(token)));
  jar.delete(SESSION_COOKIE);
}

export async function getCurrentUser(): Promise<SessionUser | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  return token ? resolveSession(token) : null;
}

/** Löst ein Sitzungs-Token in die effektive Identität auf (ohne Cookies, damit testbar). */
export async function resolveSession(token: string): Promise<SessionUser | null> {
  const acting = alias(users, "acting");
  const rows = await getDb()
    .select({ real: users, acting })
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.userId))
    .leftJoin(acting, eq(acting.id, sessions.actingAsUserId))
    .where(and(eq(sessions.id, sha256(token)), gt(sessions.expiresAt, sql`now()`), eq(users.status, "active"), eq(users.kind, "user")))
    .limit(1);
  const r = rows[0];
  if (!r) return null;
  const real = { id: r.real.id, name: r.real.name, isAdmin: r.real.isAdmin };
  // „Handeln als“ gilt nur für Testnutzer und nur, solange das echte Konto Admin ist und die Testfunktionen an sind.
  let eff = r.real;
  let impersonating = false;
  if (r.acting && r.acting.kind === "test" && r.real.isAdmin) {
    const { testFeaturesEnabled } = await import("./services/settings");
    if (await testFeaturesEnabled()) {
      eff = r.acting;
      impersonating = true;
    }
  }
  return {
    id: eff.id,
    username: eff.username,
    email: eff.email,
    name: eff.name,
    isAdmin: impersonating ? false : eff.isAdmin,
    locale: eff.locale,
    kind: eff.kind as "user" | "test",
    mustChangePassword: r.real.mustChangePassword,
    real,
    impersonating,
  };
}

/** Admin beginnt (userId) oder beendet (null) „Handeln als“ in der aktuellen (oder angegebenen) Sitzung. */
export async function setActingAs(userId: string | null, sessionId?: string | null) {
  const id = sessionId ?? (await currentSessionId());
  if (!id) return;
  await getDb().update(sessions).set({ actingAsUserId: userId }).where(eq(sessions.id, id));
}

/** Hash der aktuellen Sitzung (um beim Passwortwechsel alle anderen zu beenden). */
export async function currentSessionId(): Promise<string | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  return token ? sha256(token) : null;
}

/** Beendet alle Sitzungen eines Nutzers, optional außer einer. */
export async function endSessions(userId: string, exceptSessionId?: string | null) {
  await getDb()
    .delete(sessions)
    .where(exceptSessionId ? and(eq(sessions.userId, userId), ne(sessions.id, exceptSessionId)) : eq(sessions.userId, userId));
}

/** Sehr einfacher In-Memory-Limiter gegen Brute Force (pro Prozess). */
const attempts = new Map<string, { n: number; reset: number }>();
export function rateLimit(key: string, max = 10, windowMs = 15 * 60_000): boolean {
  const now = Date.now();
  const a = attempts.get(key);
  if (!a || a.reset < now) {
    attempts.set(key, { n: 1, reset: now + windowMs });
    return true;
  }
  a.n++;
  return a.n <= max;
}
export function clearRateLimit(key: string) {
  attempts.delete(key);
}

export async function requireUser(): Promise<SessionUser> {
  const { redirect } = await import("next/navigation");
  const u = await getCurrentUser();
  if (!u) redirect("/login");
  return u as SessionUser;
}

export async function requireAdminUser(): Promise<SessionUser> {
  const { redirect } = await import("next/navigation");
  const u = await requireUser();
  if (!u.isAdmin) redirect("/");
  return u;
}

/** Legt eine Sitzung ohne Cookie an (nur für Tests); liefert das Token. */
export async function createSessionFor(userId: string) {
  const token = randomBytes(32).toString("base64url");
  await getDb().insert(sessions).values({ id: sha256(token), userId, expiresAt: new Date(Date.now() + SESSION_DAYS * 86400_000) });
  return token;
}
