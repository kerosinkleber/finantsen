import { and, eq } from "drizzle-orm";
import { getDb, type Db } from "../db";
import { groupMembers, groups } from "../schema";
import { notFound } from "../http";

/** Wirft 404 (nicht 403, um Existenz nicht zu verraten), wenn der Nutzer kein Mitglied ist. */
export async function requireMember(userId: string, groupId: string, db: Db = getDb()) {
  if (!/^[0-9a-f-]{36}$/i.test(groupId)) throw notFound();
  const rows = await db
    .select({ group: groups, role: groupMembers.role })
    .from(groupMembers)
    .innerJoin(groups, eq(groups.id, groupMembers.groupId))
    .where(and(eq(groupMembers.groupId, groupId), eq(groupMembers.userId, userId)))
    .limit(1);
  if (!rows[0]) throw notFound();
  return rows[0];
}

export async function memberIds(groupId: string, db: Db = getDb()): Promise<string[]> {
  const rows = await db.select({ userId: groupMembers.userId }).from(groupMembers).where(eq(groupMembers.groupId, groupId));
  return rows.map((r) => r.userId);
}
