"use client";
import { useState } from "react";
import { startRegistration, browserSupportsWebAuthn } from "@simplewebauthn/browser";
import { useRouter } from "next/navigation";
import { api, ApiClientError } from "@/lib/client-api";
import { useI18n } from "@/i18n/client";
import { ErrorMessage } from "./ErrorMessage";
import { InsecureNote } from "./InsecureNote";
import { useSecureContext } from "@/lib/use-secure";

type Item = { id: string; name: string; createdAt: string; lastUsedAt: string | null };

/** Passkeys verwalten: hinzufügen (nach Passwort), umbenennen nicht nötig, löschen (nach Passwort). */
export function Passkeys({ initial, forced }: { initial: Item[]; forced: boolean }) {
  const { t, locale } = useI18n();
  const router = useRouter();
  const [items, setItems] = useState(initial);
  const [error, setError] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const secure = useSecureContext();
  const supported = typeof window !== "undefined" && browserSupportsWebAuthn();

  const reload = async () => setItems((await api<{ passkeys: Item[] }>("GET", "/api/auth/passkeys")).passkeys);

  async function add(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setBusy(true);
    setError(null);
    try {
      const { options, token } = await api<{ options: Parameters<typeof startRegistration>[0]["optionsJSON"]; token: string }>("POST", "/api/auth/passkeys/options", { password: f.get("password") });
      const response = await startRegistration({ optionsJSON: options });
      await api("POST", "/api/auth/passkeys", { token, response, name: f.get("name") });
      setOpen(false);
      await reload();
      router.refresh(); // Zwang/„Weiter“-Knopf neu berechnen
    } catch (err) {
      // Abbruch im Browser-Dialog ist kein Serverfehler
      if (err instanceof Error && !(err instanceof ApiClientError)) setError(new ApiClientError(0, "passkey_cancelled"));
      else setError(err);
    }
    setBusy(false);
  }

  async function remove(e: React.FormEvent<HTMLFormElement>, id: string) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setBusy(true);
    setError(null);
    try {
      await api("DELETE", `/api/auth/passkeys/${id}`, { password: f.get("password") });
      setDeleting(null);
      await reload();
      router.refresh();
    } catch (err) {
      setError(err);
    }
    setBusy(false);
  }

  return (
    <section className="card flex flex-col gap-3" data-testid="passkeys">
      <h2 className="text-lg font-semibold">{t("passkey.title")}</h2>
      <p className="muted">{forced ? t("passkey.introForced") : t("passkey.intro")}</p>
      {items.length > 0 && (
        <ul className="flex flex-col gap-2">
          {items.map((p) => (
            <li key={p.id} className="flex flex-col gap-2 rounded-lg border border-slate-300 p-3 dark:border-slate-700" data-testid="passkey-item">
              <div className="flex items-center justify-between gap-2">
                <span>
                  <span className="font-medium">{p.name}</span>
                  <span className="muted block">
                    {t("passkey.created", { date: new Date(p.createdAt).toLocaleDateString(locale) })}
                    {p.lastUsedAt ? ` · ${t("passkey.lastUsed", { date: new Date(p.lastUsedAt).toLocaleDateString(locale) })}` : ""}
                  </span>
                </span>
                <button type="button" className="btn-secondary !min-h-9 !px-3" onClick={() => setDeleting(deleting === p.id ? null : p.id)}>{t("common.delete")}</button>
              </div>
              {deleting === p.id && (
                <form onSubmit={(e) => remove(e, p.id)} className="flex gap-2">
                  <input name="password" type="password" className="input" placeholder={t("auth.password")} autoComplete="current-password" required />
                  <button className="btn-danger" disabled={busy} data-testid="passkey-delete-confirm">{t("common.delete")}</button>
                </form>
              )}
            </li>
          ))}
        </ul>
      )}
      {secure === false ? (
        <>
          <button className="btn-secondary" disabled data-testid="passkey-add">{t("passkey.add")}</button>
          <InsecureNote k="insecure.passkey" />
        </>
      ) : !supported ? (
        <p className="muted">{t("passkey.unsupported")}</p>
      ) : open ? (
        <form onSubmit={add} className="flex flex-col gap-2">
          <label className="label" htmlFor="pk-name">{t("passkey.name")}</label>
          <input id="pk-name" name="name" className="input" maxLength={60} placeholder={t("passkey.namePlaceholder")} />
          <label className="label" htmlFor="pk-pw">{t("passkey.confirmPassword")}</label>
          <input id="pk-pw" name="password" type="password" className="input" autoComplete="current-password" required />
          <button className="btn" disabled={busy} data-testid="passkey-create">{t("passkey.create")}</button>
        </form>
      ) : (
        <button className="btn-secondary" onClick={() => setOpen(true)} data-testid="passkey-add">{t("passkey.add")}</button>
      )}
      <ErrorMessage error={error} />
    </section>
  );
}
