"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { api, ApiClientError } from "@/lib/client-api";
import { useI18n } from "@/i18n/client";
import { ErrorMessage } from "./ErrorMessage";

export function AuthForm({ mode, inviteCode, next }: { mode: "login" | "register"; inviteCode?: string; next?: string }) {
  const { t, locale } = useI18n();
  const router = useRouter();
  const [error, setError] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);
  const [accounts, setAccounts] = useState<{ id: string; name: string; createdAt: string }[] | null>(null);
  const [userId, setUserId] = useState<string>("");

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setBusy(true);
    setError(null);
    let target = next && next.startsWith("/") ? next : "/";
    try {
      if (mode === "login") {
        await api("POST", "/api/auth/login", { email: f.get("email"), password: f.get("password"), userId: userId || undefined });
      } else {
        const r = await api<{ joinedGroupId?: string }>("POST", "/api/auth/register", {
          email: f.get("email"),
          name: f.get("name"),
          password: f.get("password"),
          inviteCode,
        });
        if (r.joinedGroupId) target = `/groups/${r.joinedGroupId}`;
      }
      router.replace(target);
      router.refresh();
    } catch (err) {
      if (err instanceof ApiClientError && err.code === "choose_account") {
        // Mehrere Konten mit dieser E-Mail und diesem Passwort: Konto auswählen lassen
        const list = (err.data?.accounts ?? []) as { id: string; name: string; createdAt: string }[];
        if (list.length > 0) {
          setAccounts(list);
          setUserId(list[0].id);
          setError(null);
          setBusy(false);
          return;
        }
      }
      setError(err);
      setBusy(false);
    }
  }

  const q = next ? `?next=${encodeURIComponent(next)}` : "";
  return (
    <form onSubmit={submit} className="card flex flex-col gap-4">
      <h2 className="text-xl font-semibold">{t(mode === "login" ? "auth.login" : "auth.register")}</h2>
      {mode === "register" && (
        <div>
          <label className="label" htmlFor="name">{t("auth.name")}</label>
          <input id="name" name="name" className="input" required maxLength={100} autoComplete="name" />
        </div>
      )}
      <div>
        <label className="label" htmlFor="email">{t("auth.email")}</label>
        <input id="email" name="email" type="email" className="input" required autoComplete="email" />
      </div>
      <div>
        <label className="label" htmlFor="password">{t("auth.password")}</label>
        <input
          id="password"
          name="password"
          type="password"
          className="input"
          required
          minLength={mode === "register" ? 8 : 1}
          autoComplete={mode === "login" ? "current-password" : "new-password"}
        />
        {mode === "register" && <p className="muted mt-1">{t("auth.passwordHint")}</p>}
      </div>
      {accounts && (
        <fieldset className="flex flex-col gap-2" data-testid="account-picker">
          <legend className="label">{t("auth.chooseAccount")}</legend>
          {accounts.map((a) => (
            <label key={a.id} className="flex items-center gap-3 rounded-lg border border-slate-300 p-3 dark:border-slate-700">
              <input type="radio" name="account" value={a.id} checked={userId === a.id} onChange={() => setUserId(a.id)} />
              <span>
                <span className="font-medium">{a.name}</span>
                <span className="muted block">{t("auth.accountCreated", { date: new Date(a.createdAt).toLocaleDateString(locale) })}</span>
              </span>
            </label>
          ))}
        </fieldset>
      )}
      <ErrorMessage error={error} />
      <button className="btn" disabled={busy}>{t(mode === "login" ? "auth.login" : "auth.register")}</button>
      <p className="muted text-center">
        {mode === "login" ? (
          <>
            {t("auth.noAccount")} <Link className="font-medium text-brand underline" href={`/register${q}`}>{t("auth.register")}</Link>
          </>
        ) : (
          <>
            {t("auth.haveAccount")} <Link className="font-medium text-brand underline" href={`/login${q}`}>{t("auth.login")}</Link>
          </>
        )}
      </p>
    </form>
  );
}
