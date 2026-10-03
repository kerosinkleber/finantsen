"use client";
import { useSyncExternalStore } from "react";
import { useI18n } from "@/i18n/client";

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
  if (online) return null;
  return <p className="mb-4 rounded-lg bg-amber-100 p-3 text-sm text-amber-900">{t("common.offline")}</p>;
}
