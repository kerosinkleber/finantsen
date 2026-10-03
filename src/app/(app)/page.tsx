import Link from "next/link";
import { requireUser } from "@/server/auth";
import { getT } from "@/i18n/server";
import { listGroups } from "@/server/services/groups";
import { overallBalances } from "@/server/services/balances";
import { Money } from "@/components/Money";

export default async function Dashboard() {
  const user = await requireUser();
  const { t, locale } = await getT();
  const [groups, overall] = await Promise.all([listGroups(user.id), overallBalances(user.id)]);
  const realGroups = groups.filter((g) => g.kind === "group");
  const totals = Object.entries(overall.totals);

  return (
    <>
      <section className="card">
        <h1 className="muted">{t("dash.balanceTitle")}</h1>
        {totals.length === 0 ? (
          <p className="mt-1 text-lg font-semibold">{t("dash.allSettled")}</p>
        ) : (
          <ul className="mt-1 space-y-1">
            {totals.map(([cur, v]) => (
              <li key={cur} className="flex items-baseline justify-between text-xl font-semibold" data-testid={`total-${cur}`}>
                <span className="muted">{v > 0 ? t("dash.youAreOwed") : t("dash.youOwe")}</span>
                <Money minor={v} currency={cur} locale={locale} />
              </li>
            ))}
          </ul>
        )}
        {overall.people.length > 0 && (
          <ul className="mt-3 divide-y divide-slate-100 border-t border-slate-100 pt-1 dark:divide-slate-800 dark:border-slate-800">
            {overall.people.map((p) => (
              <li key={p.userId + p.currency} className="flex justify-between py-2 text-sm">
                <span>{p.name} <span className="muted">{p.amount > 0 ? t("dash.owesYou") : t("dash.youOweTo")}</span></span>
                <Money minor={Math.abs(p.amount)} currency={p.currency} locale={locale} />
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">{t("dash.groups")}</h2>
          <Link href="/groups/new" className="btn">{t("dash.newGroup")}</Link>
        </div>
        {realGroups.length === 0 && <p className="muted">{t("dash.noGroups")}</p>}
        <ul className="flex flex-col gap-2">
          {realGroups.map((g) => {
            const bal = overall.perGroup[g.id] ?? {};
            return (
              <li key={g.id}>
                <Link href={`/groups/${g.id}`} className="card flex items-center justify-between hover:border-brand">
                  <span className="font-medium">{g.name}</span>
                  <span className="text-sm">
                    {Object.entries(bal).length === 0 ? (
                      <span className="muted">{t("dash.allSettled")}</span>
                    ) : (
                      Object.entries(bal).map(([cur, v]) => <Money key={cur} minor={v} currency={cur} locale={locale} signed />)
                    )}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </section>
    </>
  );
}
