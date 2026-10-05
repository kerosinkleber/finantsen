"use client";
import { useState } from "react";
import { api } from "@/lib/client-api";
import { useI18n } from "@/i18n/client";
import { formatIban } from "@/lib/payment";
import { ErrorMessage } from "./ErrorMessage";

type Info = { holder: string | null; iban: string | null; paypal: string | null };

/** Eigene Bezahldaten für „Bezahlen beim Begleichen“ (GiroCode, PayPal.me). Ändern nur mit Passwort. */
export function PaymentSettings({ initial, hasPassword }: { initial: Info; hasPassword: boolean }) {
  const { t } = useI18n();
  const [holder, setHolder] = useState(initial.holder ?? "");
  const [iban, setIban] = useState(initial.iban ? formatIban(initial.iban) : "");
  const [paypal, setPaypal] = useState(initial.paypal ?? "");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<unknown>(null);
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setSaved(false);
    try {
      const r = await api<Info>("PUT", "/api/account/payment", { holder, iban, paypal, password });
      setHolder(r.holder ?? "");
      setIban(r.iban ? formatIban(r.iban) : "");
      setPaypal(r.paypal ?? "");
      setPassword("");
      setSaved(true);
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={save} className="card flex flex-col gap-3" data-testid="payment-settings">
      <h2 className="font-semibold">{t("pay.title")}</h2>
      <p className="muted">{t("pay.help")}</p>
      <div>
        <label className="label" htmlFor="pay-holder">{t("pay.holder")}</label>
        <input id="pay-holder" className="input" value={holder} onChange={(e) => setHolder(e.target.value)} autoComplete="name" maxLength={70} />
      </div>
      <div>
        <label className="label" htmlFor="pay-iban">{t("pay.iban")}</label>
        <input id="pay-iban" className="input font-mono" value={iban} onChange={(e) => setIban(e.target.value)} autoCapitalize="characters" placeholder="DE89 3704 0044 0532 0130 00" />
      </div>
      <div>
        <label className="label" htmlFor="pay-paypal">{t("pay.paypal")}</label>
        <div className="flex items-center gap-1">
          <span className="muted">paypal.me/</span>
          <input id="pay-paypal" className="input" value={paypal} onChange={(e) => setPaypal(e.target.value)} autoCapitalize="none" />
        </div>
      </div>
      {hasPassword && (
        <div>
          <label className="label" htmlFor="pay-password">{t("password.current")}</label>
          <input id="pay-password" type="password" className="input" value={password} onChange={(e) => setPassword(e.target.value)} required autoComplete="current-password" />
          <p className="muted mt-1">{t("pay.passwordHelp")}</p>
        </div>
      )}
      <button className="btn-secondary" disabled={busy}>{t("pay.save")}</button>
      {saved && <p className="pos text-sm" role="status">{t("admin.done")}</p>}
      <ErrorMessage error={error} />
    </form>
  );
}
