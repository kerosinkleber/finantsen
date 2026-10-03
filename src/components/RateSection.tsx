"use client";
import { useEffect, useState } from "react";
import { useI18n } from "@/i18n/client";
import { api, ApiClientError } from "@/lib/client-api";
import { convertMinor, formatMoney, normalizeRate } from "@/lib/money";
import type { MessageKey } from "@/i18n";

type Preview = { rate: string; date: string };
type State = { status: "loading" } | { status: "ok"; data: Preview } | { status: "error"; code: string };

/** Zeigt den Kurs zum Buchungsdatum (automatisch) und erlaubt, ihn manuell zu überschreiben. */
export function RateSection({ from, to, date, amountMinor, stored, manual, setManual }: {
  from: string;
  to: string;
  date: string;
  amountMinor: number | null;
  /** Bereits gespeicherter Kurs der bearbeiteten Ausgabe (gilt, solange Währung und Datum gleich bleiben) */
  stored?: { rate: string; source: string; currency: string; date: string } | null;
  manual: string | null; // null = automatisch
  setManual: (v: string | null) => void;
}) {
  const { t, locale } = useI18n();
  const [state, setState] = useState<State>({ status: "loading" });
  const useStored = !!stored && stored.currency === from && stored.date === date && stored.source !== "same";

  useEffect(() => {
    if (from === to || useStored) return;
    let alive = true;
    setState({ status: "loading" });
    const h = setTimeout(async () => {
      try {
        const r = await api<Preview>("GET", `/api/rates?from=${from}&to=${to}&date=${date}`);
        if (alive) setState({ status: "ok", data: r });
      } catch (e) {
        if (alive) setState({ status: "error", code: e instanceof ApiClientError ? e.code : "internal" });
      }
    }, 300);
    return () => {
      alive = false;
      clearTimeout(h);
    };
  }, [from, to, date, useStored]);

  if (from === to) return null;

  const num = (r: string) => new Intl.NumberFormat(locale, { maximumSignificantDigits: 8 }).format(Number(r));
  const auto = useStored ? stored!.rate : state.status === "ok" ? state.data.rate : null;
  const effective = manual !== null ? normalizeRate(manual) : auto;
  const converted = effective && amountMinor ? convertMinor(amountMinor, from, to, effective) : null;
  const errored = state.status === "error" && !useStored;

  return (
    <div className="card flex flex-col gap-2" data-testid="rate">
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-semibold">{t("rate.label")}</h2>
        {!errored && (
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" className="h-4 w-4" checked={manual !== null} onChange={(e) => setManual(e.target.checked ? (auto ? String(Number(auto)) : "") : null)} />
            {t("rate.manual")}
          </label>
        )}
      </div>
      {manual === null && !errored && (
        <p className="text-sm" data-testid="rate-auto">
          {auto
            ? useStored
              ? t("rate.stored", { from, to, rate: num(auto), source: t(`rate.source.${stored!.source === "manual" ? "manual" : "provider"}` as MessageKey) })
              : t("rate.auto", { from, to, rate: num(auto), date: state.status === "ok" ? state.data.date : date })
            : t("rate.loading")}
        </p>
      )}
      {(manual !== null || errored) && (
        <div className="flex flex-col gap-1">
          {errored && <p className="text-sm text-red-700 dark:text-red-400" data-testid="rate-error">{t("rate.unavailable")}</p>}
          <label className="label" htmlFor="manual-rate">{t("rate.manualHint", { from, to })}</label>
          <input id="manual-rate" className="input" inputMode="decimal" value={manual ?? ""} onChange={(e) => setManual(e.target.value)} />
        </div>
      )}
      {converted !== null && (
        <p className="muted" data-testid="rate-converted">{t("rate.converted", { amount: formatMoney(converted, to, locale), currency: to })}</p>
      )}
    </div>
  );
}
