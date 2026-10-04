import { randomBytes } from "node:crypto";
import { and, asc, count, eq, isNull, ne, sql, gt } from "drizzle-orm";
import { getDb, type Tx } from "../db";
import { env } from "../env";
import { sessions, userTokens, users } from "../schema";
import { ApiError } from "../http";
import { endSessions, hashPassword, sha256, verifyPassword, type SessionUser } from "../auth";
import { passwordIssues } from "@/lib/password";
import { allowDuplicateEmails, linkValidityHours, registrationEnabled } from "./settings";

type UserRow = typeof users.$inferSelect;

/** Alle Kontoanlagen laufen unter diesem Lock (Eindeutigkeit, letzter Admin, Ersteinrichtung). */
const ACCOUNT_LOCK = 727001;
const lock = (tx: Tx) => tx.execute(sql`select pg_advisory_xact_lock(${ACCOUNT_LOCK})`);

function isUniqueViolation(e: unknown): boolean {
  const x = e as { code?: string; cause?: { code?: string } };
  return x?.code === "23505" || x?.cause?.code === "23505";
}

export function assertPassword(pw: string, identity: { username?: string | null; email?: string | null }) {
  const issues = passwordIssues(pw, identity);
  if (issues.length) throw new ApiError(400, "password_policy", "password_policy", { issues });
}

export function requireAdmin(actor: SessionUser) {
  if (!actor.isAdmin) throw new ApiError(403, "forbidden");
}

// ---------------------------------------------------------------- Einrichtung

export async function needsSetup(): Promise<boolean> {
  const [{ n }] = await getDb().select({ n: count() }).from(users);
  return n === 0;
}

type NewUser = { name: string; username: string; email?: string; password?: string };

async function insertUser(
  tx: Tx,
  u: NewUser & { passwordHash: string | null; status: string; isAdmin: boolean; mustChangePassword: boolean },
): Promise<UserRow> {
  if (u.email && !(await allowDuplicateEmails())) {
    const [dup] = await tx.select({ id: users.id }).from(users).where(sql`lower(${users.email}) = ${u.email.toLowerCase()}`).limit(1);
    if (dup) throw new ApiError(409, "email_taken");
  }
  try {
    const [row] = await tx
      .insert(users)
      .values({
        username: u.username.trim().toLowerCase(),
        name: u.name,
        email: u.email ?? null,
        passwordHash: u.passwordHash,
        status: u.status,
        isAdmin: u.isAdmin,
        mustChangePassword: u.mustChangePassword,
        passwordChangedAt: u.passwordHash ? new Date() : null,
        locale: env.defaultLocale,
      })
      .returning();
    return row;
  } catch (e) {
    if (isUniqueViolation(e)) throw new ApiError(409, "username_taken");
    throw e;
  }
}

/** Legt den ersten Admin an. Nur möglich, solange es noch kein Konto gibt. */
export async function setupAdmin(input: Required<Pick<NewUser, "name" | "username" | "password">> & { email?: string }) {
  assertPassword(input.password, input);
  const passwordHash = await hashPassword(input.password);
  return getDb().transaction(async (tx) => {
    await lock(tx);
    const [{ n }] = await tx.select({ n: count() }).from(users);
    if (n > 0) throw new ApiError(409, "setup_done");
    return insertUser(tx, { ...input, passwordHash, status: "active", isAdmin: true, mustChangePassword: false });
  });
}

// ------------------------------------------------------------------ Anlegen

/** Selbstregistrierung: nur wenn der Admin sie aktiviert hat; das Konto wartet auf Freigabe. */
export async function registerSelf(input: Required<Pick<NewUser, "name" | "username" | "password">> & { email?: string }) {
  if (await needsSetup()) throw new ApiError(409, "setup_required");
  if (!(await registrationEnabled())) throw new ApiError(403, "registration_disabled");
  assertPassword(input.password, input);
  const passwordHash = await hashPassword(input.password);
  await getDb().transaction(async (tx) => {
    await lock(tx);
    await insertUser(tx, { ...input, passwordHash, status: "pending", isAdmin: false, mustChangePassword: false });
  });
}

