import { notFound } from "next/navigation";
import { requireUser } from "@/server/auth";
import { getT } from "@/i18n/server";
import { getGroup } from "@/server/services/groups";
import { expenseHistoryFor, getExpense } from "@/server/services/expenses";
import { ExpenseForm, type ExpenseInitial } from "@/components/ExpenseForm";
import { ApiError } from "@/server/http";
import { formatMoney } from "@/lib/money";
import type { MessageKey } from "@/i18n";

export default async function ExpensePage({ params }: { params: Promise<{ id: string; eid: string }> }) {
  const user = await requireUser();
  const { id, eid } = await params;
  const { t, locale } = await getT();
  const load = async () => {
    try {
      const group = await getGroup(user.id, id);
      const expense = await getExpense(user.id, id, eid);
      const history = await expenseHistoryFor(user.id, id, eid);
      return { group, expense, history };
    } catch (e) {
      if (e instanceof ApiError && e.status === 404) notFound();
      throw e;
    }
  };
  const { group, expense, history } = await load();
  const initial: ExpenseInitial = {
    id: expense.id,
    title: expense.title,
    amountMinor: expense.amountMinor,
    currency: expense.currency,
    date: expense.date,
    category: expense.category,
    splitType: expense.splitType as ExpenseInitial["splitType"],
    payers: expense.payers,
    shares: expense.shares,
  };
  const name = (uid: string) => group.members.find((m) => m.id === uid)?.name ?? "?";
  type Snap = { title: string; amountMinor: number; currency: string; deleted: boolean; payers: { userId: string; amountMinor: number }[]; shares: { userId: string; amountMinor: number }[] };

  return (
    <>
      <h1 className="text-xl font-semibold">{expense.deletedAt ? `${expense.title} (${t("expense.deleted")})` : t("expense.edit")}</h1>
      {expense.deletedAt ? (
        <section className="card">
          <p className="muted">{t("expense.deleted")}</p>
        </section>
      ) : (
        <ExpenseForm groupId={id} members={group.members} meId={user.id} defaultCurrency={group.defaultCurrency} initial={initial} />
      )}
      <section className="card" data-testid="history">
        <h2 className="mb-2 font-semibold">{t("expense.history")}</h2>
        <ol className="flex flex-col gap-3">
          {history.map((h) => {
            const s = h.snapshot as Snap;
            return (
              <li key={h.id} className="text-sm">
                <p>
                  <span className="font-medium">{t(`expense.action.${h.action}` as MessageKey)}</span> · {h.userName} ·{" "}
                  <time className="muted" dateTime={h.createdAt.toISOString()}>{h.createdAt.toLocaleString(locale)}</time>
                </p>
                <p className="muted">
                  {s.title} · {formatMoney(s.amountMinor, s.currency, locale)} ·{" "}
                  {s.payers.map((p) => `${name(p.userId)} ${formatMoney(p.amountMinor, s.currency, locale)}`).join(", ")} →{" "}
                  {s.shares.map((p) => `${name(p.userId)} ${formatMoney(p.amountMinor, s.currency, locale)}`).join(", ")}
                </p>
              </li>
            );
          })}
        </ol>
      </section>
    </>
  );
}
