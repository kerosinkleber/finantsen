"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api } from "@/lib/client-api";
import { useI18n } from "@/i18n/client";
import { formatMoney } from "@/lib/money";
import type { MessageKey } from "@/i18n";
import { ErrorMessage } from "./ErrorMessage";

type Item = {
  id: string;
  title: string;
  template: { currency: string; amountMinor: number };
  unit: "day" | "week" | "month" | "year";
  every: number;
  nextDate: string;
  endDate: string | null;
  paused: boolean;
  finished: boolean;
  lastError: string | null;
  createdByName: string;
};

/** Liste der Vorlagen mit Pausieren/Fortsetzen. `canManage` = darf der Nutzer laut Gruppeneinstellung verwalten. */
export function RecurringList({ groupId, items, canManage }: { groupId: string; items: Item[]; canManage: boolean }) {
  const { t, locale } = useI18n();
  const router = useRouter();
  const [error, setError] = useState<unknown>(null);
  const [busy, setBusy] = useState<string | null>(null);

  async function toggle(it: Item) {
    setBusy(it.id);
    setError(null);
    try {
      await api("POST", `/api/groups/${groupId}/recurring/${it.id}/pause`, { paused: !it.paused });
      router.refresh();
    } catch (e) {
      setError(e);
    }
    setBusy(null);
  }

  return (
    <div className="flex flex-col gap-3" data-testid="recurring">
      <p className="muted">{t("recurring.intro")}</p>
      {canManage && <Link href={`/groups/${groupId}/recurring/new`} className="btn" data-testid="recurring-new">{t("recurring.new")}</Link>}
      <ErrorMessage error={error} />
      {items.length === 0 ? (
        <p className="muted" data-testid="recurring-empty">{t("recurring.empty")}</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {items.map((it) => (
            <li key={it.id} className="card flex flex-col gap-2" data-testid="recurring-item">
              <div className="flex items-start justify-between gap-3">
                <span className="min-w-0">
                  <span className="block truncate font-medium">{it.title}</span>
                  <span className="muted block">
                    {formatMoney(it.template.amountMinor, it.template.currency, locale)} · {t("recurring.rhythm", { n: it.every, unit: t(`recurring.unit.${it.unit}` as MessageKey) })}
                  </span>
                  <span className="muted block">{it.finished ? t("recurring.finished") : t("recurring.next", { date: it.nextDate })} · {t("recurring.by", { name: it.createdByName })}</span>
                </span>
                <span className="flex shrink-0 flex-col items-end gap-1">
                  {it.paused && <span className="rounded-full bg-amber-200 px-2 py-0.5 text-xs text-amber-900" data-testid="recurring-paused">{t("recurring.paused")}</span>}
                  {it.finished && <span className="rounded-full bg-slate-200 px-2 py-0.5 text-xs dark:bg-slate-700">{t("recurring.finished")}</span>}
                </span>
              </div>
              {it.lastError && (
                <p className="text-sm text-amber-700 dark:text-amber-400" data-testid="recurring-error">
                  {t(`recurring.error${it.lastError.charAt(0).toUpperCase()}${it.lastError.slice(1)}` as MessageKey)}
                </p>
              )}
              {canManage && (
                <div className="flex gap-2">
                  <Link href={`/groups/${groupId}/recurring/${it.id}`} className="btn-secondary !min-h-9 !px-3" data-testid="recurring-edit">{t("common.edit")}</Link>
                  {!it.finished && (
                    <button className="btn-secondary !min-h-9 !px-3" disabled={busy === it.id} onClick={() => toggle(it)} data-testid="recurring-toggle">
                      {t(it.paused ? "recurring.resume" : "recurring.pause")}
                    </button>
                  )}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
