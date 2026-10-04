import { and, asc, eq, inArray, like, sql } from "drizzle-orm";
import { getDb, type Tx } from "../db";
import { env } from "../env";
import { groupMembers, groups, users } from "../schema";
import { ApiError } from "../http";
import { setActingAs, type SessionUser } from "../auth";
import { groupBalances } from "./balances";
import { testFeaturesEnabled } from "./settings";

/**
 * Admin-Testfunktionen. Testnutzer sind eigene Konten (`kind = 'test'`): kein Passwort, kein Login, kein
 * Einmal-Link, nie Admin. Sie werden ausschließlich von einem echten Admin gesteuert ("Handeln als").
 */

const LOCK = 727001; // gleicher Lock wie Kontoanlage (Eindeutigkeit der Nutzernamen)
const lock = (tx: Tx) => tx.execute(sql`select pg_advisory_xact_lock(${LOCK})`);
const uuidRe = /^[0-9a-f-]{36}$/i;

/** Nur echte Admins (nicht im „Handeln als“-Modus) und nur bei eingeschalteten Testfunktionen. */
export async function requireTestAdmin(actor: SessionUser) {
  if (!actor.isAdmin || actor.impersonating) throw new ApiError(403, "forbidden");
  if (!(await testFeaturesEnabled())) throw new ApiError(403, "test_features_disabled");
}

async function loadTestUser(db: Tx | ReturnType<typeof getDb>, id: string) {
  if (!uuidRe.test(id)) throw new ApiError(404, "not_found");
  const [u] = await db.select().from(users).where(and(eq(users.id, id), eq(users.kind, "test")));
  if (!u) throw new ApiError(404, "not_found"); // echte Konten sind hier nie erreichbar
  return u;
}

function isUnique(e: unknown) {
  const x = e as { code?: string; cause?: { code?: string } };
  return x?.code === "23505" || x?.cause?.code === "23505";
}

async function insertTest(tx: Tx, name: string, username: string) {
  try {
    const [u] = await tx
      .insert(users)
      .values({ username: username.trim().toLowerCase(), name, kind: "test", status: "active", passwordHash: null, isAdmin: false, locale: env.defaultLocale })
      .returning();
    return u;
  } catch (e) {
    if (isUnique(e)) throw new ApiError(409, "username_taken");
    throw e;
  }
}

// ----------------------------------------------------------------- Liste/Anlegen

export async function listTestUsers(actor: SessionUser) {
  await requireTestAdmin(actor);
  const rows = await getDb().select().from(users).where(eq(users.kind, "test")).orderBy(asc(users.createdAt));
  const counts = rows.length
    ? await getDb()
        .select({ userId: groupMembers.userId, n: sql<number>`count(*)::int` })
        .from(groupMembers)
        .where(inArray(groupMembers.userId, rows.map((r) => r.id)))
        .groupBy(groupMembers.userId)
    : [];
  return rows.map((u) => ({ id: u.id, name: u.name, username: u.username, locale: u.locale, groupCount: counts.find((c) => c.userId === u.id)?.n ?? 0 }));
}

/** Legt `count` Testnutzer (test-1, test-2, …, fortlaufend) oder einen einzelnen mit eigenem Namen an. */
export async function createTestUsers(actor: SessionUser, input: { count: number } | { name: string; username: string }) {
  await requireTestAdmin(actor);
  return getDb().transaction(async (tx) => {
    await lock(tx);
    if ("name" in input) return [await insertTest(tx, input.name, input.username)];
    const existing = await tx.select({ u: users.username }).from(users).where(like(users.username, "test-%"));
    let next = existing.reduce((m, r) => Math.max(m, Number(/^test-(\d+)$/.exec(r.u)?.[1] ?? 0)), 0) + 1;
    const out = [];
    for (let i = 0; i < input.count; i++, next++) out.push(await insertTest(tx, `Test ${next}`, `test-${next}`));
    return out;
  });
}

