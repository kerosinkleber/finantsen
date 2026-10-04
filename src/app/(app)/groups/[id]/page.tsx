import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/server/auth";
import { getT } from "@/i18n/server";
import { getGroup } from "@/server/services/groups";
import { listExpenses } from "@/server/services/expenses";
import { listPayments } from "@/server/services/payments";
import { getGroupBalances } from "@/server/services/balances";
import { ApiError } from "@/server/http";
import { RestoreButton } from "@/components/RestoreButton";
import { Money } from "@/components/Money";
import { InviteBox } from "@/components/InviteBox";
import { GroupSettings } from "@/components/GroupSettings";
import { DefaultSplitForm } from "@/components/DefaultSplitForm";
import { FilterForm } from "@/components/FilterForm";
import { StatsTab } from "@/components/StatsTab";
import { parseExpenseFilter } from "@/server/filter";
import type { MessageKey } from "@/i18n";
import { formatMoney } from "@/lib/money";

type Tab = "expenses" | "balances" | "stats" | "members";

export default async function GroupPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const user = await requireUser();
  const { id } = await params;
  const sp = await searchParams;
  const tabParam = Array.isArray(sp.tab) ? sp.tab[0] : sp.tab;
  const tab: Tab = tabParam === "balances" || tabParam === "members" || tabParam === "stats" ? tabParam : "expenses";
  const { t, locale } = await getT();
  let group;
  try {
    group = await getGroup(user.id, id);
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) notFound();
    throw e;
  }
  const names = new Map(group.members.map((m) => [m.id, m.id === user.id ? t("common.you") : m.name]));
  const title = group.displayName;
  const isDirect = group.kind === "direct";

  return (
    <>
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-xl font-semibold">{title}</h1>
        <Link href={`/groups/${id}/expenses/new`} className="btn">{t("group.addExpense")}</Link>
      </div>
      <div role="tablist" className="flex gap-1 rounded-lg bg-slate-200 p-1 dark:bg-slate-800">
        {(["expenses", "balances", "stats", "members"] as Tab[]).map((k) => (
          <Link
            key={k}
            role="tab"
            aria-selected={tab === k}
            href={`/groups/${id}?tab=${k}`}
            replace
            className={`flex-1 rounded-md py-2 text-center text-sm font-medium ${tab === k ? "bg-white shadow dark:bg-slate-950" : "text-slate-600 dark:text-slate-400"}`}
          >
            {t(`group.tab.${k}` as MessageKey)}
          </Link>
        ))}
      </div>

      {tab === "expenses" && (
        <ExpensesTab groupId={id} userId={user.id} names={names} locale={locale} t={t} group={group} sp={sp} />
      )}
      {tab === "stats" && <StatsTab groupId={id} userId={user.id} names={names} locale={locale} t={t} sp={sp} />}
      {tab === "balances" && <BalancesTab groupId={id} userId={user.id} names={names} locale={locale} t={t} />}
      {tab === "members" && (
        <>
          <ul className="card divide-y divide-slate-100 dark:divide-slate-800">
            {group.members.map((m) => (
              <li key={m.id} className="flex items-center justify-between py-2">
                <span>{m.id === user.id ? `${m.name} (${t("common.you")})` : m.name}</span>
              </li>
            ))}
          </ul>
          <InviteBox createUrl={`/api/groups/${id}/invites`} label={t("group.invite")} />
          <GroupSettings
            groupId={id}
            simplify={group.simplifyDebts}
            isOwner={group.role === "owner"}
            isDirect={isDirect}
            members={group.members}
            meId={user.id}
          />
          <DefaultSplitForm groupId={id} members={group.members} initial={group.defaultSplit} />
        </>
      )}
    </>
  );
}

type TFn = (key: MessageKey, params?: Record<string, string | number>) => string;

