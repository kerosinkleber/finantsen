import { PAYMENT_METHODS } from "@/lib/schemas";
import Link from "next/link";
import { CATEGORIES } from "@/lib/categories";
import type { MessageKey } from "@/i18n";

type T = (key: MessageKey, params?: Record<string, string | number>) => string;
const val = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

/** Server-seitiges GET-Formular (funktioniert ohne JS); Filter stehen in der URL. */
export function FilterForm({ groupId, members, currency, values, active, t }: {
  groupId: string;
  members: { id: string; name: string }[];
  currency: string;
  values: Record<string, string | string[] | undefined>;
  active: boolean;
  t: T;
}) {
  return (
    <details className="card" open={active}>
      <summary className="cursor-pointer font-medium">{t("filter.title")}</summary>
      <form method="get" action={`/groups/${groupId}`} className="mt-3 flex flex-col gap-3">
        <input type="hidden" name="tab" value="expenses" />
        <input type="hidden" name="currency" value={currency} />
        <div>
          <label className="label" htmlFor="f-q">{t("filter.q")}</label>
          <input id="f-q" name="q" className="input" defaultValue={val(values.q)} maxLength={100} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label" htmlFor="f-min">{t("filter.min")}</label>
            <input id="f-min" name="min" inputMode="decimal" className="input" defaultValue={val(values.min)} />
          </div>
          <div>
            <label className="label" htmlFor="f-max">{t("filter.max")}</label>
            <input id="f-max" name="max" inputMode="decimal" className="input" defaultValue={val(values.max)} />
          </div>
        </div>
        <p className="muted -mt-2">{t("filter.currencyHint", { currency })}</p>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label" htmlFor="f-from">{t("filter.from")}</label>
            <input id="f-from" name="from" type="date" className="input" defaultValue={val(values.from)} />
          </div>
          <div>
            <label className="label" htmlFor="f-to">{t("filter.to")}</label>
            <input id="f-to" name="to" type="date" className="input" defaultValue={val(values.to)} />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label" htmlFor="f-cat">{t("filter.category")}</label>
            <select id="f-cat" name="category" className="input" defaultValue={val(values.category)}>
              <option value="">{t("filter.any")}</option>
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>{t(`cat.${c}` as MessageKey)}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="f-method">{t("pm.label").replace(/ \(.*\)$/, "")}</label>
            <select id="f-method" name="method" className="input" defaultValue={val(values.method)}>
              <option value="">{t("pm.any")}</option>
              {PAYMENT_METHODS.map((m) => (
                <option key={m} value={m}>{t(`pm.${m}` as MessageKey)}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="f-person">{t("filter.person")}</label>
            <select id="f-person" name="person" className="input" defaultValue={val(values.person)}>
              <option value="">{t("filter.any")}</option>
              {members.map((m) => (
                <option key={m.id} value={m.id}>{m.name}</option>
              ))}
            </select>
          </div>
        </div>
        <div className="flex gap-2">
          <button className="btn flex-1">{t("filter.apply")}</button>
          <Link className="btn-secondary" href={`/groups/${groupId}?tab=expenses`}>{t("filter.reset")}</Link>
        </div>
      </form>
    </details>
  );
}
