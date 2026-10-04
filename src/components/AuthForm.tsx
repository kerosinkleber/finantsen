"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { api, ApiClientError } from "@/lib/client-api";
import { useI18n } from "@/i18n/client";
import { ErrorMessage } from "./ErrorMessage";

type Account = { id: string; name: string; username: string; createdAt: string };

/** Anmeldung mit Nutzername oder E-Mail. Bei mehreren Konten zur selben E-Mail erscheint eine Auswahl. */
export function LoginForm({ next, registrationEnabled, devAdmin = false }: { next?: string; registrationEnabled: boolean; devAdmin?: boolean }) {
  const { t, locale } = useI18n();
  const router = useRouter();
  const [error, setError] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);
  const [accounts, setAccounts] = useState<Account[] | null>(null);
  const [userId, setUserId] = useState("");

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setBusy(true);
    setError(null);
    try {
      const r = await api<{ user: { mustChangePassword: boolean } }>("POST", "/api/auth/login", {
        identifier: f.get("identifier"),
        password: f.get("password"),
        userId: userId || undefined,
      });
      const target = r.user.mustChangePassword ? "/change-password" : next && next.startsWith("/") ? next : "/";
      router.replace(target);
      router.refresh();
    } catch (err) {
      if (err instanceof ApiClientError && err.code === "choose_account") {
        const list = (err.data?.accounts ?? []) as Account[];
        if (list.length > 0) {
          setAccounts(list);
          setUserId(list[0].id);
          setBusy(false);
          return;
        }
      }
      setError(err);
      setBusy(false);
    }
  }

  async function devLogin() {
    setBusy(true);
    setError(null);
    try {
      await api("POST", "/api/dev/login");
      router.replace(next && next.startsWith("/") ? next : "/");
      router.refresh();
    } catch (err) {
      setError(err);
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="card flex flex-col gap-4">
      <h2 className="text-xl font-semibold">{t("auth.login")}</h2>
      {devAdmin && (
        <div className="flex flex-col gap-2 rounded-lg border-2 border-dashed border-amber-500 p-3" data-testid="dev-admin">
          <p className="text-sm font-medium text-amber-700 dark:text-amber-400">{t("dev.warning")}</p>
          <button type="button" className="btn" disabled={busy} onClick={devLogin}>{t("dev.login")}</button>
        </div>
      )}
      <div>
        <label className="label" htmlFor="identifier">{t("auth.identifier")}</label>
        <input id="identifier" name="identifier" className="input" required autoComplete="username" autoCapitalize="none" spellCheck={false} />
      </div>
      <div>
        <label className="label" htmlFor="password">{t("auth.password")}</label>
        <input id="password" name="password" type="password" className="input" required autoComplete="current-password" />
      </div>
      {accounts && (
        <fieldset className="flex flex-col gap-2" data-testid="account-picker">
          <legend className="label">{t("auth.chooseAccount")}</legend>
          {accounts.map((a) => (
            <label key={a.id} className="flex items-center gap-3 rounded-lg border border-slate-300 p-3 dark:border-slate-700">
              <input type="radio" name="account" value={a.id} checked={userId === a.id} onChange={() => setUserId(a.id)} />
              <span>
                <span className="font-medium">{a.name}</span> <span className="muted">@{a.username}</span>
                <span className="muted block">{t("auth.accountCreated", { date: new Date(a.createdAt).toLocaleDateString(locale) })}</span>
              </span>
            </label>
          ))}
        </fieldset>
      )}
      <ErrorMessage error={error} />
      <button className="btn" disabled={busy}>{t("auth.login")}</button>
      <p className="muted text-center">{t("auth.notActivated")}</p>
      {registrationEnabled && (
        <p className="muted text-center">
          {t("auth.noAccount")} <Link className="font-medium text-brand underline" href="/register">{t("auth.register")}</Link>
        </p>
      )}
    </form>
  );
}
