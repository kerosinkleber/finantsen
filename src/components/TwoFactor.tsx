"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { api } from "@/lib/client-api";
import { useI18n } from "@/i18n/client";
import { ErrorMessage } from "./ErrorMessage";

type Status = { enabled: boolean; required: boolean; recoveryRemaining: number };
type Setup = { secret: string; uri: string; qr: string };

function RecoveryCodes({ codes }: { codes: string[] }) {
  const { t } = useI18n();
  if (codes.length === 0) return <p className="muted" data-testid="no-recovery">{t("totp.noRecovery")}</p>;
  return (
    <div className="flex flex-col gap-2 rounded-lg bg-slate-100 p-3 dark:bg-slate-800" data-testid="recovery-codes">
      <p className="font-medium">{t("totp.recoveryTitle")}</p>
      <p className="muted">{t("totp.recoveryHelp")}</p>
      <ul className="font-mono text-lg">
        {codes.map((c) => (
          <li key={c} data-testid="recovery-code">{c}</li>
        ))}
      </ul>
      <button type="button" className="btn-secondary" onClick={() => navigator.clipboard?.writeText(codes.join("\n"))}>{t("totp.copy")}</button>
    </div>
  );
}

/** TOTP einrichten, Wiederherstellungscodes neu erzeugen, ausschalten (wenn nicht verlangt). */
export function TwoFactor({ initial, forced }: { initial: Status; forced: boolean }) {
  const { t } = useI18n();
  const router = useRouter();
  const [status, setStatus] = useState(initial);
  const [setup, setSetup] = useState<Setup | null>(null);
  const [codes, setCodes] = useState<string[] | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);

  async function run(fn: () => Promise<void>) {
    setBusy(true);
    setError(null);
    try {
      await fn();
    } catch (e) {
      setError(e);
    }
    setBusy(false);
  }
  const refresh = async () => setStatus(await api<Status>("GET", "/api/auth/totp"));

  const start = () => run(async () => setSetup(await api<Setup>("POST", "/api/auth/totp/setup")));
  const confirm = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const code = new FormData(e.currentTarget).get("code");
    return run(async () => {
      const r = await api<{ recoveryCodes: string[] }>("POST", "/api/auth/totp/confirm", { code });
      setSetup(null);
      setCodes(r.recoveryCodes);
      await refresh();
    });
  };
  const regenerate = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const password = new FormData(e.currentTarget).get("password");
    return run(async () => {
      const r = await api<{ recoveryCodes: string[] }>("POST", "/api/auth/totp/recovery", { password });
      setCodes(r.recoveryCodes);
      await refresh();
    });
  };
  const disable = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    return run(async () => {
      await api("POST", "/api/auth/totp/disable", { password: f.get("password"), code: f.get("code") });
      setCodes(null);
      await refresh();
    });
  };
  const leave = () => {
    router.replace(forced ? "/" : "/settings");
    router.refresh();
  };

  return (
    <div className="card flex flex-col gap-4" data-testid="two-factor">
      <h2 className="text-xl font-semibold">{t("totp.title")}</h2>
      {forced && !status.enabled && <p className="rounded-lg bg-amber-100 p-3 text-sm text-amber-900" data-testid="totp-forced">{t("totp.forced")}</p>}

      {codes && (
        <>
          <RecoveryCodes codes={codes} />
          <button className="btn" data-testid="totp-done" onClick={leave}>{t("totp.done")}</button>
        </>
      )}

      {!codes && !status.enabled && !setup && (
        <>
          <p>{t("totp.intro")}</p>
          <button className="btn" disabled={busy} onClick={start} data-testid="totp-start">{t("totp.start")}</button>
        </>
      )}

      {!codes && !status.enabled && setup && (
        <form onSubmit={confirm} className="flex flex-col gap-3">
          <p>{t("totp.scan")}</p>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={setup.qr} alt={t("totp.qrAlt")} width={220} height={220} className="mx-auto rounded bg-white p-2" data-testid="totp-qr" />
          <p className="muted">{t("totp.manual")}</p>
          <code className="break-all rounded bg-slate-100 p-2 dark:bg-slate-800" data-testid="totp-secret">{setup.secret}</code>
          <div>
            <label className="label" htmlFor="code">{t("totp.confirmCode")}</label>
            <input id="code" name="code" className="input" inputMode="numeric" autoComplete="one-time-code" required />
          </div>
          <button className="btn" disabled={busy}>{t("totp.enable")}</button>
        </form>
      )}

      {!codes && status.enabled && (
        <>
          <p className="pos font-medium" data-testid="totp-on">{t("totp.enabled")}</p>
          <p className="muted" data-testid="recovery-remaining">{t("totp.recoveryRemaining", { n: status.recoveryRemaining })}</p>
          <form onSubmit={regenerate} className="flex flex-col gap-2">
            <label className="label" htmlFor="rpw">{t("totp.regenerate")}</label>
            <input id="rpw" name="password" type="password" className="input" placeholder={t("auth.password")} autoComplete="current-password" required />
            <button className="btn-secondary" disabled={busy} data-testid="regenerate">{t("totp.regenerateButton")}</button>
          </form>
          {status.required ? (
            <p className="muted" data-testid="totp-cannot-disable">{t("totp.cannotDisable")}</p>
          ) : (
            <form onSubmit={disable} className="flex flex-col gap-2">
              <label className="label" htmlFor="dpw">{t("totp.disable")}</label>
              <input id="dpw" name="password" type="password" className="input" placeholder={t("auth.password")} autoComplete="current-password" required />
              <input name="code" className="input" placeholder={t("totp.code")} autoComplete="one-time-code" required />
              <button className="btn-danger" disabled={busy} data-testid="disable-totp">{t("totp.disableButton")}</button>
            </form>
          )}
        </>
      )}

      <ErrorMessage error={error} />
      {!forced && !codes && <Link href="/settings" className="btn-secondary">{t("common.back")}</Link>}
    </div>
  );
}
