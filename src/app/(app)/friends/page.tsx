import Link from "next/link";
import { requireUser } from "@/server/auth";
import { getT } from "@/i18n/server";
import { listGroups } from "@/server/services/groups";
import { overallBalances } from "@/server/services/balances";
import { InviteBox } from "@/components/InviteBox";
import { Money } from "@/components/Money";

export default async function FriendsPage() {
  const user = await requireUser();
  const { t, locale } = await getT();
  const [groups, overall] = await Promise.all([listGroups(user.id), overallBalances(user.id)]);
  const friends = groups.filter((g) => g.kind === "direct");
  return (
    <>
      <h1 className="text-xl font-semibold">{t("friends.title")}</h1>
      {friends.length === 0 && <p className="muted">{t("friends.none")}</p>}
      <ul className="flex flex-col gap-2">
        {friends.map((g) => {
          const pending = g.members.length < 2;
          const bal = overall.perGroup[g.id] ?? {};
          return (
            <li key={g.id}>
              <Link href={`/groups/${g.id}`} className="card flex items-center justify-between hover:border-brand">
                <span className="font-medium">{pending ? t("friends.pending") : g.displayName}</span>
                <span className="text-sm">
                  {Object.entries(bal).map(([cur, v]) => <Money key={cur} minor={v} currency={cur} locale={locale} signed />)}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
      <section className="card flex flex-col gap-3">
        <h2 className="font-semibold">{t("friends.add")}</h2>
        <p className="muted">{t("friends.addHelp")}</p>
        <InviteBox createUrl="/api/friends" label={t("friends.add")} />
      </section>
    </>
  );
}
