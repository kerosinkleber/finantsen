"use client";
import { useI18n } from "@/i18n/client";
import type { MessageKey } from "@/i18n";
import { ApiClientError } from "@/lib/client-api";
import de from "@/i18n/de";

export function useErrorText() {
  const { t } = useI18n();
  return (e: unknown) => {
    if (e instanceof ApiClientError) {
      if (e.code === "offline") return t("common.offline");
      const key = `err.${e.code}` as MessageKey;
      if (key in de) return t(key);
    }
    return t("common.error");
  };
}

export function ErrorMessage({ error }: { error: unknown }) {
  const text = useErrorText();
  if (!error) return null;
  return (
    <p role="alert" data-testid="error" className="rounded-lg bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
      {text(error)}
    </p>
  );
}
