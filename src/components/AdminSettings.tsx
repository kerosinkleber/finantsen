"use client";
import { useState } from "react";
import { api } from "@/lib/client-api";
import { useI18n } from "@/i18n/client";
import { ErrorMessage } from "./ErrorMessage";

type Settings = { registrationEnabled: boolean; allowDuplicateEmails: boolean; linkValidityHours: number };

/** Instanz-Einstellungen, nur für Admins (der Server prüft die Berechtigung zusätzlich). */
export function AdminSettings({ initial }: { initial: Settings }) {
  const { t } = useI18n();
  const [s, setS] = useState(initial);
  const [hours, setHours] = useState(String(initial.linkValidityHours));
  const [error, setError] = useState<unknown>(null);
  const [saved, setSaved] = useState(false);

  async function save(patch: Partial<Settings>) {
    setError(null);
    setSaved(false);
    const before = s;
    setS({ ...s, ...patch }); // sofort sichtbar, bei Fehler zurücksetzen
    try {
      setS(await api<Settings>("PATCH", "/api/admin/settings", patch));
      setSaved(true);
    } catch (e) {
      setS(before);
      setError(e);
    }
  }

  return (
    <section className="card flex flex-col gap-4" data-testid="admin-settings">
      <h2 className="font-semibold">{t("admin.settings")}</h2>
      <label className="flex items-start gap-3">
        <input type="checkbox" className="mt-1 h-5 w-5" checked={s.registrationEnabled} onChange={(e) => save({ registrationEnabled: e.target.checked })} />
        <span>
          <span className="font-medium">{t("admin.registrationEnabled")}</span>
          <span className="muted block">{t("admin.registrationHelp")}</span>
        </span>
      </label>
      <label className="flex items-start gap-3">
        <input type="checkbox" className="mt-1 h-5 w-5" checked={s.allowDuplicateEmails} onChange={(e) => save({ allowDuplicateEmails: e.target.checked })} />
        <span>
          <span className="font-medium">{t("admin.allowDuplicateEmails")}</span>
          <span className="muted block">{t("admin.allowDuplicateEmailsHelp")}</span>
        </span>
      </label>
      <div>
        <label className="label" htmlFor="hours">{t("admin.linkValidity")}</label>
        <div className="flex gap-2">
          <input id="hours" className="input !w-28" inputMode="numeric" value={hours} onChange={(e) => setHours(e.target.value)} />
          <button className="btn-secondary" onClick={() => save({ linkValidityHours: Number(hours) })}>{t("admin.action.save")}</button>
        </div>
        <p className="muted mt-1">{t("admin.linkValidityHelp")}</p>
      </div>
      {saved && <p className="pos text-sm" role="status">{t("admin.done")}</p>}
      <ErrorMessage error={error} />
    </section>
  );
}
