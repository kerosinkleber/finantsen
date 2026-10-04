import { and, eq, inArray } from "drizzle-orm";
import { randomBytes } from "node:crypto";
import { getDb } from "../db";
import { groupMembers, groups, invites, users } from "../schema";
import { ApiError, forbidden, notFound } from "../http";
import { memberIds, requireMember } from "./access";
import type { DefaultSplit } from "@/lib/schemas";
import { groupBalances } from "./balances";

export type GroupSummary = {
  id: string;
  name: string;
  kind: string;
  defaultCurrency: string;
  role: string;
  members: { id: string; name: string; isTest: boolean }[];
  /** Anzeigename: bei Freunden der Name der anderen Person */
  displayName: string;
};

export async function listGroups(userId: string): Promise<GroupSummary[]> {
  const db = getDb();
  const mine = await db
    .select({ group: groups, role: groupMembers.role })
    .from(groupMembers)
    .innerJoin(groups, eq(groups.id, groupMembers.groupId))
    .where(eq(groupMembers.userId, userId))
    .orderBy(groups.createdAt);
  if (!mine.length) return [];
  const ids = mine.map((m) => m.group.id);
  const mem = await db
    .select({ groupId: groupMembers.groupId, id: users.id, name: users.name, kind: users.kind })
    .from(groupMembers)
    .innerJoin(users, eq(users.id, groupMembers.userId))
    .where(inArray(groupMembers.groupId, ids));
  return mine.map(({ group, role }) => {
    const members = mem.filter((m) => m.groupId === group.id).map(({ id, name, kind }) => ({ id, name: kind === "test" ? `${name} (Test)` : name, isTest: kind === "test" }));
    const other = members.find((m) => m.id !== userId);
    return {
      id: group.id,
      name: group.name,
      kind: group.kind,
      defaultCurrency: group.defaultCurrency,
      role,
      members,
      displayName: group.kind === "direct" ? (other?.name ?? group.name) : group.name,
    };
  });
}

export async function getGroup(
  userId: string,
  groupId: string,
): Promise<GroupSummary & { simplifyDebts: boolean; defaultSplit: DefaultSplit | null }> {
  const { group } = await requireMember(userId, groupId);
  const all = await listGroups(userId);
  const g = all.find((x) => x.id === group.id);
  if (!g) throw notFound();
  return { ...g, simplifyDebts: group.simplifyDebts, defaultSplit: (group.defaultSplit as DefaultSplit | null) ?? null };
}

export async function createGroup(
  userId: string,
  data: { name: string; defaultCurrency: string; kind?: "group" | "direct" },
) {
  return getDb().transaction(async (tx) => {
    const [g] = await tx
      .insert(groups)
      .values({ name: data.name, defaultCurrency: data.defaultCurrency, kind: data.kind ?? "group", createdBy: userId })
      .returning();
    await tx.insert(groupMembers).values({ groupId: g.id, userId, role: "owner" });
    return g;
  });
}

export async function updateGroup(
  userId: string,
  groupId: string,
  data: { name?: string; defaultCurrency?: string; simplifyDebts?: boolean; defaultSplit?: DefaultSplit | null },
) {
  const { role, group } = await requireMember(userId, groupId);
  if (role !== "owner" && group.kind === "group") throw forbidden();
  if (data.defaultSplit) {
    const members = new Set(await memberIds(groupId));
    const d = data.defaultSplit;
    if (d.entries.some((e) => !members.has(e.userId)) || new Set(d.entries.map((e) => e.userId)).size !== d.entries.length)
      throw new ApiError(400, "not_a_member");
    if (d.type === "percent" && d.entries.reduce((a, e) => a + e.value, 0) !== 10000) throw new ApiError(400, "percent_sum");
    if (d.type === "shares" && d.entries.reduce((a, e) => a + e.value, 0) <= 0) throw new ApiError(400, "invalid_weight");
  }
  const [g] = await getDb().update(groups).set(data).where(eq(groups.id, groupId)).returning();
  return g;
}

