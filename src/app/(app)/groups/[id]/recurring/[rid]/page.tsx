import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/server/auth";
import { getT } from "@/i18n/server";
import { getGroup } from "@/server/services/groups";
import { getRecurring } from "@/server/services/recurring";
import { ExpenseForm } from "@/components/ExpenseForm";
import { templateToInitial } from "@/components/recurringInitial";
import { ApiError } from "@/server/http";

export const dynamic = "force-dynamic";

export default async function EditRecurringPage({ params }: { params: Promise<{ id: string; rid: string }> }) {
  const user = await requireUser();
  const { id, rid } = await params;
  const { t } = await getT();
  const notFoundOn404 = (e: unknown) => {
    if (e instanceof ApiError && e.status === 404) notFound();
    throw e;
  };
  const group = await getGroup(user.id, id).catch(notFoundOn404);
  const r = await getRecurring(user.id, id, rid).catch(notFoundOn404);
  if (group.recurringPolicy === "owner" && group.role !== "owner") {
    return (
      <>
        <h1 className="text-xl font-semibold">{r.title}</h1>
        <p className="card" data-testid="recurring-forbidden">{t("recurring.onlyOwner")}</p>
        <Link href={`/groups/${id}?tab=recurring`} className="btn-secondary">{t("common.back")}</Link>
      </>
    );
  }
  return (
    <>
      <h1 className="text-xl font-semibold">{t("recurring.edit")}</h1>
      <p className="muted">{t("recurring.intro")}</p>
      <ExpenseForm
        groupId={id}
        members={group.members}
        meId={user.id}
        defaultCurrency={group.defaultCurrency}
        baseCurrency={group.defaultCurrency}
        initial={templateToInitial(r.id, r.startDate, r.template)}
        recurring={{ id: r.id, unit: r.unit, every: r.every, endDate: r.endDate, paused: r.paused, lastBookedDate: r.lastBookedDate }}
      />
    </>
  );
}
