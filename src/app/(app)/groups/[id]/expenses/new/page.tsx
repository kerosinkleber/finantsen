import { notFound } from "next/navigation";
import { requireUser } from "@/server/auth";
import { getT } from "@/i18n/server";
import { getGroup } from "@/server/services/groups";
import { ExpenseForm } from "@/components/ExpenseForm";
import { ApiError } from "@/server/http";
import { getExpense } from "@/server/services/expenses";
import { expenseToInitial } from "@/components/expenseInitial";

export default async function NewExpensePage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ copy?: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const { copy } = await searchParams;
  const { t } = await getT();
  const group = await getGroup(user.id, id).catch((e) => {
    if (e instanceof ApiError && e.status === 404) notFound();
    throw e;
  });
  // „Kopieren“: Werte einer Ausgabe dieser Gruppe übernehmen, sofern alle Beteiligten noch Mitglieder sind
  const source = copy ? await getExpense(user.id, id, copy).catch(() => null) : null;
  const memberIds = new Set(group.members.map((m) => m.id));
  const copyFrom =
    source && !source.deletedAt && [...source.payers, ...source.shares].every((x) => memberIds.has(x.userId)) ? expenseToInitial(source) : null;
  return (
    <>
      <h1 className="text-xl font-semibold">{t(copyFrom ? "expense.copyTitle" : "expense.new")}</h1>
      <ExpenseForm
        groupId={id}
        members={group.members}
        meId={user.id}
        defaultCurrency={group.defaultCurrency}
        baseCurrency={group.defaultCurrency}
        defaultSplit={group.defaultSplit}
        initial={copyFrom ?? undefined}
        copy={!!copyFrom}
      />
    </>
  );
}
