"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useI18n } from "@/i18n/client";

/**
 * Bestätigung im Seitenfenster statt `window.confirm` (bedienbar auf dem Handy/in der PWA und testbar).
 * Die Zurück-Taste (Android, Browser) schließt das Fenster wie „Abbrechen“, statt die Seite zu verlassen: Beim Öffnen
 * wird ein eigener Verlaufseintrag angelegt (mit dem Zustand des Next-Routers, damit der ihn kennt).
 * Nutzung: `const { ask, dialog } = useConfirm();` … `if (await ask(text)) …` und `{dialog}` ins JSX.
 */
export function useConfirm() {
  const { t } = useI18n();
  const [message, setMessage] = useState<string | null>(null);
  const resolver = useRef<((ok: boolean) => void) | null>(null);
  const pushed = useRef(false);
  const open = message !== null;

  const ask = useCallback((text: string) => {
    return new Promise<boolean>((resolve) => {
      resolver.current = resolve;
      setMessage(text);
    });
  }, []);
  const close = (ok: boolean) => {
    resolver.current?.(ok);
    resolver.current = null;
    setMessage(null);
    if (pushed.current) {
      pushed.current = false;
      history.back(); // eigenen Verlaufseintrag wieder entfernen
    }
  };

  useEffect(() => {
    if (!open) return;
    history.pushState({ ...(history.state ?? {}), finantsenConfirm: true }, "");
    pushed.current = true;
    const onPop = () => {
      if (!pushed.current) return;
      pushed.current = false; // Zurück-Taste: Eintrag ist schon weg
      resolver.current?.(false);
      resolver.current = null;
      setMessage(null);
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, [open]);

  const dialog =
    message === null ? null : (
      <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-4 sm:items-center" onKeyDown={(e) => e.key === "Escape" && close(false)}>
        <div role="alertdialog" aria-modal="true" aria-label={message} className="card flex w-full max-w-sm flex-col gap-4" data-testid="confirm-dialog">
          <p>{message}</p>
          <div className="flex gap-2">
            <button type="button" className="btn-secondary flex-1" data-testid="confirm-no" onClick={() => close(false)}>{t("common.cancel")}</button>
            <button type="button" autoFocus className="btn flex-1" data-testid="confirm-yes" onClick={() => close(true)}>{t("common.confirm")}</button>
          </div>
        </div>
      </div>
    );
  return { ask, dialog };
}
