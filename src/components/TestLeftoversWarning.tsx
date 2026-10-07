"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/client-api";
import { useI18n } from "@/i18n/client";
import { ErrorMessage } from "./ErrorMessage";
import { useConfirm } from "./useConfirm";

type Blocked = { username: string; groups: { name: string; users: string[] }[] };

/**
 * Gelber Hinweis im Admin-Bereich, solange Testfunktionen an sind oder noch Testnutzer existieren. Löscht nichts von
 * selbst: Ausschalten und Löschen nur per Knopf (Löschen mit Rückfrage).
 */
export function TestLeftoversWarning({ enabled, testUsers }: { enabled: boolean; testUsers: number }) {
  const { t } = useI18n();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [blocked, setBlocked] = useState<Blocked[]>([]);
  const { ask, dialog } = useConfirm();
  if (!enabled && testUsers === 0) return null;

  async function run(fn: () => Promise<void>) {
    setBusy(true);
    setError(null);
    try {
      await fn();
      router.refresh();
    } catch (e) {
      setError(e);
    }
    setBusy(false);
  }
  const disable = () => run(async () => void (await api("PATCH", "/api/admin/settings", { testFeaturesEnabled: false })));
  const removeAll = async () => {
    if (!(await ask(t("testWarn.confirmDelete", { n: testUsers })))) return;
    return run(async () => setBlocked((await api<{ deleted: string[]; blocked: Blocked[] }>("DELETE", "/api/admin/test-users")).blocked));
  };

  return (
    <section className="flex flex-col gap-2 rounded-xl border border-amber-400 bg-amber-50 p-4 text-sm text-amber-950 dark:bg-amber-950 dark:text-amber-50" data-testid="test-leftovers">
      <h2 className="font-semibold">{t("testWarn.title")}</h2>
      {enabled && <p>{t("testWarn.enabled")}</p>}
      {testUsers > 0 && <p data-testid="test-leftovers-count">{testUsers === 1 ? t("testWarn.usersOne") : t("testWarn.users", { n: testUsers })}</p>}
      <div className="flex flex-wrap gap-2">
        {enabled && <button className="btn-secondary" disabled={busy} onClick={disable} data-testid="test-leftovers-disable">{t("testWarn.disable")}</button>}
        {testUsers > 0 && <button className="btn-danger" disabled={busy} onClick={removeAll} data-testid="test-leftovers-delete">{t("testWarn.deleteAll")}</button>}
      </div>
      {blocked.length > 0 && (
        <div data-testid="test-leftovers-blocked">
          <p>{t("testWarn.blocked")}</p>
          <ul className="list-disc pl-5">
            {blocked.map((b) => (
              <li key={b.username}>{b.username}: {b.groups.map((g) => `${g.name} (${g.users.join(", ")})`).join("; ")}</li>
            ))}
          </ul>
        </div>
      )}
      <ErrorMessage error={error} />
      {dialog}
    </section>
  );
}
