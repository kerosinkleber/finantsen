"use client";
import { useEffect } from "react";

export function ServiceWorkerRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV === "production" && "serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }
  }, []);
  return null;
}

/** Leert die Offline-Caches (z. B. beim Abmelden, damit keine Daten für den nächsten Nutzer übrig bleiben). */
export async function clearOfflineCaches() {
  if (!("caches" in window)) return;
  const keys = await caches.keys();
  await Promise.all(keys.filter((k) => k.startsWith("fs-")).map((k) => caches.delete(k)));
}
