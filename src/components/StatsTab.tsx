import Link from "next/link";
import { getGroupStats } from "@/server/services/stats";
import { formatMoney } from "@/lib/money";
import type { MessageKey } from "@/i18n";

type T = (key: MessageKey, params?: Record<string, string | number>) => string;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";
const isDate = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s);

/** Horizontaler Balken mit Beschriftung; Breite relativ zum Maximum. */
function Bar({ label, value, max, text, color = "bg-brand" }: { label: string; value: number; max: number; text: string; color?: string }) {
  const pct = max > 0 ? Math.max(2, Math.round((value / max) * 100)) : 0;
  return (
    <li className="text-sm">
      <div className="flex justify-between gap-2">
        <span className="truncate">{label}</span>
        <span className="tabular-nums">{text}</span>
      </div>
      <div className="mt-1 h-2 rounded bg-slate-100 dark:bg-slate-800" role="img" aria-label={`${label}: ${text}`}>
        <div className={`h-2 rounded ${color}`} style={{ width: `${pct}%` }} />
      </div>
    </li>
  );
}

export async function StatsTab({ groupId, userId, names, locale, t, sp }: {
  groupId: string;
  userId: string;
  names: Map<string, string>;
  locale: string;
  t: T;
  sp: Record<string, string | number | string[] | undefined>;
}) {
  const from = one(sp.from as string);
  const to = one(sp.to as string);
  const stats = await getGroupStats(userId, groupId, { from: isDate(from) ? from : undefined, to: isDate(to) ? to : undefined });
  const currencies = Object.keys(stats);
  const cur = currencies.includes(one(sp.cur as string)) ? one(sp.cur as string) : currencies[0];
  const s = cur ? stats[cur] : null;
  const fmt = (n: number) => formatMoney(n, cur ?? "EUR", locale);
  const monthLabel = (m: string) => new Date(`${m}-01T00:00:00Z`).toLocaleDateString(locale, { month: "short", year: "numeric", timeZone: "UTC" });

  return (
    <>
      <form method="get" action={`/groups/${groupId}`} className="card grid grid-cols-2 gap-3">
        <input type="hidden" name="tab" value="stats" />
        {cur && <input type="hidden" name="cur" value={cur} />}
        <div>
          <label className="label" htmlFor="s-from">{t("stats.from")}</label>
          <input id="s-from" name="from" type="date" className="input" defaultValue={from} />
        </div>
        <div>
          <label className="label" htmlFor="s-to">{t("stats.to")}</label>
          <input id="s-to" name="to" type="date" className="input" defaultValue={to} />
        </div>
        <button className="btn col-span-2">{t("filter.apply")}</button>
      </form>
      {!s ? (
        <p className="muted" data-testid="stats-empty">{t("stats.none")}</p>
      ) : (
        <>
          {currencies.length > 1 && (
            <div className="flex gap-2">
              {currencies.map((c) => (
                <Link key={c} replace href={`/groups/${groupId}?tab=stats&cur=${c}${from ? `&from=${from}` : ""}${to ? `&to=${to}` : ""}`}
                  className={`rounded-full border px-3 py-1 text-sm ${c === cur ? "border-brand bg-brand text-white" : "border-slate-300 dark:border-slate-700"}`}>
                  {c}
                </Link>
              ))}
            </div>
          )}
          <section className="card" data-testid="stats-total">
            <p className="muted">{t("stats.total")} · {t("stats.count", { count: s.count })}</p>
            <p className="text-2xl font-semibold tabular-nums">{fmt(s.total)}</p>
          </section>
          <section className="card flex flex-col gap-3" data-testid="stats-category">
            <h2 className="font-semibold">{t("stats.byCategory")}</h2>
            <ul className="flex flex-col gap-3">
              {s.byCategory.map((c) => (
                <Bar key={c.category} label={t(`cat.${c.category}` as MessageKey)} value={c.total} max={s.byCategory[0].total} text={`${fmt(c.total)} · ${Math.round((c.total / s.total) * 100)} %`} />
              ))}
            </ul>
          </section>
          <section className="card flex flex-col gap-3" data-testid="stats-month">
            <h2 className="font-semibold">{t("stats.byMonth")}</h2>
            <ul className="flex flex-col gap-3">
              {s.byMonth.map((m) => (
                <Bar key={m.month} label={monthLabel(m.month)} value={m.total} max={Math.max(...s.byMonth.map((x) => x.total))} text={fmt(m.total)} />
              ))}
            </ul>
          </section>
          <section className="card flex flex-col gap-3" data-testid="stats-person">
            <h2 className="font-semibold">{t("stats.byPerson")}</h2>
            <ul className="flex flex-col gap-4">
              {s.byPerson.map((p) => {
                const max = Math.max(...s.byPerson.flatMap((x) => [x.paid, x.share]));
                return (
                  <li key={p.userId} className="flex flex-col gap-1">
                    <span className="font-medium">{names.get(p.userId) ?? "?"}</span>
                    <ul className="flex flex-col gap-2">
                      <Bar label={t("stats.paid")} value={p.paid} max={max} text={fmt(p.paid)} />
                      <Bar label={t("stats.share")} value={p.share} max={max} text={fmt(p.share)} color="bg-slate-400" />
                    </ul>
                  </li>
                );
              })}
            </ul>
          </section>
        </>
      )}
    </>
  );
}
