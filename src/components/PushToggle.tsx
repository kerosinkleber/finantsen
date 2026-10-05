"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/client-api";
import { useI18n } from "@/i18n/client";
import { InsecureNote } from "./InsecureNote";

type State = "loading" | "insecure" | "server-off" | "unsupported" | "denied" | "off" | "on";

function urlBase64ToUint8Array(b64: string) {
  const pad = "=".repeat((4 - (b64.length % 4)) % 4);
  const raw = atob((b64 + pad).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

/** Aktiviert/deaktiviert Web Push für dieses Gerät. Ohne VAPID-Schlüssel auf dem Server nur ein Hinweis. */
export function PushToggle() {
  const { t } = useI18n();
  const [state, setState] = useState<State>("loading");
  const [key, setKey] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      // Ohne HTTPS gibt es weder Service Worker noch Push im Browser
      if (!window.isSecureContext) return setState("insecure");
      try {
        const cfg = await api<{ enabled: boolean; publicKey: string | null }>("GET", "/api/push");
        if (!cfg.enabled || !cfg.publicKey) return setState("server-off");
        setKey(cfg.publicKey);
        if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) return setState("unsupported");
        if (Notification.permission === "denied") return setState("denied");
        const reg = await navigator.serviceWorker.getRegistration();
        const sub = await reg?.pushManager.getSubscription();
        setState(sub ? "on" : "off");
      } catch {
        setState("server-off");
      }
    })();
  }, []);

  async function enable() {
    if (!key) return;
    const perm = await Notification.requestPermission();
    if (perm !== "granted") return setState(perm === "denied" ? "denied" : "off");
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(key) });
    await api("POST", "/api/push", sub.toJSON());
    setState("on");
  }
  async function disable() {
    const reg = await navigator.serviceWorker.getRegistration();
    const sub = await reg?.pushManager.getSubscription();
    if (sub) {
      await api("DELETE", "/api/push", { endpoint: sub.endpoint }).catch(() => {});
      await sub.unsubscribe();
    }
    setState("off");
  }

  if (state === "loading") return null;
  return (
    <div className="card flex flex-col gap-2" data-testid="push">
      <h2 className="font-semibold">{t("notif.push")}</h2>
      {state === "insecure" && (
        <>
          <button className="btn-secondary" disabled data-testid="push-enable">{t("notif.pushEnable")}</button>
          <InsecureNote k="insecure.push" />
        </>
      )}
      {state === "server-off" && <p className="muted">{t("notif.pushUnavailable")}</p>}
      {state === "unsupported" && <p className="muted">{t("notif.pushUnsupported")}</p>}
      {state === "denied" && <p className="muted">{t("notif.pushDenied")}</p>}
      {state === "off" && <button className="btn-secondary" onClick={enable}>{t("notif.pushEnable")}</button>}
      {state === "on" && (
        <>
          <p className="muted">{t("notif.pushOn")}</p>
          <button className="btn-secondary" onClick={disable}>{t("notif.pushDisable")}</button>
        </>
      )}
    </div>
  );
}