export async function createUserByAdmin(
  actor: SessionUser,
  input: NewUser & { mode: "link" | "password"; mustChange: boolean; isAdmin: boolean },
) {
  requireAdmin(actor);
  let passwordHash: string | null = null;
  if (input.mode === "password") {
    if (!input.password) throw new ApiError(400, "password_policy", "password_policy", { issues: ["too_short"] });
    assertPassword(input.password, input);
    passwordHash = await hashPassword(input.password);
  }
  const user = await getDb().transaction(async (tx) => {
    await lock(tx);
    return insertUser(tx, {
      ...input,
      passwordHash,
      status: input.mode === "password" ? "active" : "invited",
      isAdmin: input.isAdmin,
      mustChangePassword: input.mode === "password" && input.mustChange,
    });
  });
  const link = input.mode === "link" ? await issueLink(user, actor.id) : null;
  return { user: publicUser(user), link };
}

export function publicUser(u: UserRow) {
  return {
    id: u.id,
    username: u.username,
    name: u.name,
    email: u.email,
    status: u.status,
    isAdmin: u.isAdmin,
    mustChangePassword: u.mustChangePassword,
    createdAt: u.createdAt,
    lockedUntil: u.lockedUntil,
  };
}

export async function listUsers(actor: SessionUser) {
  requireAdmin(actor);
  const rows = await getDb().select().from(users).where(eq(users.kind, "user")).orderBy(asc(users.createdAt));
  return rows.map(publicUser);
}

// --------------------------------------------------------------- Einmal-Links

/**
 * Zentrale Stelle für die Zustellung von Einmal-Links. Ohne Mailserver gibt der Admin den Link weiter.
 * Später: hier E-Mail-Versand ergänzen (SMTP-Adapter), der Rest bleibt unverändert.
 */
function linkUrl(token: string) {
  return `${env.appUrl.replace(/\/$/, "")}/activate/${token}`;
}

async function issueLink(user: UserRow, createdBy: string) {
  const purpose = user.passwordHash ? "reset" : "activation";
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + (await linkValidityHours()) * 3600_000);
  await getDb().transaction(async (tx) => {
    // ältere offene Links dieses Kontos werden ungültig
    await tx.update(userTokens).set({ usedAt: new Date() }).where(and(eq(userTokens.userId, user.id), isNull(userTokens.usedAt)));
    await tx.insert(userTokens).values({ tokenHash: sha256(token), userId: user.id, purpose, expiresAt, createdBy });
  });
  return { url: linkUrl(token), expiresAt, purpose };
}

async function loadValidToken(token: string) {
  const [row] = await getDb()
    .select({ t: userTokens, u: users })
    .from(userTokens)
    .innerJoin(users, eq(users.id, userTokens.userId))
    .where(and(eq(userTokens.tokenHash, sha256(token)), isNull(userTokens.usedAt), gt(userTokens.expiresAt, sql`now()`)))
    .limit(1);
  // Gesperrte oder auf Freigabe wartende Konten können Links nicht einlösen
  if (!row || row.u.kind !== "user" || !["active", "invited"].includes(row.u.status)) return null;
  return row;
}

export async function peekLink(token: string) {
  const r = await loadValidToken(token);
  return r ? { purpose: r.t.purpose, username: r.u.username, name: r.u.name } : null;
}

/** Löst einen Einmal-Link ein: Passwort setzen, Konto aktivieren, alle Sitzungen beenden. */
export async function redeemLink(token: string, password: string): Promise<UserRow> {
  const r = await loadValidToken(token);
  if (!r) throw new ApiError(410, "link_invalid");
  assertPassword(password, r.u);
  const passwordHash = await hashPassword(password);
  const user = await getDb().transaction(async (tx) => {
    const used = await tx
      .update(userTokens)
      .set({ usedAt: new Date() })
      .where(and(eq(userTokens.tokenHash, sha256(token)), isNull(userTokens.usedAt), gt(userTokens.expiresAt, sql`now()`)))
      .returning({ h: userTokens.tokenHash });
    if (used.length === 0) throw new ApiError(410, "link_invalid"); // parallel schon eingelöst
    const [u] = await tx
      .update(users)
      .set({ passwordHash, status: "active", mustChangePassword: false, passwordChangedAt: new Date(), failedAttempts: 0, lockedUntil: null })
      .where(eq(users.id, r.u.id))
      .returning();
    return u;
  });
  await endSessions(user.id);
  return user;
}

