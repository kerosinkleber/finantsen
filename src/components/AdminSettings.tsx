"use client";
import { useState } from "react";
import { api } from "@/lib/client-api";
import { useI18n } from "@/i18n/client";
import { ErrorMessage } from "./ErrorMessage";
import { AdminMail, type MailState } from "./AdminMail";

type Settings = { registrationEnabled: boolean; allowDuplicateEmails: boolean; linkValidityHours: number; testFeaturesEnabled: boolean; totpRequiredAll: boolean; recoveryCodeCount: number; passwordResetEnabled: boolean };

/** Instanz-Einstellungen, nur für Admins (der Server prüft die Berechtigung zusätzlich). */
export function AdminSettings({ initial, mail }: { initial: Settings; mail: MailState }) {
  const { t } = useI18n();
  const [s, setS] = useState(initial);
  const [hours, setHours] = useState(String(initial.linkValidityHours));
  const [codes, setCodes] = useState(String(initial.recoveryCodeCount));
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
    <>
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
        <label className="flex items-start gap-3">
          <input type="checkbox" className="mt-1 h-5 w-5" checked={s.testFeaturesEnabled} onChange={(e) => save({ testFeaturesEnabled: e.target.checked })} />
          <span>
            <span className="font-medium">{t("test.enableSetting")}</span>
            <span className="muted block">{t("test.enableHelp")}</span>
          </span>
        </label>
        <label className="flex items-start gap-3">
          <input type="checkbox" className="mt-1 h-5 w-5" data-testid="totp-all" checked={s.totpRequiredAll} onChange={(e) => save({ totpRequiredAll: e.target.checked })} />
          <span>
            <span className="font-medium">{t("admin.totpRequiredAll")}</span>
            <span className="muted block">{t("admin.totpRequiredAllHelp")}</span>
          </span>
        </label>
        <div>
          <label className="label" htmlFor="rcodes">{t("admin.recoveryCodeCount")}</label>
          <div className="flex gap-2">
            <input id="rcodes" className="input !w-28" inputMode="numeric" value={codes} onChange={(e) => setCodes(e.target.value)} />
            <button className="btn-secondary" onClick={() => save({ recoveryCodeCount: Number(codes) })}>{t("admin.action.save")}</button>
          </div>
          <p className="muted mt-1">{t("admin.recoveryCodeCountHelp")}</p>
        </div>
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
      <AdminMail initial={mail} passwordReset={s.passwordResetEnabled} onPasswordReset={(v) => save({ passwordResetEnabled: v })} />
    </>
  );
}
