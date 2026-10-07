"use client";
import { useI18n } from "@/i18n/client";
import { useSecureContext } from "@/lib/use-secure";

/**
 * Übersicht, wenn die App ohne HTTPS läuft (z. B. http://192.168.x.x im Heimnetz): welche Funktionen fehlen und warum.
 * Für Admins zusätzlich, wie man es ändert.
 */
export function InsecureInfo({ admin = false }: { admin?: boolean }) {
  const { t } = useI18n();
  const secure = useSecureContext();
  if (secure !== false) return null;
  return (
    <section className="card flex flex-col gap-2 border-slate-300 bg-slate-50 text-sm dark:bg-slate-900" data-testid={admin ? "insecure-info-admin" : "insecure-info"}>
      <h2 className="font-semibold">{t("insecure.title")}</h2>
      <p>{t("insecure.intro")}</p>
      <ul className="list-disc pl-5">
        <li>{t("insecure.listCamera")}</li>
        <li>{t("insecure.listPasskeys")}</li>
        <li>{t("insecure.listInstall")}</li>
        <li>{t("insecure.listOffline")}</li>
        <li>{t("insecure.listPush")}</li>
      </ul>
      <p className="muted">{admin ? t("insecure.adminHow") : t("insecure.rest")}</p>
    </section>
  );
}
