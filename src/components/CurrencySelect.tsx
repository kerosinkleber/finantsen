"use client";
import { useEffect, useMemo, useState } from "react";
import { useI18n } from "@/i18n/client";

export const COMMON_CURRENCIES = ["EUR", "USD", "GBP", "CHF", "JPY", "SEK", "NOK", "DKK", "PLN", "CZK", "HUF", "TRY", "CAD", "AUD"];

let cached: string[] | null = null;
let pending: Promise<string[]> | null = null;

/** Lädt die vom Wechselkursanbieter unterstützten Währungen einmal pro Seitenaufruf. */
function loadCurrencies(): Promise<string[]> {
  if (cached) return Promise.resolve(cached);
  pending ??= fetch("/api/currencies")
    .then((r) => (r.ok ? r.json() : Promise.reject(new Error("failed"))))
    .then((j: { currencies: string[] }) => (cached = j.currencies))
    .catch(() => COMMON_CURRENCIES)
    .finally(() => (pending = null));
  return pending;
}

export function CurrencySelect({ id, value, onChange }: { id?: string; value: string; onChange: (v: string) => void }) {
  const { locale } = useI18n();
  const [all, setAll] = useState<string[]>(cached ?? COMMON_CURRENCIES);
  useEffect(() => {
    let alive = true;
    loadCurrencies().then((l) => alive && setAll(l));
    return () => {
      alive = false;
    };
  }, []);
  const dn = useMemo(() => new Intl.DisplayNames(locale, { type: "currency" }), [locale]);
  const label = (c: string) => `${c} – ${dn.of(c) ?? c}`;
  const common = COMMON_CURRENCIES.filter((c) => all.includes(c) || c === value);
  const rest = all.filter((c) => !COMMON_CURRENCIES.includes(c)).sort();
  // Aktueller Wert muss immer wählbar sein (z. B. alte Ausgabe in einer inzwischen nicht mehr gelisteten Währung)
  const extra = !common.includes(value) && !rest.includes(value) ? [value] : [];
  return (
    <select id={id} className="input" value={value} onChange={(e) => onChange(e.target.value)}>
      {[...common, ...extra].map((c) => (
        <option key={c} value={c}>{label(c)}</option>
      ))}
      {rest.length > 0 && (
        <optgroup label="…">
          {rest.map((c) => (
            <option key={c} value={c}>{label(c)}</option>
          ))}
        </optgroup>
      )}
    </select>
  );
}
