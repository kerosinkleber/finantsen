import { and, asc, eq, isNull } from "drizzle-orm";
import { getDb } from "../db";
import { expenseComments, users } from "../schema";
import { forbidden, notFound } from "../http";
import { getExpense } from "./expenses";
import { notifyGroup } from "./notifications";

export async function listComments(userId: string, groupId: string, expenseId: string) {
  await getExpense(userId, groupId, expenseId);
  return getDb()
    .select({
      id: expenseComments.id,
      userId: expenseComments.userId,
      userName: users.name,
      body: expenseComments.body,
      createdAt: expenseComments.createdAt,
    })
    .from(expenseComments)
    .innerJoin(users, eq(users.id, expenseComments.userId))
    .where(and(eq(expenseComments.expenseId, expenseId), isNull(expenseComments.deletedAt)))
    .orderBy(asc(expenseComments.createdAt));
}

export async function addComment(userId: string, groupId: string, expenseId: string, body: string) {
  const e = await getExpense(userId, groupId, expenseId);
  const [row] = await getDb().insert(expenseComments).values({ expenseId, userId, body }).returning();
  await notifyGroup({
    type: "comment",
    groupId,
    expenseId,
    actorId: userId,
    title: e.title,
    excerpt: body.length > 80 ? body.slice(0, 77) + "…" : body,
  });
  return row;
}

export async function deleteComment(userId: string, groupId: string, expenseId: string, commentId: string) {
  await getExpense(userId, groupId, expenseId);
  if (!/^[0-9a-f-]{36}$/i.test(commentId)) throw notFound();
  const [c] = await getDb()
    .select()
    .from(expenseComments)
    .where(and(eq(expenseComments.id, commentId), eq(expenseComments.expenseId, expenseId), isNull(expenseComments.deletedAt)));
  if (!c) throw notFound();
  if (c.userId !== userId) throw forbidden();
  await getDb().update(expenseComments).set({ deletedAt: new Date() }).where(eq(expenseComments.id, commentId));
}
