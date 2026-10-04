"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/client-api";
import { useI18n } from "@/i18n/client";
import { ErrorMessage } from "./ErrorMessage";

/** Gruppe nur in der eigenen Übersicht archivieren bzw. zurückholen. */
export function ArchiveButton({ groupId, archived }: { groupId: string; archived: boolean }) {
  const { t } = useI18n();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  async function toggle() {
    setBusy(true);
    setError(null);
    try {
      await api("POST", `/api/groups/${groupId}/archive`, { archived: !archived });
      router.refresh();
    } catch (e) {
      setError(e);
    }
    setBusy(false);
  }
  return (
    <div className="card flex flex-col gap-2">
      <button className="btn-secondary" disabled={busy} onClick={toggle} data-testid="archive-toggle">{t(archived ? "archive.restore" : "archive.archive")}</button>
      <p className="muted">{t("archive.help")}</p>
      <ErrorMessage error={error} />
    </div>
  );
}
