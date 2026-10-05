"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/client-api";
import { useI18n } from "@/i18n/client";
import { ErrorMessage } from "./ErrorMessage";

type Prefs = { email: string | null; emailNotifications: boolean; weeklyDigest: boolean; hasPassword: boolean; mailEnabled: boolean };

/** Eigene E-Mail-Adresse und E-Mail-Benachrichtigungen (beides Standard aus). */
export function EmailSettings({ initial }: { initial: Prefs }) {
  const { t } = useI18n();
  const router = useRouter();
  const [p, setP] = useState(initial);
  const [email, setEmail] = useState(initial.email ?? "");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<unknown>(null);
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);

  async function toggle(patch: Partial<Pick<Prefs, "emailNotifications" | "weeklyDigest">>) {
    setError(null);
    setSaved(false);
    const before = p;
    setP({ ...p, ...patch });
    try {
      await api("PATCH", "/api/auth/me", patch);
      setSaved(true);
    } catch (e) {
      setP(before);
      setError(e);
    }
  }

  async function saveEmail(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaved(false);
    setBusy(true);
    try {
      await api("PUT", "/api/account/email", { email: email.trim(), password });
      setP({ ...p, email: email.trim() || null });
      setPassword("");
      setSaved(true);
      router.refresh();
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  }

  const changed = email.trim().toLowerCase() !== (p.email ?? "");
  return (
    <section className="card flex flex-col gap-4" data-testid="email-settings">
      <h2 className="font-semibold">{t("email.title")}</h2>
      <form onSubmit={saveEmail} className="flex flex-col gap-3">
        <div>
          <label className="label" htmlFor="own-email">{t("email.address")}</label>
          <input id="own-email" type="email" className="input" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
        </div>
        {changed && p.hasPassword && (
          <div>
            <label className="label" htmlFor="email-password">{t("password.current")}</label>
            <input id="email-password" type="password" className="input" value={password} onChange={(e) => setPassword(e.target.value)} required autoComplete="current-password" />
            <p className="muted mt-1">{t("email.passwordHelp")}</p>
          </div>
        )}
        {changed && <button className="btn-secondary" disabled={busy}>{t("email.save")}</button>}
      </form>
      {!p.mailEnabled ? (
        <p className="muted">{t("email.unavailable")}</p>
      ) : !p.email ? (
        <p className="muted">{t("email.noAddress")}</p>
      ) : (
        <>
          <label className="flex items-start gap-3">
            <input type="checkbox" className="mt-1 h-5 w-5" data-testid="email-notifications" checked={p.emailNotifications} onChange={(e) => toggle({ emailNotifications: e.target.checked })} />
            <span>
              <span className="font-medium">{t("email.notifications")}</span>
              <span className="muted block">{t("email.notificationsHelp")}</span>
            </span>
          </label>
          <label className="flex items-start gap-3">
            <input type="checkbox" className="mt-1 h-5 w-5" data-testid="weekly-digest" checked={p.weeklyDigest} onChange={(e) => toggle({ weeklyDigest: e.target.checked })} />
            <span>
              <span className="font-medium">{t("email.digest")}</span>
              <span className="muted block">{t("email.digestHelp")}</span>
            </span>
          </label>
        </>
      )}
      {saved && <p className="pos text-sm" role="status">{t("admin.done")}</p>}
      <ErrorMessage error={error} />
    </section>
  );
}
