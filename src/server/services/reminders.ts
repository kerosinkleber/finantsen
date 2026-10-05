import { and, eq, gt, sql } from "drizzle-orm";
import { getDb } from "../db";
import { groups, notifications, users } from "../schema";
import { ApiError } from "../http";
import { requireMember } from "./access";
import { groupBalances } from "./balances";
import { notifyUser } from "./notifications";

/** Höchstens eine Erinnerung pro Person, Gruppe und Erinnerer innerhalb dieses Zeitraums. */
export const REMIND_INTERVAL_HOURS = 24;

/**
 * „Erinnern“: Die Person, die laut Ausgleichsvorschlag dem Erinnerer Geld schuldet, bekommt eine Benachrichtigung
 * (In-App, Push, ggf. E-Mail) mit den offenen Beträgen. Nur wer tatsächlich Gläubiger ist, kann erinnern.
 */
export async function remind(actorId: string, groupId: string, debtorId: string) {
  await requireMember(actorId, groupId);
  if (!/^[0-9a-f-]{36}$/i.test(debtorId) || debtorId === actorId) throw new ApiError(400, "validation");
  const b = await groupBalances(groupId);
  const amounts = Object.entries(b.transfers).flatMap(([currency, ts]) =>
    ts.filter((t) => t.from === debtorId && t.to === actorId).map((t) => ({ amountMinor: t.amount, currency })),
  );
  if (!amounts.length) throw new ApiError(409, "nothing_owed");
  const [debtor] = await getDb().select({ kind: users.kind }).from(users).where(eq(users.id, debtorId));
  if (!debtor || debtor.kind === "guest") throw new ApiError(409, "cannot_remind_guest");
  // Drossel: gleiche Gruppe, gleicher Empfänger, gleicher Erinnerer innerhalb von 24 Stunden
  const [recent] = await getDb()
    .select({ id: notifications.id })
    .from(notifications)
    .where(
      and(
        eq(notifications.userId, debtorId),
        eq(notifications.groupId, groupId),
        eq(notifications.type, "reminder"),
        sql`${notifications.data}->>'actorId' = ${actorId}`,
        gt(notifications.createdAt, sql`now() - make_interval(hours => ${REMIND_INTERVAL_HOURS})`),
      ),
    )
    .limit(1);
  if (recent) throw new ApiError(429, "already_reminded");
  const [actor] = await getDb().select({ name: users.name, kind: users.kind }).from(users).where(eq(users.id, actorId));
  const [g] = await getDb().select({ name: groups.name, kind: groups.kind }).from(groups).where(eq(groups.id, groupId));
  const actorName = actor.kind === "test" ? `${actor.name} (Test)` : actor.name;
  await notifyUser({
    type: "reminder",
    userId: debtorId,
    groupId,
    data: { actorName, title: "", groupName: g.kind === "direct" ? actorName : g.name, amounts, actorId },
  });
  return { amounts };
}