// ------------------------------------------------------------------- Anmeldung

/** Wartezeit nach Fehlversuchen: ab dem 5. Versuch 30 s, dann verdoppelt, höchstens 15 Minuten. */
export function lockSeconds(failedAttempts: number): number {
  if (failedAttempts < 5) return 0;
  return Math.min(30 * 2 ** (failedAttempts - 5), 900);
}

export type AuthResult =
  | { kind: "invalid" }
  | { kind: "locked"; retryAfter: number }
  | { kind: "blocked"; reason: "pending" | "disabled" }
  | { kind: "ok"; matches: UserRow[] };

let dummyHash: Promise<string> | undefined;

/**
 * Prüft Nutzername oder E-Mail plus Passwort. Über die E-Mail können (wenn der Admin Duplikate erlaubt)
 * mehrere Konten passen: dann werden alle mit passendem Passwort zurückgegeben. Fehlversuche führen
 * pro Konto zu zunehmender Wartezeit. Gesperrte/wartende Konten werden erst nach korrektem Passwort benannt.
 */
export async function authenticate(identifier: string, password: string): Promise<AuthResult> {
  const id = identifier.trim().toLowerCase();
  const db = getDb();
  const rows = await db
    .select()
    .from(users)
    .where(and(eq(users.kind, "user"), id.includes("@") ? sql`lower(${users.email}) = ${id}` : eq(users.username, id)))
    .orderBy(asc(users.createdAt));
  const candidates = rows.filter((u) => u.passwordHash);
  if (candidates.length === 0) {
    dummyHash ??= hashPassword("dummy-password");
    await verifyPassword(await dummyHash, password);
    return { kind: "invalid" };
  }
  const now = Date.now();
  let retryAfter = 0;
  const matches: UserRow[] = [];
  for (const u of candidates) {
    if (u.lockedUntil && u.lockedUntil.getTime() > now) {
      retryAfter = Math.max(retryAfter, Math.ceil((u.lockedUntil.getTime() - now) / 1000));
      continue;
    }
    if (await verifyPassword(u.passwordHash!, password)) {
      matches.push(u);
      if (u.failedAttempts > 0 || u.lockedUntil) await db.update(users).set({ failedAttempts: 0, lockedUntil: null }).where(eq(users.id, u.id));
    } else {
      const failed = u.failedAttempts + 1;
      const secs = lockSeconds(failed);
      await db
        .update(users)
        .set({ failedAttempts: failed, lockedUntil: secs ? new Date(Date.now() + secs * 1000) : null })
        .where(eq(users.id, u.id));
    }
  }
  if (matches.length === 0) return retryAfter > 0 ? { kind: "locked", retryAfter } : { kind: "invalid" };
  const active = matches.filter((m) => m.status === "active");
  if (active.length > 0) return { kind: "ok", matches: active };
  return { kind: "blocked", reason: matches[0].status === "pending" ? "pending" : "disabled" };
}

// ------------------------------------------------------------------- Passwort

export async function changePassword(userId: string, current: string, next: string, keepSessionId: string | null) {
  const [u] = await getDb().select().from(users).where(eq(users.id, userId));
  if (!u || u.kind !== "user" || !u.passwordHash) throw new ApiError(401, "unauthorized");
  if (!(await verifyPassword(u.passwordHash, current))) throw new ApiError(403, "invalid_credentials");
  if (await verifyPassword(u.passwordHash, next)) throw new ApiError(400, "password_same");
  assertPassword(next, u);
  const passwordHash = await hashPassword(next);
  await getDb()
    .update(users)
    .set({ passwordHash, mustChangePassword: false, passwordChangedAt: new Date(), failedAttempts: 0, lockedUntil: null })
    .where(eq(users.id, userId));
  await endSessions(userId, keepSessionId);
}

