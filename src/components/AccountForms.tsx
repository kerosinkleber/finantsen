"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { api, ApiClientError } from "@/lib/client-api";
import { useI18n } from "@/i18n/client";
import { ErrorMessage } from "./ErrorMessage";
import { PasswordField } from "./PasswordField";
import { clearOfflineCaches } from "./ServiceWorker";
import { passwordIssues } from "@/lib/password";

/** Gemeinsame Felder für Einrichtung und Selbstregistrierung. */
function ProfileForm({ endpoint, submitKey, onDone, titleKey }: {
  endpoint: string;
  submitKey: "setup.submit" | "register.submit";
  titleKey: "setup.title" | "register.title";
  onDone: (res: unknown) => void;
}) {
  const { t } = useI18n();
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [repeat, setRepeat] = useState("");
  const [error, setError] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password !== repeat) return setError(new ApiClientError(400, "password_mismatch"));
    setBusy(true);
    try {
      onDone(await api("POST", endpoint, { name, username, email: email || undefined, password }));
    } catch (err) {
      setError(err);
      setBusy(false);
    }
  }
  const invalid = passwordIssues(password, { username, email }).length > 0 || password !== repeat;
  return (
    <form onSubmit={submit} className="card flex flex-col gap-4">
      <h2 className="text-xl font-semibold">{t(titleKey)}</h2>
      <div>
        <label className="label" htmlFor="name">{t("auth.displayName")}</label>
        <input id="name" className="input" value={name} onChange={(e) => setName(e.target.value)} maxLength={100} autoComplete="name" placeholder={username || undefined} />
        <p className="muted mt-1">{t("auth.displayNameHint")}</p>
      </div>
      <div>
        <label className="label" htmlFor="username">{t("auth.username")}</label>
        <input
          id="username"
          className="input"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          required
          pattern="[A-Za-z0-9][A-Za-z0-9._\-]{2,31}"
          autoComplete="username"
          autoCapitalize="none"
          spellCheck={false}
        />
        <p className="muted mt-1">{t("auth.usernameHint")}</p>
      </div>
      <div>
        <label className="label" htmlFor="email">{t("auth.emailOptional")}</label>
        <input id="email" type="email" className="input" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
      </div>
      <PasswordField id="password" label={t("auth.password")} value={password} onChange={setPassword} identity={{ username, email }} />
      <div>
        <label className="label" htmlFor="repeat">{t("auth.passwordRepeat")}</label>
        <input id="repeat" type="password" className="input" value={repeat} onChange={(e) => setRepeat(e.target.value)} required autoComplete="new-password" />
      </div>
      <ErrorMessage error={error} />
      <button className="btn" disabled={busy || invalid}>{t(submitKey)}</button>
    </form>
  );
}

export function SetupForm() {
  const { t } = useI18n();
  const router = useRouter();
  return (
    <>
      <p className="card text-sm">{t("setup.intro")}</p>
      <ProfileForm
        endpoint="/api/setup"
        submitKey="setup.submit"
        titleKey="setup.title"
        onDone={() => {
          router.replace("/");
          router.refresh();
        }}
      />
    </>
  );
}

export function RegisterForm() {
  const { t } = useI18n();
  const [done, setDone] = useState(false);
  if (done)
    return (
      <div className="card flex flex-col gap-3 text-center" data-testid="register-pending">
        <h2 className="text-xl font-semibold">{t("register.pendingTitle")}</h2>
        <p>{t("register.pending")}</p>
        <Link className="btn" href="/login">{t("register.backToLogin")}</Link>
      </div>
    );
  return <ProfileForm endpoint="/api/auth/register" submitKey="register.submit" titleKey="register.title" onDone={() => setDone(true)} />;
}

/** Einmal-Link einlösen: Passwort wählen (Konto aktivieren oder neues Passwort). */
export function ActivateForm({ token, name, username, purpose }: { token: string; name: string; username: string; purpose: string }) {
  const { t } = useI18n();
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [repeat, setRepeat] = useState("");
  const [error, setError] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password !== repeat) return setError(new ApiClientError(400, "password_mismatch"));
    setBusy(true);
    try {
      await api("POST", `/api/activate/${token}`, { password });
      router.replace("/");
      router.refresh();
    } catch (err) {
      setError(err);
      setBusy(false);
    }
  }
  const invalid = passwordIssues(password, { username }).length > 0 || password !== repeat;
  return (
    <form onSubmit={submit} className="card flex flex-col gap-4">
      <h2 className="text-xl font-semibold">{t(purpose === "reset" ? "activate.titleReset" : "activate.titleActivation")}</h2>
      <p>{t("activate.intro", { name, username })}</p>
      <PasswordField id="password" label={t("auth.password")} value={password} onChange={setPassword} identity={{ username }} />
      <div>
        <label className="label" htmlFor="repeat">{t("auth.passwordRepeat")}</label>
        <input id="repeat" type="password" className="input" value={repeat} onChange={(e) => setRepeat(e.target.value)} required autoComplete="new-password" />
      </div>
      <ErrorMessage error={error} />
      <button className="btn" disabled={busy || invalid}>{t("activate.submit")}</button>
    </form>
  );
}

export function ChangePasswordForm({ required, username, email }: { required: boolean; username: string; email: string | null }) {
  const { t } = useI18n();
  const router = useRouter();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [repeat, setRepeat] = useState("");
  const [error, setError] = useState<unknown>(null);
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setDone(false);
    if (next !== repeat) return setError(new ApiClientError(400, "password_mismatch"));
    setBusy(true);
    try {
      await api("POST", "/api/auth/password", { current, next });
      await clearOfflineCaches();
      setDone(true);
      setCurrent("");
      setNext("");
      setRepeat("");
      if (required) {
        router.replace("/");
        router.refresh();
      }
    } catch (err) {
      setError(err);
    }
    setBusy(false);
  }
  const invalid = passwordIssues(next, { username, email }).length > 0 || next !== repeat;
  return (
    <form onSubmit={submit} className="card flex flex-col gap-4">
      <h2 className="text-xl font-semibold">{t("password.title")}</h2>
      {required && <p className="rounded-lg bg-amber-100 p-3 text-sm text-amber-900" data-testid="must-change">{t("password.required")}</p>}
      <div>
        <label className="label" htmlFor="current">{t("password.current")}</label>
        <input id="current" type="password" className="input" value={current} onChange={(e) => setCurrent(e.target.value)} required autoComplete="current-password" />
      </div>
      <PasswordField id="next" label={t("password.new")} value={next} onChange={setNext} identity={{ username, email }} />
      <div>
        <label className="label" htmlFor="repeat">{t("auth.passwordRepeat")}</label>
        <input id="repeat" type="password" className="input" value={repeat} onChange={(e) => setRepeat(e.target.value)} required autoComplete="new-password" />
      </div>
      <ErrorMessage error={error} />
      {done && <p className="pos text-sm" role="status">{t("password.done")}</p>}
      <button className="btn" disabled={busy || invalid}>{t("password.submit")}</button>
      {!required && <Link className="btn-secondary" href="/settings">{t("password.back")}</Link>}
    </form>
  );
}
