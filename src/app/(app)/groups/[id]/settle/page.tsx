import { notFound } from "next/navigation";
import { requireUser } from "@/server/auth";
import { getT } from "@/i18n/server";
import { getGroup } from "@/server/services/groups";
import { ApiError } from "@/server/http";
import { SettleForm } from "@/components/SettleForm";
import { isValidCurrency } from "@/lib/money";

export default async function SettlePage({ params, searchParams }: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ from?: string; to?: string; amount?: string; currency?: string }>;
}) {
  const user = await requireUser();
  const { id } = await params;
  const q = await searchParams;
  const { t } = await getT();
  const group = await getGroup(user.id, id).catch((e) => {
    if (e instanceof ApiError && e.status === 404) notFound();
    throw e;
  });
  const ids = new Set(group.members.map((m) => m.id));
  const currency = q.currency && isValidCurrency(q.currency) ? q.currency : group.defaultCurrency;
  const amount = Number(q.amount);
  return (
    <>
      <h1 className="text-xl font-semibold">{t("settle.title")}</h1>
      <SettleForm
        groupId={id}
        members={group.members}
        meId={user.id}
        initial={{
          from: q.from && ids.has(q.from) ? q.from : undefined,
          to: q.to && ids.has(q.to) ? q.to : undefined,
          amountMinor: Number.isSafeInteger(amount) && amount > 0 ? amount : undefined,
          currency,
        }}
      />
    </>
  );
}
