"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { api, ApiClientError } from "@/lib/client-api";
import { useI18n } from "@/i18n/client";
import { parseAmount, toInputString } from "@/lib/money";
import { ErrorMessage } from "./ErrorMessage";

/** Budget der Gruppe (nur Besitzer): Betrag in der Gruppenwährung, je Monat oder insgesamt. */
export function BudgetForm({ groupId, currency, initial }: { groupId: string; currency: string; initial: { amountMinor: number; period: "month" | "total" } | null }) {
  const { t, locale } = useI18n();
  const router = useRouter();
  const [amount, setAmount] = useState(initial ? toInputString(initial.amountMinor, currency, locale) : "");
  const [period, setPeriod] = useState<"month" | "total">(initial?.period ?? "month");
  const [error, setError] = useState<unknown>(null);
  const [saved, setSaved] = useState(false);

  async function save(budget: { amountMinor: number; period: "month" | "total" } | null) {
    setError(null);
    setSaved(false);
    try {
      await api("PATCH", `/api/groups/${groupId}`, { budget });
      setSaved(true);
      if (!budget) setAmount("");
      router.refresh();
    } catch (e) {
      setError(e);
    }
  }

  return (
    <form
      className="card flex flex-col gap-3"
      data-testid="budget-form"
      onSubmit={(e) => {
        e.preventDefault();
        const minor = parseAmount(amount, currency);
        if (!minor || minor <= 0) return setError(new ApiClientError(400, "invalid_amount"));
        save({ amountMinor: minor, period });
      }}
    >
      <h2 className="font-semibold">{t("budget.title")}</h2>
      <p className="muted">{t("budget.help")}</p>
      <div className="flex gap-2">
        <div className="flex-1">
          <label className="label" htmlFor="budget-amount">{t("budget.amount", { currency })}</label>
          <input id="budget-amount" className="input" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
        </div>
        <div className="flex-1">
          <label className="label" htmlFor="budget-period">&nbsp;</label>
          <select id="budget-period" aria-label={t("budget.title")} className="input" value={period} onChange={(e) => setPeriod(e.target.value as "month" | "total")}>
            <option value="month">{t("budget.period.month")}</option>
            <option value="total">{t("budget.period.total")}</option>
          </select>
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        <button className="btn-secondary">{t("budget.save")}</button>
        {initial && <button type="button" className="btn-secondary" onClick={() => save(null)}>{t("budget.remove")}</button>}
      </div>
      {saved && <p className="pos text-sm" role="status">{t("admin.done")}</p>}
      <ErrorMessage error={error} />
    </form>
  );
}
