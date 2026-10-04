"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/client-api";
import { useI18n } from "@/i18n/client";
import { ErrorMessage } from "./ErrorMessage";

/** Holt eine gelöschte Ausgabe zurück. */
export function RestoreButton({ groupId, expenseId, compact = false }: { groupId: string; expenseId: string; compact?: boolean }) {
  const { t } = useI18n();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  async function restore() {
    setBusy(true);
    setError(null);
    try {
      await api("POST", `/api/groups/${groupId}/expenses/${expenseId}/restore`);
      router.refresh();
    } catch (e) {
      setError(e);
      setBusy(false);
    }
  }
  return (
    <span className="flex flex-col gap-1">
      <button type="button" className={`btn-secondary ${compact ? "!min-h-9 !px-3" : ""}`} disabled={busy} onClick={restore} data-testid="restore">{t("expense.restore")}</button>
      <ErrorMessage error={error} />
    </span>
  );
}