export async function deleteGroup(userId: string, groupId: string) {
  const { role } = await requireMember(userId, groupId);
  if (role !== "owner") throw forbidden();
  await getDb().delete(groups).where(eq(groups.id, groupId));
}

/** Austreten (self) oder Entfernen durch den Owner. Nur bei Saldo 0 in allen Währungen. */
export async function removeMember(actorId: string, groupId: string, targetId: string) {
  const { role, group } = await requireMember(actorId, groupId);
  if (actorId !== targetId && role !== "owner") throw forbidden();
  if (group.kind === "direct") throw new ApiError(400, "direct_group");
  const { net } = await groupBalances(groupId);
  for (const cur of Object.values(net)) if (cur[targetId]) throw new ApiError(409, "balance_not_zero");
  if (role === "owner" && actorId === targetId) {
    const others = await getDb()
      .select({ userId: groupMembers.userId })
      .from(groupMembers)
      .where(eq(groupMembers.groupId, groupId));
    const next = others.find((o) => o.userId !== actorId);
    if (next) await getDb().update(groupMembers).set({ role: "owner" }).where(and(eq(groupMembers.groupId, groupId), eq(groupMembers.userId, next.userId)));
  }
  await getDb().delete(groupMembers).where(and(eq(groupMembers.groupId, groupId), eq(groupMembers.userId, targetId)));
}

// ---- Einladungen ----

export async function createInvite(userId: string, groupId: string) {
  const { group } = await requireMember(userId, groupId);
  const code = randomBytes(12).toString("base64url");
  const [inv] = await getDb()
    .insert(invites)
    .values({
      code,
      groupId,
      createdBy: userId,
      expiresAt: new Date(Date.now() + 7 * 86400_000),
      maxUses: group.kind === "direct" ? 1 : 20,
    })
    .returning();
  return inv;
}

async function loadValidInvite(code: string) {
  const rows = await getDb()
    .select({ invite: invites, group: groups, inviter: users.name })
    .from(invites)
    .innerJoin(groups, eq(groups.id, invites.groupId))
    .innerJoin(users, eq(users.id, invites.createdBy))
    .where(eq(invites.code, code))
    .limit(1);
  const r = rows[0];
  if (!r || r.invite.expiresAt < new Date() || r.invite.uses >= r.invite.maxUses) return null;
  return r;
}

export async function previewInvite(code: string) {
  const r = await loadValidInvite(code);
  if (!r) return null;
  return { kind: r.group.kind, groupName: r.group.kind === "direct" ? null : r.group.name, inviter: r.inviter, groupId: r.group.id };
}

export async function isInviteValid(code: string) {
  return (await loadValidInvite(code)) !== null;
}

export async function acceptInvite(userId: string, code: string): Promise<{ groupId: string }> {
  return getDb().transaction(async (tx) => {
    const rows = await tx
      .select({ invite: invites, group: groups })
      .from(invites)
      .innerJoin(groups, eq(groups.id, invites.groupId))
      .where(eq(invites.code, code))
      .for("update", { of: invites })
      .limit(1);
    const r = rows[0];
    if (!r || r.invite.expiresAt < new Date() || r.invite.uses >= r.invite.maxUses) throw new ApiError(410, "invite_invalid");
    const members = await tx.select({ userId: groupMembers.userId }).from(groupMembers).where(eq(groupMembers.groupId, r.group.id));
    if (members.some((m) => m.userId === userId)) return { groupId: r.group.id };
    if (r.group.kind === "direct" && members.length >= 2) throw new ApiError(410, "invite_invalid");
    await tx.insert(groupMembers).values({ groupId: r.group.id, userId });
    await tx.update(invites).set({ uses: r.invite.uses + 1 }).where(eq(invites.code, code));
    return { groupId: r.group.id };
  });
}
