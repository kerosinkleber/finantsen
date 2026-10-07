"use client";
import { useI18n } from "@/i18n/client";
import type { MessageKey } from "@/i18n";

/** Grauer Hinweis an einer Funktion, die ohne HTTPS nicht geht. */
export function InsecureNote({ k }: { k: MessageKey }) {
  const { t } = useI18n();
  return <p className="muted text-sm" data-testid="insecure-note">🔒 {t(k)}</p>;
}
