"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { api } from "@/lib/client-api";
import { useI18n } from "@/i18n/client";
import { ErrorMessage } from "./ErrorMessage";

export function AuthForm({ mode, inviteCode, next }: { mode: "login" | "register"; inviteCode?: string; next?: string }) {
  const { t } = useI18n();
  const router = useRouter();
  const [error, setError] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setBusy(true);
    setError(null);
    let target = next && next.startsWith("/") ? next : "/";
    try {
      if (mode === "login") {
        await api("POST", "/api/auth/login", { email: f.get("email"), password: f.get("password") });
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
