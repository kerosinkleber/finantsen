import { and, eq, gte, isNull, lt, or, sql } from "drizzle-orm";
import { getDb } from "../db";
import { expenses, groupMembers, groups, users } from "../schema";
import { requireMember } from "./access";
import { notifyUser } from "./notifications";

export type BudgetStatus = {
  limitMinor: number;
  spentMinor: number;
  currency: string;
  period: "month" | "total";
  /** YYYY-MM bei Monatsbudget */
  month: string | null;
};

/** Zeitraum-Schlüssel für die einmalige Überschreitungsmeldung. */
const periodKey = (period: string, now: Date) => (period === "month" ? now.toISOString().slice(0, 7) : "total");

/**
 * Budgetstand: Summe der Ausgaben in der Budgetwährung (Abrechnungsbeträge, Rückerstattungen mindernd, ohne
 * Gelöschtes), beim Monatsbudget nur im laufenden Kalendermonat (UTC). `null` ohne Budget.
 */
export async function budgetStatus(groupId: string, now = new Date()): Promise<BudgetStatus | null> {
  const [g] = await getDb()
    .select({ limit: groups.budgetMinor, period: groups.budgetPeriod, currency: groups.budgetCurrency })
    .from(groups)
    .where(eq(groups.id, groupId));
  if (!g?.limit || !g.period || !g.currency) return null;
  const month = now.toISOString().slice(0, 7);
  const conds = [eq(expenses.groupId, groupId), isNull(expenses.deletedAt), eq(expenses.baseCurrency, g.currency)];
  // halboffener Bereich [1. dieses Monats, 1. nächsten Monats) – kein ungültiges Datum wie der 31.02.
  const next = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1)).toISOString().slice(0, 10);
  if (g.period === "month") conds.push(gte(expenses.date, `${month}-01`), lt(expenses.date, next));
  const [r] = await getDb()
    .select({ spent: sql<string>`coalesce(sum(case when ${expenses.isRefund} then -${expenses.baseAmountMinor} else ${expenses.baseAmountMinor} end), 0)::text` })
    .from(expenses)
    .where(and(...conds));
  return { limitMinor: g.limit, spentMinor: Number(r.spent), currency: g.currency, period: g.period as "month" | "total", month: g.period === "month" ? month : null };
}

export async function getBudgetStatus(userId: string, groupId: string) {
  await requireMember(userId, groupId);
  return budgetStatus(groupId);
}

/**
 * Nach dem Buchen: wird das Budget erstmals in diesem Zeitraum überschritten, bekommen alle Mitglieder (außer
 * Gästen) genau eine Benachrichtigung. Atomar über `budget_alert_key`, damit parallele Buchungen nicht doppelt melden.
 */
export async function checkBudgetAlert(groupId: string, now = new Date()) {
  try {
    const st = await budgetStatus(groupId, now);
    if (!st || st.spentMinor <= st.limitMinor) return false;
    const key = periodKey(st.period, now);
    const claimed = await getDb()
      .update(groups)
      .set({ budgetAlertKey: key })
      .where(and(eq(groups.id, groupId), or(isNull(groups.budgetAlertKey), sql`${groups.budgetAlertKey} <> ${key}`)))
      .returning({ name: groups.name });
    if (!claimed.length) return false;
    const members = await getDb()
      .select({ id: users.id })
      .from(groupMembers)
      .innerJoin(users, eq(users.id, groupMembers.userId))
      .where(and(eq(groupMembers.groupId, groupId), sql`${users.kind} <> 'guest'`));
    for (const m of members) {
      await notifyUser({
        type: "budget_exceeded",
        userId: m.id,
        groupId,
        data: { actorName: "", title: "", groupName: claimed[0].name, amounts: [{ amountMinor: st.spentMinor, currency: st.currency }, { amountMinor: st.limitMinor, currency: st.currency }] },
      });
    }
    return true;
  } catch (e) {
    console.error("[budget] alert failed", e);
    return false;
  }
}
