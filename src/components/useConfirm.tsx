"use client";
import { useCallback, useRef, useState } from "react";
import { useI18n } from "@/i18n/client";

/**
 * Bestätigung im Seitenfenster statt `window.confirm` (bedienbar auf dem Handy/in der PWA und testbar).
 * Nutzung: `const { ask, dialog } = useConfirm();` … `if (await ask(text)) …` und `{dialog}` ins JSX.
 */
export function useConfirm() {
  const { t } = useI18n();
  const [message, setMessage] = useState<string | null>(null);
  const resolver = useRef<((ok: boolean) => void) | null>(null);

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
  };

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
