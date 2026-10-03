import { computeStats } from "@/lib/money";
import { requireMember } from "./access";
import { loadExpenses } from "./expenses";

export async function getGroupStats(userId: string, groupId: string, range: { from?: string; to?: string } = {}) {
  await requireMember(userId, groupId);
  const exps = await loadExpenses(groupId, { filter: range });
  return computeStats(
    exps.map((e) => ({
      currency: e.baseCurrency,
      amountMinor: e.baseAmountMinor,
      date: e.date,
      category: e.category,
      payers: e.payers.map((p) => ({ userId: p.userId, amountMinor: p.baseAmountMinor })),
      shares: e.shares.map((x) => ({ userId: x.userId, amountMinor: x.baseAmountMinor })),
    })),
  );
}