async function ExpensesTab({ groupId, userId, names, locale, t, group, sp }: {
  groupId: string;
  userId: string;
  names: Map<string, string>;
  locale: string;
  t: TFn;
  group: Awaited<ReturnType<typeof getGroup>>;
  sp: Record<string, string | string[] | undefined>;
}) {
  const { filter, active } = parseExpenseFilter(sp, group.defaultCurrency);
  const [expenses, allPayments, trash] = await Promise.all([listExpenses(userId, groupId, { filter }), listPayments(userId, groupId), listExpenses(userId, groupId, { onlyDeleted: true })]);
  const trashBox = trash.length > 0 && !active && (
    <details className="card" data-testid="trash">
      <summary className="cursor-pointer font-medium">{t("expense.trash", { n: trash.length })}</summary>
      <ul className="mt-3 flex flex-col gap-2">
        {trash.map((e) => (
          <li key={e.id} className="flex items-center justify-between gap-3 text-sm" data-testid="trash-item">
            <Link href={`/groups/${groupId}/expenses/${e.id}`} className="min-w-0">
              <span className="muted">{e.date}</span>
              <span className="block truncate font-medium">{e.title}</span>
              <span className="muted">{formatMoney(e.amountMinor, e.currency, locale)}</span>
            </Link>
            <RestoreButton groupId={groupId} expenseId={e.id} compact />
          </li>
        ))}
      </ul>
    </details>
  );
  const payments = active ? [] : allPayments; // Zahlungen gehören nicht zu Ausgaben-Filtern
  const form = <FilterForm groupId={groupId} members={group.members.map((m) => ({ id: m.id, name: m.id === userId ? t("common.you") : m.name }))} currency={group.defaultCurrency} values={sp} active={active} t={t} />;
  type Item = { kind: "e"; date: string; at: number; e: (typeof expenses)[number] } | { kind: "p"; date: string; at: number; p: (typeof payments)[number] };
  const items: Item[] = [
    ...expenses.map((e) => ({ kind: "e" as const, date: e.date, at: +e.createdAt, e })),
    ...payments.map((p) => ({ kind: "p" as const, date: p.date, at: +p.createdAt, p })),
  ].sort((a, b) => (a.date === b.date ? b.at - a.at : a.date < b.date ? 1 : -1));
  if (items.length === 0) return <>{form}<p className="muted" data-testid="no-results">{active ? t("filter.noResults") : t("group.noExpenses")}</p>{trashBox}</>;
  return (
    <>
    {form}
    <ul className="flex flex-col gap-2">
      {items.map((it) => {
        if (it.kind === "p") {
          const p = it.p;
          return (
            <li key={p.id} className="card flex items-center justify-between text-sm" data-testid="payment-item">
              <span>
                <span className="muted">{p.date}</span>
                <span className="block">{t("group.settledPayment", { from: names.get(p.fromUser) ?? "?", to: names.get(p.toUser) ?? "?" })}</span>
              </span>
              <Money minor={p.amountMinor} currency={p.currency} locale={locale} />
            </li>
          );
        }
        const e = it.e;
        const paid = e.payers.find((x) => x.userId === userId)?.baseAmountMinor ?? 0;
        const share = e.shares.find((x) => x.userId === userId)?.baseAmountMinor ?? 0;
        const net = paid - share;
        const involved = paid > 0 || share > 0;
        return (
          <li key={e.id}>
            <Link href={`/groups/${groupId}/expenses/${e.id}`} className="card flex items-center justify-between gap-3 hover:border-brand" data-testid="expense-item">
              <span className="min-w-0">
                <span className="muted">{e.date} · {t(`cat.${e.category}` as MessageKey)}</span>
                <span className="block truncate font-medium">{e.title}</span>
                <span className="muted block">
                  {t(e.payers.length > 1 ? "group.paidByMany" : e.payers[0]?.userId === userId ? "group.paidByYou" : "group.paidBy", {
                    name: e.payers.map((p) => names.get(p.userId) ?? "?").join(", "),
                    amount: formatMoney(e.amountMinor, e.currency, locale),
                  })}
                  {e.currency !== e.baseCurrency && (
                    <span data-testid="converted"> · ≈ {formatMoney(e.baseAmountMinor, e.baseCurrency, locale)}</span>
                  )}
                </span>
              </span>
              <span className="shrink-0 text-right text-sm">
                {involved ? (
                  <>
                    <span className="muted block">{net >= 0 ? t("group.lent") : t("group.borrowed")}</span>
                    <Money minor={net} currency={e.baseCurrency} locale={locale} absolute />
                  </>
                ) : (
                  <span className="muted">{t("group.notInvolved")}</span>
                )}
              </span>
            </Link>
          </li>
        );
      })}
    </ul>
    {trashBox}
    </>
  );
}

async function BalancesTab({ groupId, userId, names, locale, t }: { groupId: string; userId: string; names: Map<string, string>; locale: string; t: TFn }) {
  const b = await getGroupBalances(userId, groupId);
  const currencies = Object.keys(b.net);
  return (
    <>
      <Link href={`/groups/${groupId}/settle`} className="btn-secondary">{t("balances.recordPayment")}</Link>
      {currencies.length === 0 ? (
        <p className="card text-center" data-testid="settled">{t("balances.settled")}</p>
      ) : (
        currencies.map((cur) => (
          <section key={cur} className="card flex flex-col gap-3">
            <h2 className="font-semibold">{t("balances.title")} · {cur}</h2>
            <ul className="flex flex-col gap-2" data-testid={`transfers-${cur}`}>
              {(b.transfers[cur] ?? []).map((tr, i) => (
                <li key={i} className="flex items-center justify-between gap-2 text-sm">
                  <span>
                    {t(tr.from === userId ? "balances.youOwe" : tr.to === userId ? "balances.owesYou" : "balances.owes", {
                      from: names.get(tr.from) ?? "?",
                      to: names.get(tr.to) ?? "?",
                      amount: formatMoney(tr.amount, cur, locale),
                    })}
                  </span>
                  {(tr.from === userId || tr.to === userId) && (
                    <Link
                      className="btn-secondary !min-h-9 !px-3"
                      href={`/groups/${groupId}/settle?from=${tr.from}&to=${tr.to}&amount=${tr.amount}&currency=${cur}`}
                    >
                      {t("group.settleUp")}
                    </Link>
                  )}
                </li>
              ))}
            </ul>
            <div className="border-t border-slate-100 pt-2 dark:border-slate-800">
              <h3 className="muted mb-1">{t("balances.net")}</h3>
              <ul>
                {Object.entries(b.net[cur]).sort(([, a], [, c]) => c - a).map(([uid, v]) => (
                  <li key={uid} className="flex justify-between text-sm">
                    <span>{names.get(uid) ?? "?"}</span>
                    <Money minor={v} currency={cur} locale={locale} signed />
                  </li>
                ))}
              </ul>
            </div>
          </section>
        ))
      )}
    </>
  );
}
