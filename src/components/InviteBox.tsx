"use client";
import { useState } from "react";
import { api } from "@/lib/client-api";
import { useI18n } from "@/i18n/client";
import { ErrorMessage } from "./ErrorMessage";

/** Erzeugt einen Einladungslink. `createUrl` ist der API-Endpunkt (Gruppe oder Freunde). */
export function InviteBox({ createUrl, label }: { createUrl: string; label: string }) {
  const { t } = useI18n();
  const [link, setLink] = useState<string | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [copied, setCopied] = useState(false);

  async function create() {
    setError(null);
    try {
      const r = await api<{ url: string }>("POST", createUrl);
      // Aktuelle Origin bevorzugen, falls APP_URL nicht gesetzt ist
      const code = r.url.split("/join/")[1];
      setLink(`${window.location.origin}/join/${code}`);
    } catch (e) {
      setError(e);
    }
  }
  async function copy() {
    if (!link) return;
    await navigator.clipboard?.writeText(link).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }
  return (
    <div className="flex flex-col gap-2">
      <button className="btn-secondary" onClick={create}>{label}</button>
      <ErrorMessage error={error} />
      {link && (
        <div className="flex flex-col gap-1">
          <p className="muted">{t("group.inviteLink")}</p>
          <div className="flex gap-2">
            <input readOnly className="input" value={link} data-testid="invite-link" onFocus={(e) => e.currentTarget.select()} />
            <button className="btn-secondary" onClick={copy}>{copied ? t("common.copied") : t("common.copy")}</button>
          </div>
        </div>
      )}
    </div>
  );
}
