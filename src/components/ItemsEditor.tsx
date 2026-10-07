"use client";
import { useI18n } from "@/i18n/client";
import { formatMoney } from "@/lib/money";

export type ItemRow = { key: string; name: string; price: string; who: string[] };

let seq = 0;
export const newRow = (who: string[], name = "", price = ""): ItemRow => ({ key: `r${Date.now()}-${seq++}`, name, price, who });

/** Positionen mit Zuordnung zu Personen sowie Steuer und Trinkgeld (kontrollierte Komponente). */
export function ItemsEditor({ members, currency, rows, setRows, tax, setTax, tip, setTip, totalMinor }: {
  members: { id: string; name: string }[];
  currency: string;
  rows: ItemRow[];
  setRows: (r: ItemRow[]) => void;
  tax: string;
  setTax: (v: string) => void;
  tip: string;
  setTip: (v: string) => void;
  totalMinor: number;
}) {
  const { t, locale } = useI18n();
  const update = (key: string, patch: Partial<ItemRow>) => setRows(rows.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  const toggle = (r: ItemRow, id: string) => update(r.key, { who: r.who.includes(id) ? r.who.filter((x) => x !== id) : [...r.who, id] });

  return (
    <div className="flex flex-col gap-3" data-testid="items">
      <h3 className="font-medium">{t("items.title")}</h3>
      <ul className="flex flex-col gap-3">
        {rows.map((r, i) => (
          <li key={r.key} className="rounded-lg border border-slate-200 p-3 dark:border-slate-700" data-testid="item-row">
            <div className="grid grid-cols-[1fr_7rem] gap-2">
              <input className="input" placeholder={t("items.name")} aria-label={`${t("items.name")} ${i + 1}`} value={r.name} onChange={(e) => update(r.key, { name: e.target.value })} maxLength={200} />
              <input className="input text-right" inputMode="decimal" placeholder="0,00" aria-label={`${t("items.amount")} ${i + 1}`} value={r.price} onChange={(e) => update(r.key, { price: e.target.value })} />
            </div>
            <p className="muted mt-2">{t("items.who")}</p>
            <div className="mt-1 flex flex-wrap gap-2">
              {members.map((m) => (
                <button
                  type="button"
                  key={m.id}
                  aria-pressed={r.who.includes(m.id)}
                  aria-label={`${m.name} ${i + 1}`}
                  onClick={() => toggle(r, m.id)}
                  className={`min-h-9 rounded-full border px-3 text-sm ${r.who.includes(m.id) ? "border-brand bg-brand text-white" : "border-slate-300 dark:border-slate-700"}`}
                >
                  {m.name}
                </button>
              ))}
            </div>
            {rows.length > 1 && (
              <button type="button" className="muted mt-2 underline" onClick={() => setRows(rows.filter((x) => x.key !== r.key))}>{t("items.remove")}</button>
            )}
          </li>
        ))}
      </ul>
      <button type="button" className="btn-secondary" onClick={() => setRows([...rows, newRow(members.map((m) => m.id))])}>{t("items.add")}</button>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label" htmlFor="tax">{t("items.tax")}</label>
          <input id="tax" className="input text-right" inputMode="decimal" value={tax} onChange={(e) => setTax(e.target.value)} placeholder="0,00" />
        </div>
        <div>
          <label className="label" htmlFor="tip">{t("items.tip")}</label>
          <input id="tip" className="input text-right" inputMode="decimal" value={tip} onChange={(e) => setTip(e.target.value)} placeholder="0,00" />
        </div>
      </div>
      <p className="font-medium" data-testid="items-total">{t("items.total", { amount: formatMoney(totalMinor, currency, locale) })}</p>
    </div>
  );
}
