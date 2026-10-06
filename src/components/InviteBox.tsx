"use client";
import { useState } from "react";
import { api } from "@/lib/client-api";
import { useI18n } from "@/i18n/client";
import { ErrorMessage } from "./ErrorMessage";
import { QrCode } from "./QrCode";
import { CopyButton } from "./CopyButton";

/** Erzeugt einen Einladungslink. `createUrl` ist der API-Endpunkt (Gruppe oder Freunde). */
export function InviteBox({ createUrl, label }: { createUrl: string; label: string }) {
  const { t } = useI18n();
  const [link, setLink] = useState<string | null>(null);
  const [error, setError] = useState<unknown>(null);

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
  return (
    <div className="flex flex-col gap-2">
      <button className="btn-secondary" onClick={create}>{label}</button>
      <ErrorMessage error={error} />
      {link && (
        <div className="flex flex-col gap-1">
          <p className="muted">{t("group.inviteLink")}</p>
          <div className="flex flex-wrap gap-2 [&>input]:min-w-0 [&>input]:flex-1">
            <input id="invite-link" readOnly className="input" value={link} data-testid="invite-link" onFocus={(e) => e.currentTarget.select()} />
            <CopyButton text={link} selectId="invite-link" />
          </div>
          <p className="muted mt-2">{t("invite.qrHelp")}</p>
          <QrCode text={link} label={t("invite.qrAlt")} />
        </div>
      )}
    </div>
  );
}