export async function updateTestUser(actor: SessionUser, id: string, data: { name?: string; username?: string; locale?: "de" | "en" }) {
  await requireTestAdmin(actor);
  await loadTestUser(getDb(), id);
  try {
    const [u] = await getDb()
      .update(users)
      .set({ ...(data.name ? { name: data.name } : {}), ...(data.username ? { username: data.username.trim().toLowerCase() } : {}), ...(data.locale ? { locale: data.locale } : {}) })
      .where(eq(users.id, id))
      .returning();
    return u;
  } catch (e) {
    if (isUnique(e)) throw new ApiError(409, "username_taken");
    throw e;
  }
}

// -------------------------------------------------------------------- Detail

type MemberInfo = { id: string; name: string; isTest: boolean };

async function membersByGroup(groupIds: string[]) {
  if (groupIds.length === 0) return new Map<string, MemberInfo[]>();
  const rows = await getDb()
    .select({ groupId: groupMembers.groupId, id: users.id, name: users.name, kind: users.kind })
    .from(groupMembers)
    .innerJoin(users, eq(users.id, groupMembers.userId))
    .where(inArray(groupMembers.groupId, groupIds));
  const m = new Map<string, MemberInfo[]>();
  for (const r of rows) m.set(r.groupId, [...(m.get(r.groupId) ?? []), { id: r.id, name: r.name, isTest: r.kind === "test" }]);
  return m;
}

/** Echte Mitglieder außer dem Admin selbst (für die Warnung beim Hinzufügen). */
const realOthers = (members: MemberInfo[], adminId: string) => members.filter((m) => !m.isTest && m.id !== adminId);

export async function getTestUserDetail(actor: SessionUser, id: string) {
  await requireTestAdmin(actor);
  const db = getDb();
  const u = await loadTestUser(db, id);
  const mine = await db
    .select({ g: groups, role: groupMembers.role })
    .from(groupMembers)
    .innerJoin(groups, eq(groups.id, groupMembers.groupId))
    .where(eq(groupMembers.userId, id))
    .orderBy(asc(groups.createdAt));
  const allGroups = await db.select().from(groups).where(eq(groups.kind, "group")).orderBy(asc(groups.name));
  const members = await membersByGroup([...new Set([...mine.map((m) => m.g.id), ...allGroups.map((g) => g.id)])]);

  const memberships = mine.map(({ g, role }) => {
    const ms = members.get(g.id) ?? [];
    const other = ms.find((m) => m.id !== id);
    return {
      groupId: g.id,
      kind: g.kind,
      name: g.kind === "direct" ? (other ? (other.isTest ? `${other.name} (Test)` : other.name) : "—") : g.name,
      role,
      members: ms.map((m) => ({ id: m.id, name: m.isTest ? `${m.name} (Test)` : m.name, isTest: m.isTest })),
      hasRealMembers: realOthers(ms, actor.id).length > 0,
    };
  });
  const memberOf = new Set(mine.map((m) => m.g.id));
  // Datenschutz: nur Gruppen, in denen der Admin selbst Mitglied ist, und reine Testnutzer-Gruppen
  const addableGroups = allGroups
    .filter((g) => !memberOf.has(g.id))
    .filter((g) => {
      const ms = members.get(g.id) ?? [];
      return ms.some((m) => m.id === actor.id) || (ms.length > 0 && ms.every((m) => m.isTest));
    })
    .map((g) => ({ id: g.id, name: g.name, hasRealMembers: realOthers(members.get(g.id) ?? [], actor.id).length > 0 }));

  const friendIds = new Set<string>();
  for (const m of memberships) if (m.kind === "direct") m.members.forEach((x) => friendIds.add(x.id));
  const everyone = await db.select().from(users).where(eq(users.status, "active")).orderBy(asc(users.name));
  const friendCandidates = everyone
    .filter((o) => o.id !== id && !friendIds.has(o.id))
    .map((o) => ({ id: o.id, name: o.kind === "test" ? `${o.name} (Test)` : o.name, isTest: o.kind === "test", isYou: o.id === actor.id }));

  return { user: { id: u.id, name: u.name, username: u.username, locale: u.locale }, memberships, addableGroups, friendCandidates };
}

