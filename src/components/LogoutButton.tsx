"use client";
import { api } from "@/lib/client-api";
import { useI18n } from "@/i18n/client";
import { clearOfflineCaches } from "./ServiceWorker";

/** Abmelden (leert auch die Offline-Caches). Auch auf Zwangsseiten (2FA-Einrichtung, Passwortwechsel) verfügbar. */
export function LogoutButton({ className = "btn-secondary" }: { className?: string }) {
  const { t } = useI18n();
  async function logout() {
    await api("POST", "/api/auth/logout").catch(() => {});
    await clearOfflineCaches();
    // Bewusst ein vollständiges Neuladen (kein Client-Routing): verwirft allen Client-Zustand des alten Kontos
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination
    window.location.href = "/login";
  }
  return (
    <button type="button" className={className} onClick={logout} data-testid="logout">
      {t("auth.logout")}
    </button>
  );
}
