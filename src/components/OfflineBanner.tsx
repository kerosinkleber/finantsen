"use client";
import { useSyncExternalStore } from "react";
import { useI18n } from "@/i18n/client";
import { connection } from "@/lib/client-api";

const subscribe = (cb: () => void) => {
  window.addEventListener("online", cb);
  window.addEventListener("offline", cb);
  return () => {
    window.removeEventListener("online", cb);
    window.removeEventListener("offline", cb);
  };
};

export function OfflineBanner() {
  const { t } = useI18n();
  const online = useSyncExternalStore(subscribe, () => navigator.onLine, () => true);
  // Zusätzlich: letzte Anfrage kam nicht durch (VPN/Tunnel hält navigator.onLine fälschlich auf true)
  const unreachable = useSyncExternalStore(connection.subscribe, connection.unreachable, () => false);
  if (online && !unreachable) return null;
  return <p className="mb-4 rounded-lg bg-amber-100 p-3 text-sm text-amber-900" role="status" data-testid="offline-banner">{t("common.offline")}</p>;
}
