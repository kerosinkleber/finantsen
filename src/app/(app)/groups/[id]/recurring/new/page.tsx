import { notFound } from "next/navigation";
import { requireUser } from "@/server/auth";
import { getT } from "@/i18n/server";
import { getGroup } from "@/server/services/groups";
import { ExpenseForm } from "@/components/ExpenseForm";
import { ApiError } from "@/server/http";

export const dynamic = "force-dynamic";

export default async function NewRecurringPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const { t } = await getT();
  const group = await getGroup(user.id, id).catch((e) => {
    if (e instanceof ApiError && e.status === 404) notFound();
    throw e;
  });
  return (
    <>
      <h1 className="text-xl font-semibold">{t("recurring.new")}</h1>
      <p className="muted">{t("recurring.intro")}</p>
      <ExpenseForm
        groupId={id}
        members={group.members}
        meId={user.id}
        defaultCurrency={group.defaultCurrency}
        baseCurrency={group.defaultCurrency}
        defaultSplit={group.defaultSplit}
        recurring={{ unit: "month", every: 1, endDate: null, paused: false }}
      />
    </>
  );
}
