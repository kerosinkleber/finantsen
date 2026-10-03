import { and, desc, eq, isNull } from "drizzle-orm";
import { getDb } from "../db";
import { payments } from "../schema";
import { ApiError, notFound } from "../http";
import type { PaymentBody } from "@/lib/schemas";
import { memberIds, requireMember } from "./access";

export async function loadPayments(groupId: string) {
  return getDb()
    .select()
    .from(payments)
    .where(and(eq(payments.groupId, groupId), isNull(payments.deletedAt)))
    .orderBy(desc(payments.date), desc(payments.createdAt));
}

export async function listPayments(userId: string, groupId: string) {
  await requireMember(userId, groupId);
  return loadPayments(groupId);
}

export async function createPayment(userId: string, groupId: string, body: PaymentBody) {
  await requireMember(userId, groupId);
  if (body.fromUser === body.toUser) throw new ApiError(400, "same_user");
  const members = await memberIds(groupId);
  if (!members.includes(body.fromUser) || !members.includes(body.toUser)) throw new ApiError(400, "not_a_member");
  const [row] = await getDb()
    .insert(payments)
    .values({
      groupId,
      fromUser: body.fromUser,
      toUser: body.toUser,
      amountMinor: body.amountMinor,
      currency: body.currency,
      date: body.date,
      note: body.note || null,
      createdBy: userId,
    })
    .returning();
  return row;
}

export async function deletePayment(userId: string, groupId: string, paymentId: string) {
  await requireMember(userId, groupId);
  if (!/^[0-9a-f-]{36}$/i.test(paymentId)) throw notFound();
  const res = await getDb()
    .update(payments)
    .set({ deletedAt: new Date() })
    .where(and(eq(payments.id, paymentId), eq(payments.groupId, groupId), isNull(payments.deletedAt)))
    .returning({ id: payments.id });
  if (!res.length) throw notFound();
}