export async function setLocale(userId: string, locale: "de" | "en") {
  await getDb().update(users).set({ locale }).where(eq(users.id, userId));
}

// ------------------------------------------------------------ Admin-Aktionen

async function target(tx: Tx, id: string): Promise<UserRow> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) throw new ApiError(404, "not_found");
  const [u] = await tx.select().from(users).where(eq(users.id, id));
  // Testnutzer haben kein Passwort/Login und werden über die Testnutzer-Verwaltung gesteuert
  if (!u || u.kind !== "user") throw new ApiError(404, "not_found");
  return u;
}

async function otherActiveAdmins(tx: Tx, exceptId: string): Promise<number> {
  const [{ n }] = await tx
    .select({ n: count() })
    .from(users)
    .where(and(eq(users.isAdmin, true), eq(users.status, "active"), ne(users.id, exceptId)));
  return n;
}

export type AdminAction =
  | { action: "approve" | "disable" | "enable" | "makeAdmin" | "removeAdmin" | "link" }
  | { action: "setPassword"; password: string; mustChange: boolean };

export async function adminAction(actor: SessionUser, userId: string, a: AdminAction) {
  requireAdmin(actor);
  if (a.action === "link") {
    const u = await getDb().transaction((tx) => target(tx, userId));
    if (!["active", "invited"].includes(u.status)) throw new ApiError(409, "invalid_state");
    return { link: await issueLink(u, actor.id) };
  }
  let passwordHash: string | null = null;
  if (a.action === "setPassword") {
    const u = await getDb().transaction((tx) => target(tx, userId));
    assertPassword(a.password, u);
    passwordHash = await hashPassword(a.password);
  }
  const updated = await getDb().transaction(async (tx) => {
    await lock(tx);
    const u = await target(tx, userId);
    const set = (v: Partial<typeof users.$inferInsert>) => tx.update(users).set(v).where(eq(users.id, u.id)).returning();
    switch (a.action) {
      case "approve":
        if (u.status !== "pending") throw new ApiError(409, "invalid_state");
        return (await set({ status: "active" }))[0];
      case "disable":
        if (u.id === actor.id) throw new ApiError(400, "cannot_disable_self");
        if (u.isAdmin && u.status === "active" && (await otherActiveAdmins(tx, u.id)) === 0) throw new ApiError(409, "last_admin");
        return (await set({ status: "disabled" }))[0];
      case "enable":
        if (u.status !== "disabled") throw new ApiError(409, "invalid_state");
        return (await set({ status: u.passwordHash ? "active" : "invited" }))[0];
      case "makeAdmin":
        return (await set({ isAdmin: true }))[0];
      case "removeAdmin":
        if (u.isAdmin && u.status === "active" && (await otherActiveAdmins(tx, u.id)) === 0) throw new ApiError(409, "last_admin");
        return (await set({ isAdmin: false }))[0];
      case "setPassword":
        // Ein auf Aktivierung wartendes Konto wird durch ein gesetztes Passwort aktiv
        return (
          await set({
            passwordHash,
            mustChangePassword: a.mustChange,
            passwordChangedAt: new Date(),
            failedAttempts: 0,
            lockedUntil: null,
            ...(u.status === "invited" ? { status: "active" } : {}),
          })
        )[0];
      default:
        throw new ApiError(400, "validation");
    }
  });
  if (a.action === "disable" || a.action === "setPassword") await endSessions(updated.id);
  if (a.action === "setPassword" || a.action === "disable") {
    await getDb().update(userTokens).set({ usedAt: new Date() }).where(and(eq(userTokens.userId, updated.id), isNull(userTokens.usedAt)));
  }
  return { user: publicUser(updated) };
}

/** Für Tests/Statistik: aktive Sitzungen eines Nutzers. */
export async function sessionCount(userId: string) {
  const [{ n }] = await getDb().select({ n: count() }).from(sessions).where(eq(sessions.userId, userId));
  return n;
}