// ---------------------------------------------------------------- Mitgliedschaften

type Confirm = { confirmed?: boolean };

function needsConfirmation(names: string[]): never {
  throw new ApiError(409, "needs_confirmation", "needs_confirmation", { realMembers: [...names].sort() });
}

export async function addToGroup(actor: SessionUser, testUserId: string, groupId: string, opts: { role: "owner" | "member" } & Confirm) {
  await requireTestAdmin(actor);
  const db = getDb();
  await loadTestUser(db, testUserId);
  if (!uuidRe.test(groupId)) throw new ApiError(404, "not_found");
  const [g] = await db.select().from(groups).where(eq(groups.id, groupId));
  if (!g || g.kind !== "group") throw new ApiError(404, "not_found");
  const ms = (await membersByGroup([groupId])).get(groupId) ?? [];
  // dieselbe Datenschutz-Regel wie in der Auswahlliste
  if (!(ms.some((m) => m.id === actor.id) || (ms.length > 0 && ms.every((m) => m.isTest)))) throw new ApiError(404, "not_found");
  if (ms.some((m) => m.id === testUserId)) throw new ApiError(409, "already_member");
  const real = realOthers(ms, actor.id);
  if (real.length > 0 && !opts.confirmed) needsConfirmation(real.map((m) => m.name));
  await db.insert(groupMembers).values({ groupId, userId: testUserId, role: opts.role });
}

async function ownersOf(tx: Tx, groupId: string) {
  return tx.select({ userId: groupMembers.userId }).from(groupMembers).where(and(eq(groupMembers.groupId, groupId), eq(groupMembers.role, "owner")));
}

export async function setGroupRole(actor: SessionUser, testUserId: string, groupId: string, role: "owner" | "member") {
  await requireTestAdmin(actor);
  await getDb().transaction(async (tx) => {
    await lock(tx);
    await loadTestUser(tx, testUserId);
    const [m] = await tx.select().from(groupMembers).where(and(eq(groupMembers.groupId, groupId), eq(groupMembers.userId, testUserId)));
    if (!m) throw new ApiError(404, "not_found");
    if (m.role === "owner" && role === "member" && (await ownersOf(tx, groupId)).length <= 1) throw new ApiError(409, "last_owner");
    await tx.update(groupMembers).set({ role }).where(and(eq(groupMembers.groupId, groupId), eq(groupMembers.userId, testUserId)));
  });
}

/** Entfernt den Testnutzer aus einer Gruppe, auch mit offenem Saldo, aber nur nach Bestätigung. Ausgaben bleiben erhalten. */
export async function removeFromGroup(actor: SessionUser, testUserId: string, groupId: string, opts: Confirm = {}) {
  await requireTestAdmin(actor);
  const db = getDb();
  await loadTestUser(db, testUserId);
  const [g] = uuidRe.test(groupId) ? await db.select().from(groups).where(eq(groups.id, groupId)) : [];
  const [m] = g ? await db.select().from(groupMembers).where(and(eq(groupMembers.groupId, groupId), eq(groupMembers.userId, testUserId))) : [];
  if (!g || !m) throw new ApiError(404, "not_found");
  if (!opts.confirmed) {
    const { net } = await groupBalances(groupId);
    const open = Object.entries(net).filter(([, byUser]) => byUser[testUserId]);
    if (open.length > 0) throw new ApiError(409, "balance_not_zero", "balance_not_zero", { needsConfirmation: true });
  }
  await db.transaction(async (tx) => {
    await lock(tx);
    const others = await tx.select({ userId: groupMembers.userId, joinedAt: groupMembers.joinedAt }).from(groupMembers).where(and(eq(groupMembers.groupId, groupId), sql`${groupMembers.userId} <> ${testUserId}`)).orderBy(asc(groupMembers.joinedAt));
    if (g.kind === "group" && others.length === 0) throw new ApiError(409, "last_member");
    if (g.kind === "group" && m.role === "owner" && (await ownersOf(tx, groupId)).length <= 1) {
      await tx.update(groupMembers).set({ role: "owner" }).where(and(eq(groupMembers.groupId, groupId), eq(groupMembers.userId, others[0].userId)));
    }
    await tx.delete(groupMembers).where(and(eq(groupMembers.groupId, groupId), eq(groupMembers.userId, testUserId)));
  });
}

