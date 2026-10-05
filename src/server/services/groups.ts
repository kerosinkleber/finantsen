import { and, eq, inArray } from "drizzle-orm";
import { randomBytes } from "node:crypto";
import { getDb } from "../db";
import { groupMembers, groups, invites, users } from "../schema";
import { ApiError, forbidden, notFound } from "../http";
import { memberIds, requireMember } from "./access";
import type { DefaultSplit } from "@/lib/schemas";
import { normalizeLocale, translate } from "@/i18n";
import { groupBalances } from "./balances";

export type GroupSummary = {
  id: string;
  name: string;
  kind: string;
  defaultCurrency: string;
  role: string;
  members: { id: string; name: string; isTest: boolean; isGuest: boolean }[];
  /** Vom Nutzer in seiner Übersicht archiviert */
  archived: boolean;
  /** Anzeigename: bei Freunden der Name der anderen Person */
  displayName: string;
};

async function viewerLocale(userId: string) {
  try {
    const { getLocale } = await import("@/i18n/server");
    return await getLocale();
  } catch {
    const [viewer] = await getDb().select({ locale: users.locale }).from(users).where(eq(users.id, userId));
    return normalizeLocale(viewer?.locale) ?? "de";
  }
}

export async function listGroups(userId: string): Promise<GroupSummary[]> {
  const db = getDb();
  // Gäste (Mitglieder ohne Konto) werden in der Sprache der angezeigten Seite gekennzeichnet;
  // außerhalb einer Anfrage (Tests, Hintergrund) gilt die gespeicherte Sprache des Kontos.
  const guestLabel = translate(await viewerLocale(userId), "guest.label");
  const mine = await db
    .select({ group: groups, role: groupMembers.role, archivedAt: groupMembers.archivedAt })
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
  return mine.map(({ group, role, archivedAt }) => {
    const members = mem
      .filter((m) => m.groupId === group.id)
      .map(({ id, name, kind }) => ({ id, name: kind === "test" ? `${name} (Test)` : kind === "guest" ? `${name} (${guestLabel})` : name, isTest: kind === "test", isGuest: kind === "guest" }));
    const other = members.find((m) => m.id !== userId);
    return {
      id: group.id,
      name: group.name,
      kind: group.kind,
      defaultCurrency: group.defaultCurrency,
      role,
      archived: !!archivedAt,
      members,
      displayName: group.kind === "direct" ? (other?.name ?? group.name) : group.name,
    };
  });
}

export async function getGroup(
  userId: string,
  groupId: string,
): Promise<
  GroupSummary & {
    simplifyDebts: boolean;
    defaultSplit: DefaultSplit | null;
    recurringPolicy: "members" | "owner";
    budget: { amountMinor: number; period: "month" | "total"; currency: string } | null;
  }
> {
  const { group } = await requireMember(userId, groupId);
  const all = await listGroups(userId);
  const g = all.find((x) => x.id === group.id);
  if (!g) throw notFound();
  const budget =
    group.budgetMinor && group.budgetPeriod && group.budgetCurrency
      ? { amountMinor: group.budgetMinor, period: group.budgetPeriod as "month" | "total", currency: group.budgetCurrency }
      : null;
  return { ...g, simplifyDebts: group.simplifyDebts, defaultSplit: (group.defaultSplit as DefaultSplit | null) ?? null, recurringPolicy: group.recurringPolicy as "members" | "owner", budget };
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
  input: {
    name?: string;
    defaultCurrency?: string;
    simplifyDebts?: boolean;
    defaultSplit?: DefaultSplit | null;
    recurringPolicy?: "members" | "owner";
    budget?: { amountMinor: number; period: "month" | "total" } | null;
  },
) {
  const { budget, ...data } = input;
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
  const set: Partial<typeof groups.$inferInsert> = { ...data };
  if (budget !== undefined) {
    // Budget gilt in der aktuellen Gruppenwährung; neue Einstellung = Warnung darf wieder kommen
    const cur = data.defaultCurrency ?? group.defaultCurrency;
    Object.assign(set, budget ? { budgetMinor: budget.amountMinor, budgetPeriod: budget.period, budgetCurrency: cur, budgetAlertKey: null } : { budgetMinor: null, budgetPeriod: null, budgetCurrency: null, budgetAlertKey: null });
  }
  const [g] = await getDb().update(groups).set(set).where(eq(groups.id, groupId)).returning();
  return g;
}

/** Gruppe in der eigenen Übersicht archivieren oder zurückholen (betrifft nur dieses Mitglied, Salden zählen weiter). */
export async function setArchived(userId: string, groupId: string, archived: boolean) {
  await requireMember(userId, groupId);
  await getDb()
    .update(groupMembers)
    .set({ archivedAt: archived ? new Date() : null })
    .where(and(eq(groupMembers.groupId, groupId), eq(groupMembers.userId, userId)));
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
  const [target] = await getDb().select({ kind: users.kind }).from(users).where(eq(users.id, targetId));
  if (target?.kind === "guest") {
    // Gäste gehören nur zu dieser Gruppe: entfernen heißt löschen (nur ohne Daten)
    const { deleteGuest } = await import("./guests");
    return deleteGuest(actorId, groupId, targetId);
  }
  const { net } = await groupBalances(groupId);
  for (const cur of Object.values(net)) if (cur[targetId]) throw new ApiError(409, "balance_not_zero");
  // Verbleibende Mitglieder mit Konto (Gäste können nie Besitzer werden und sich nicht anmelden)
  const others = await getDb()
    .select({ userId: groupMembers.userId, kind: users.kind })
    .from(groupMembers)
    .innerJoin(users, eq(users.id, groupMembers.userId))
    .where(eq(groupMembers.groupId, groupId))
    .orderBy(groupMembers.joinedAt);
  const accounts = others.filter((o) => o.userId !== targetId && o.kind !== "guest");
  if (accounts.length === 0 && others.some((o) => o.kind === "guest")) throw new ApiError(409, "last_account_member");
  if (role === "owner" && actorId === targetId && accounts[0]) {
    await getDb().update(groupMembers).set({ role: "owner" }).where(and(eq(groupMembers.groupId, groupId), eq(groupMembers.userId, accounts[0].userId)));
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
  let guestName: string | null = null;
  if (r.invite.guestId) {
    const [g] = await getDb().select({ name: users.name }).from(users).where(eq(users.id, r.invite.guestId));
    guestName = g?.name ?? null;
  }
  return { kind: r.group.kind, groupName: r.group.kind === "direct" ? null : r.group.name, inviter: r.inviter, groupId: r.group.id, guestName };
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
    if (r.invite.guestId) {
      // Verknüpfungs-Link: Konto übernimmt den Gast (auch wenn es schon Mitglied ist)
      const { claimGuest } = await import("./guests");
      return claimGuest(tx, userId, r.group.id, r.invite.guestId);
    }
    const members = await tx.select({ userId: groupMembers.userId }).from(groupMembers).where(eq(groupMembers.groupId, r.group.id));
    if (members.some((m) => m.userId === userId)) return { groupId: r.group.id };
    if (r.group.kind === "direct" && members.length >= 2) throw new ApiError(410, "invite_invalid");
    await tx.insert(groupMembers).values({ groupId: r.group.id, userId });
    await tx.update(invites).set({ uses: r.invite.uses + 1 }).where(eq(invites.code, code));
    return { groupId: r.group.id };
  });
}
