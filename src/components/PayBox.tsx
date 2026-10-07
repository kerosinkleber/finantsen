"use client";
import { useI18n } from "@/i18n/client";
import { epcPayload, formatIban, paypalMeUrl } from "@/lib/payment";
import { QrCode } from "./QrCode";
import { CopyButton } from "./CopyButton";

/**
 * „Bezahlen“ bei einem eigenen Ausgleichsvorschlag: GiroCode (nur Euro) und/oder PayPal.me-Link mit Betrag.
 * Nach dem Bezahlen trägt man die Zahlung wie gewohnt über „Begleichen“ ein.
 */
export function PayBox({ to, amountMinor, currency, text, holder, iban, paypal }: {
  to: string;
  amountMinor: number;
  currency: string;
  text: string;
  holder: string | null;
  iban: string | null;
  paypal: string | null;
}) {
  const { t } = useI18n();
  const fraction = new Intl.NumberFormat("en", { style: "currency", currency }).resolvedOptions().maximumFractionDigits ?? 2;
  const epc = iban && holder ? epcPayload({ name: holder, iban, amountMinor, currency, text }) : null;
  const pp = paypal ? paypalMeUrl(paypal, amountMinor, currency, fraction) : null;
  if (!iban && !pp) return null;
  return (
    <details className="rounded-lg bg-slate-50 p-3 text-sm dark:bg-slate-800" data-testid="pay-box">
      <summary className="cursor-pointer font-medium">{t("pay.open", { name: to })}</summary>
      <div className="mt-3 flex flex-col gap-3">
        {epc && (
          <div className="flex flex-col gap-1">
            <QrCode text={epc} label={t("pay.qrAlt")} />
            <p className="muted text-center">{t("pay.qrHelp")}</p>
          </div>
        )}
        {iban && (
          <div>
            <p className="muted">{t("pay.ibanOf", { name: holder ?? to })}</p>
            <div className="flex flex-wrap items-center gap-2">
              <code className="break-all" data-testid="pay-iban">{formatIban(iban)}</code>
              <CopyButton text={iban} className="btn-secondary !min-h-9 !px-3" />
            </div>
            {!epc && currency !== "EUR" && <p className="muted mt-1">{t("pay.qrEuroOnly")}</p>}
          </div>
        )}
        {pp && (
          <a href={pp} target="_blank" rel="noopener noreferrer" className="btn-secondary" data-testid="pay-paypal">
            {t("pay.paypalOpen")}
          </a>
        )}
        <p className="muted">{t("pay.afterwards")}</p>
      </div>
    </details>
  );
}
