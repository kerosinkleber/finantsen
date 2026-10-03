import { createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { hash, verify } from "@node-rs/argon2";
import { and, eq, gt, sql } from "drizzle-orm";
import { getDb } from "./db";
import { env } from "./env";
import { sessions, users } from "./schema";

export const SESSION_COOKIE = "fs_session";
const SESSION_DAYS = 30;

export type SessionUser = { id: string; email: string; name: string; isAdmin: boolean; locale: string };

const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");

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
  if (!token) return null;
  const rows = await getDb()
    .select({ id: users.id, email: users.email, name: users.name, isAdmin: users.isAdmin, locale: users.locale })
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.userId))
    .where(and(eq(sessions.id, sha256(token)), gt(sessions.expiresAt, sql`now()`)))
    .limit(1);
  return rows[0] ?? null;
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