/** Freundschaft = Direktgruppe mit genau zwei Personen. Gegenüber: anderer Testnutzer, der Admin oder (mit Warnung) ein echtes Konto. */
export async function addFriend(actor: SessionUser, testUserId: string, otherId: string, opts: Confirm = {}) {
  await requireTestAdmin(actor);
  const db = getDb();
  await loadTestUser(db, testUserId);
  if (!uuidRe.test(otherId) || otherId === testUserId) throw new ApiError(404, "not_found");
  const [other] = await db.select().from(users).where(and(eq(users.id, otherId), eq(users.status, "active")));
  if (!other) throw new ApiError(404, "not_found");
  if (other.kind === "user" && other.id !== actor.id && !opts.confirmed) needsConfirmation([other.name]);
  await db.transaction(async (tx) => {
    await lock(tx);
    const existing = await tx.execute(sql`
      select g.id from groups g
      join group_members a on a.group_id = g.id and a.user_id = ${testUserId}
      join group_members b on b.group_id = g.id and b.user_id = ${otherId}
      where g.kind = 'direct' limit 1`);
    if (existing.length > 0) throw new ApiError(409, "already_friends");
    const [g] = await tx.insert(groups).values({ name: "direct", kind: "direct", defaultCurrency: "EUR", createdBy: testUserId }).returning();
    await tx.insert(groupMembers).values([
      { groupId: g.id, userId: testUserId, role: "owner" },
      { groupId: g.id, userId: otherId, role: "member" },
    ]);
  });
}

// ---------------------------------------------------------------------- Löschen

/**
 * Löscht einen Testnutzer. Gruppen, an denen nur Testnutzer beteiligt sind, werden samt Ausgaben und
 * Zahlungen mitgelöscht. Hängen Daten des Testnutzers in einer Gruppe mit einem echten Nutzer, wird NICHTS
 * gelöscht (409 mit Liste dieser Gruppen). Bloße Mitgliedschaften (auch als Ersteller einer Gruppe) ohne Daten
 * werden aufgelöst; der Ersteller-Verweis geht dann auf ein anderes Mitglied über.
 */
