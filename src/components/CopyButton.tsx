"use client";
import { useState } from "react";
import { useI18n } from "@/i18n/client";
import { copyText } from "@/lib/copy";

/**
 * Kopieren-Knopf. Zeigt „Kopiert“ nur, wenn wirklich kopiert wurde. Sonst (z. B. Browser ohne Zwischenablage über
 * http) den Hinweis zum manuellen Kopieren und – falls angegeben – das Feld `selectId` markieren.
 */
export function CopyButton({ text, selectId, label, className = "btn-secondary" }: { text: string; selectId?: string; label?: string; className?: string }) {
  const { t } = useI18n();
  const [state, setState] = useState<"idle" | "copied" | "failed">("idle");
  async function copy() {
    const ok = await copyText(text);
    setState(ok ? "copied" : "failed");
    if (ok) setTimeout(() => setState("idle"), 1500);
    else if (selectId) {
      const el = document.getElementById(selectId) as HTMLInputElement | null;
      el?.focus();
      el?.select();
    }
  }
  return (
    <>
      <button type="button" className={className} onClick={copy} data-testid="copy-button">
        {state === "copied" ? t("common.copied") : (label ?? t("common.copy"))}
      </button>
      {state === "failed" && (
        <p className="muted basis-full text-sm" role="status" data-testid="copy-manual">{t("common.copyManual")}</p>
      )}
    </>
  );
}
