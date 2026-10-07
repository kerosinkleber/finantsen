import { RestoreButton } from "@/components/RestoreButton";
import { LocalTime } from "@/components/LocalTime";
import { notFound } from "next/navigation";
import { requireUser } from "@/server/auth";
import { getT } from "@/i18n/server";
import { getGroup } from "@/server/services/groups";
import { expenseHistoryFor, getExpense } from "@/server/services/expenses";
import { listComments } from "@/server/services/comments";
import { Comments } from "@/components/Comments";
import { Attachments } from "@/components/Attachments";
import { ATTACHMENTS_PER_EXPENSE, listAttachments } from "@/server/services/attachments";
import { ExpenseForm } from "@/components/ExpenseForm";
import { expenseToInitial } from "@/components/expenseInitial";
import Link from "next/link";
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
      const comments = await listComments(user.id, id, eid);
      const attachments = await listAttachments(user.id, id, eid);
      return { group, expense, history, comments, attachments };
    } catch (e) {
      if (e instanceof ApiError && e.status === 404) notFound();
      throw e;
    }
  };
  const { group, expense, history, comments, attachments } = await load();
  const initial = expenseToInitial(expense);
  // Im Verlauf können übernommene Gäste als „guest:<Name>“ stehen (siehe claimGuest)
  const name = (uid: string) => (uid.startsWith("guest:") ? `${uid.slice(6)} (${t("guest.label")})` : (group.members.find((m) => m.id === uid)?.name ?? "?"));
  type Snap = { title: string; amountMinor: number; currency: string; deleted: boolean; payers: { userId: string; amountMinor: number }[]; shares: { userId: string; amountMinor: number }[] };

  return (
    <>
      <h1 className="text-xl font-semibold">{expense.deletedAt ? `${expense.title} (${t("expense.deleted")})` : t("expense.edit")}</h1>
      {expense.recurringId && <p className="muted" data-testid="auto-note">{t("recurring.auto")}</p>}
      {expense.deletedAt ? (
        <section className="card">
          <p className="muted">{t("expense.deleted")}</p>
          <RestoreButton groupId={id} expenseId={eid} />
        </section>
      ) : (
        <>
          <ExpenseForm groupId={id} members={group.members} meId={user.id} defaultCurrency={group.defaultCurrency} baseCurrency={expense.baseCurrency} initial={initial} />
          {!expense.recurringId && (
            <Link href={`/groups/${id}/expenses/new?copy=${eid}`} className="btn-secondary" data-testid="copy-expense">{t("expense.copy")}</Link>
          )}
        </>
      )}
      <Attachments
        groupId={id}
        expenseId={eid}
        initial={attachments.map((a) => ({ id: a.id, size: a.size }))}
        canAdd={!expense.deletedAt}
        max={ATTACHMENTS_PER_EXPENSE}
      />
      <Comments
        groupId={id}
        expenseId={eid}
        meId={user.id}
        comments={comments.map((c) => ({ id: c.id, userId: c.userId, userName: c.userName, actedByName: c.actedByName, body: c.body, createdAt: c.createdAt.toISOString() }))}
      />
      <section className="card" data-testid="history">
        <h2 className="mb-2 font-semibold">{t("expense.history")}</h2>
        <ol className="flex flex-col gap-3">
          {history.map((h) => {
            const s = h.snapshot as Snap;
            return (
              <li key={h.id} className="text-sm">
                <p>
                  <span className="font-medium">{t(`expense.action.${h.action}` as MessageKey)}</span> · {h.userName}{h.actedByName ? <span data-testid="acted-by"> ({t("test.byAdmin", { name: h.actedByName })})</span> : null} ·{" "}
                  <LocalTime className="muted" iso={h.createdAt.toISOString()} locale={locale} />
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