export async function deleteTestUser(actor: SessionUser, id: string) {
  await requireTestAdmin(actor);
  const db = getDb();
  const u = await loadTestUser(db, id);

  const rowsOf = async (q: ReturnType<typeof sql>) => (await db.execute(q)) as unknown as Record<string, string>[];
  const dataGroups = new Set(
    (
      await rowsOf(sql`
        select group_id as g from expenses where created_by = ${id}
        union select e.group_id from expense_payers p join expenses e on e.id = p.expense_id where p.user_id = ${id}
        union select e.group_id from expense_shares p join expenses e on e.id = p.expense_id where p.user_id = ${id}
        union select group_id from payments where from_user = ${id} or to_user = ${id} or created_by = ${id}
        union select e.group_id from expense_comments c join expenses e on e.id = c.expense_id where c.user_id = ${id}
        union select e.group_id from expense_history h join expenses e on e.id = h.expense_id where h.user_id = ${id}
        union select group_id from invites where created_by = ${id}`)
    ).map((r) => r.g),
  );
  // Gruppen ohne Daten des Testnutzers: Mitgliedschaft lösen und Ersteller-Verweis auf ein anderes Mitglied umhängen
  const touching = new Set([
    ...(await db.select({ g: groupMembers.groupId }).from(groupMembers).where(eq(groupMembers.userId, id))).map((r) => r.g),
    ...(await db.select({ g: groups.id }).from(groups).where(eq(groups.createdBy, id))).map((r) => r.g),
  ]);
  const memberOnly = [...touching].filter((g) => !dataGroups.has(g));

  // Welche echten Nutzer sind in den Daten-Gruppen beteiligt?
  const blocked: { id: string; name: string; users: string[] }[] = [];
  if (dataGroups.size > 0) {
    const ids = [...dataGroups];
    const list = sql.join(ids.map((x) => sql`${x}::uuid`), sql`, `);
    const involved = await rowsOf(sql`
      select x.g, usr.name from (
        select group_id g, user_id u from group_members where group_id in (${list})
        union select id, created_by from groups where id in (${list})
        union select group_id, created_by from expenses where group_id in (${list})
        union select e.group_id, p.user_id from expense_payers p join expenses e on e.id = p.expense_id where e.group_id in (${list})
        union select e.group_id, p.user_id from expense_shares p join expenses e on e.id = p.expense_id where e.group_id in (${list})
        union select group_id, from_user from payments where group_id in (${list})
        union select group_id, to_user from payments where group_id in (${list})
        union select group_id, created_by from payments where group_id in (${list})
        union select e.group_id, c.user_id from expense_comments c join expenses e on e.id = c.expense_id where e.group_id in (${list})
        union select e.group_id, h.user_id from expense_history h join expenses e on e.id = h.expense_id where e.group_id in (${list})
        union select group_id, created_by from invites where group_id in (${list})
      ) x join users usr on usr.id = x.u where usr.kind <> 'test'`);
    const names = await db.select({ id: groups.id, name: groups.name, kind: groups.kind }).from(groups).where(inArray(groups.id, ids));
    for (const g of names) {
      const real = [...new Set(involved.filter((r) => r.g === g.id).map((r) => r.name))];
      if (real.length > 0) blocked.push({ id: g.id, name: g.kind === "direct" ? "(Freundschaft)" : g.name, users: real });
    }
  }
  if (blocked.length > 0) throw new ApiError(409, "test_user_in_real_group", "test_user_in_real_group", { groups: blocked });

  await db.transaction(async (tx) => {
    await lock(tx);
    if (dataGroups.size > 0) await tx.delete(groups).where(inArray(groups.id, [...dataGroups])); // kaskadiert auf Ausgaben, Zahlungen, …
    for (const gid of memberOnly) {
      const others = await tx.select({ userId: groupMembers.userId }).from(groupMembers).where(and(eq(groupMembers.groupId, gid), sql`${groupMembers.userId} <> ${id}`)).orderBy(asc(groupMembers.joinedAt));
      await tx.delete(groupMembers).where(and(eq(groupMembers.groupId, gid), eq(groupMembers.userId, id)));
      if (others.length > 0) await tx.update(groups).set({ createdBy: others[0].userId }).where(and(eq(groups.id, gid), eq(groups.createdBy, id)));
      if (others.length === 0) {
        await tx.delete(groups).where(eq(groups.id, gid)); // leere Gruppe ohne Daten
      } else if ((await ownersOf(tx, gid)).length === 0) {
        await tx.update(groupMembers).set({ role: "owner" }).where(and(eq(groupMembers.groupId, gid), eq(groupMembers.userId, others[0].userId)));
      }
    }
    await tx.delete(users).where(and(eq(users.id, id), eq(users.kind, "test")));
  });
  return { deleted: u.username };
}

// ----------------------------------------------------------------- Handeln als

export async function startActingAs(actor: SessionUser, testUserId: string, sessionId?: string | null) {
  await requireTestAdmin(actor);
  const u = await loadTestUser(getDb(), testUserId);
  await setActingAs(u.id, sessionId);
  return { id: u.id, name: u.name };
}

export async function stopActingAs(actor: SessionUser, sessionId?: string | null) {
  if (!actor.impersonating) return;
  await setActingAs(null, sessionId);
}
