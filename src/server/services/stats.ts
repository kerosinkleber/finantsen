import { computeStats } from "@/lib/money";
import { requireMember } from "./access";
import { loadExpenses } from "./expenses";

export async function getGroupStats(userId: string, groupId: string, range: { from?: string; to?: string } = {}) {
  await requireMember(userId, groupId);
  const exps = await loadExpenses(groupId, { filter: range });
  return computeStats(
    exps.map((e) => {
      // Rückerstattungen mindern die Ausgaben (negativ), bei Zahler- und Anteilssummen ebenso
      const sign = e.isRefund ? -1 : 1;
      return {
        currency: e.baseCurrency,
        amountMinor: sign * e.baseAmountMinor,
        date: e.date,
        category: e.category,
        paymentMethod: e.paymentMethod,
        title: e.title,
        payers: e.payers.map((p) => ({ userId: p.userId, amountMinor: sign * p.baseAmountMinor })),
        shares: e.shares.map((x) => ({ userId: x.userId, amountMinor: sign * x.baseAmountMinor })),
      };
    }),
  );
}
