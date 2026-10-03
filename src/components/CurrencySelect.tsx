"use client";
import { useI18n } from "@/i18n/client";

// Phase 1: eine Auswahl gängiger Währungen. Phase 3 erweitert auf >100 mit Umrechnung.
export const COMMON_CURRENCIES = ["EUR", "USD", "GBP", "CHF", "JPY", "SEK", "NOK", "DKK", "PLN", "CZK", "HUF", "TRY", "CAD", "AUD", "KWD"];

export function CurrencySelect({ id, value, onChange }: { id?: string; value: string; onChange: (v: string) => void }) {
  const { locale } = useI18n();
  const dn = new Intl.DisplayNames(locale, { type: "currency" });
  return (
    <select id={id} className="input" value={value} onChange={(e) => onChange(e.target.value)}>
      {COMMON_CURRENCIES.map((c) => (
        <option key={c} value={c}>{c} – {dn.of(c)}</option>
      ))}
    </select>
  );
}
