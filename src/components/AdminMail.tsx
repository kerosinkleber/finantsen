"use client";
import { useState } from "react";
import { api, ApiClientError } from "@/lib/client-api";
import { useI18n } from "@/i18n/client";
import { ErrorMessage } from "./ErrorMessage";

type Smtp = { host: string; port: number; security: "tls" | "starttls" | "none"; user: string; from: string; hasPassword: boolean };
export type MailState = { source: "env" | "admin" | null; smtp: Smtp | null };

/**
 * E-Mail-Versand im Admin-Bereich: Status, Mailserver (nur wenn nicht über .env eingerichtet), Test-Mail und
 * der Schalter für „Passwort vergessen“.
 */
export function AdminMail({ initial, passwordReset, onPasswordReset }: { initial: MailState; passwordReset: boolean; onPasswordReset: (v: boolean) => void }) {
  const { t } = useI18n();
  const [state, setState] = useState(initial);
  const s = state.smtp;
  const [host, setHost] = useState(s?.host ?? "");
  const [port, setPort] = useState(String(s?.port ?? 587));
  const [security, setSecurity] = useState<Smtp["security"]>(s?.security ?? "starttls");
  const [user, setUser] = useState(s?.user ?? "");
  const [pass, setPass] = useState("");
  const [from, setFrom] = useState(s?.from ?? "");
  const [error, setError] = useState<unknown>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const locked = state.source === "env";

  async function run(fn: () => Promise<void>) {
    setError(null);
    setInfo(null);
    setBusy(true);
    try {
      await fn();
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  }

  const save = (e: React.FormEvent) => {
    e.preventDefault();
    return run(async () => {
      setState(await api<MailState>("PUT", "/api/admin/mail", { host: host.trim(), port: Number(port), security, user: user.trim(), pass, from: from.trim() }));
      setPass("");
      setInfo(t("admin.done"));
    });
  };
  const remove = () =>
    run(async () => {
      setState(await api<MailState>("DELETE", "/api/admin/mail"));
      setHost("");
      setUser("");
      setPass("");
      setFrom("");
      setInfo(t("admin.done"));
    });
  const test = () =>
    run(async () => {
      const r = await api<{ to: string }>("POST", "/api/admin/mail/test");
      setInfo(t("admin.mail.testSent", { email: r.to }));
    });

  const detail = error instanceof ApiClientError && typeof error.data?.detail === "string" ? error.data.detail : null;
  return (
    <section className="card flex flex-col gap-4" data-testid="admin-mail">
      <h2 className="font-semibold">{t("admin.mail.title")}</h2>
      <p data-testid="mail-status">
        {state.source === "env" ? t("admin.mail.statusEnv") : state.source === "admin" ? t("admin.mail.statusAdmin") : t("admin.mail.statusOff")}
      </p>
      {state.source && (
        <button type="button" className="btn-secondary" disabled={busy} onClick={test} data-testid="mail-test">{t("admin.mail.test")}</button>
      )}
      <label className="flex items-start gap-3">
        <input type="checkbox" className="mt-1 h-5 w-5" data-testid="password-reset-setting" checked={passwordReset} onChange={(e) => onPasswordReset(e.target.checked)} />
        <span>
          <span className="font-medium">{t("admin.mail.passwordReset")}</span>
          <span className="muted block">{t("admin.mail.passwordResetHelp")}</span>
        </span>
      </label>
      <form onSubmit={save} className="flex flex-col gap-3">
        {locked && <p className="muted">{t("admin.mail.envHint")}</p>}
        <fieldset disabled={locked || busy} className="flex flex-col gap-3">
          <div className="flex gap-2">
            <div className="flex-1">
              <label className="label" htmlFor="smtp-host">{t("admin.mail.host")}</label>
              <input id="smtp-host" className="input" value={host} onChange={(e) => setHost(e.target.value)} required autoCapitalize="none" placeholder="mail.example.org" />
            </div>
            <div className="w-24">
              <label className="label" htmlFor="smtp-port">{t("admin.mail.port")}</label>
              <input id="smtp-port" className="input" inputMode="numeric" value={port} onChange={(e) => setPort(e.target.value)} required />
            </div>
          </div>
          <div>
            <label className="label" htmlFor="smtp-security">{t("admin.mail.security")}</label>
            <select id="smtp-security" className="input" value={security} onChange={(e) => setSecurity(e.target.value as Smtp["security"])}>
              <option value="starttls">{t("admin.mail.sec.starttls")}</option>
              <option value="tls">{t("admin.mail.sec.tls")}</option>
              <option value="none">{t("admin.mail.sec.none")}</option>
            </select>
          </div>
          <div>
            <label className="label" htmlFor="smtp-user">{t("admin.mail.user")}</label>
            <input id="smtp-user" className="input" value={user} onChange={(e) => setUser(e.target.value)} autoComplete="off" autoCapitalize="none" />
          </div>
          <div>
            <label className="label" htmlFor="smtp-pass">{t("admin.mail.pass")}</label>
            <input id="smtp-pass" type="password" className="input" value={pass} onChange={(e) => setPass(e.target.value)} autoComplete="new-password" />
            {s?.hasPassword && <p className="muted mt-1">{t("admin.mail.passKeep")}</p>}
          </div>
          <div>
            <label className="label" htmlFor="smtp-from">{t("admin.mail.from")}</label>
            <input id="smtp-from" className="input" value={from} onChange={(e) => setFrom(e.target.value)} required placeholder={t("admin.mail.fromHelp")} />
          </div>
          {!locked && (
            <div className="flex flex-wrap gap-2">
              <button className="btn">{t("admin.mail.save")}</button>
              {s && <button type="button" className="btn-secondary" onClick={remove}>{t("admin.mail.remove")}</button>}
            </div>
          )}
        </fieldset>
      </form>
      {info && <p className="pos text-sm" role="status">{info}</p>}
      <ErrorMessage error={error} />
      {detail && <p className="muted break-all text-xs" data-testid="mail-error-detail">{detail}</p>}
    </section>
  );
}
