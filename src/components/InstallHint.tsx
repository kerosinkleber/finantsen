"use client";
import { useI18n } from "@/i18n/client";
import { useSecureContext } from "@/lib/use-secure";

/** Installations-Tipp nur, wo Installieren überhaupt geht (HTTPS); ohne HTTPS erklärt `InsecureInfo` den Grund. */
export function InstallHint() {
  const { t } = useI18n();
  if (useSecureContext() === false) return null;
  return <p className="muted">{t("settings.install")}</p>;
}
