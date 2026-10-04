"use client";
import { useState } from "react";
import { api } from "@/lib/client-api";
import { useI18n } from "@/i18n/client";
import { ErrorMessage } from "./ErrorMessage";

/** Instanz-Einstellungen, nur für Admins sichtbar (Server prüft zusätzlich die Berechtigung). */
export function AdminSettings({ initial }: { initial: { allowDuplicateEmails: boolean } }) {
  const { t } = useI18n();
  const [allow, setAllow] = useState(initial.allowDuplicateEmails);
  const [error, setError] = useState<unknown>(null);
  const [saved, setSaved] = useState(false);

  async function toggle(value: boolean) {
    setError(null);
    setSaved(false);
    setAllow(value);
    try {
      const r = await api<{ allowDuplicateEmails: boolean }>("PATCH", "/api/admin/settings", { allowDuplicateEmails: value });
      setAllow(r.allowDuplicateEmails);
      setSaved(true);
    } catch (e) {
      setAllow(!value);
      setError(e);
    }
  }

  return (
    <section className="card flex flex-col gap-3" data-testid="admin-settings">
      <h2 className="font-semibold">{t("admin.title")}</h2>
      <label className="flex items-start gap-3">
        <input type="checkbox" className="mt-1 h-5 w-5" checked={allow} onChange={(e) => toggle(e.target.checked)} />
        <span>
          <span className="font-medium">{t("admin.allowDuplicateEmails")}</span>
          <span className="muted block">{t("admin.allowDuplicateEmailsHelp")}</span>
        </span>
      </label>
      {saved && <p className="pos text-sm" role="status">{t("defaults.saved")}</p>}
      <ErrorMessage error={error} />
    </section>
  );
}
