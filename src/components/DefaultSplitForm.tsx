"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { api, ApiClientError } from "@/lib/client-api";
import { useI18n } from "@/i18n/client";
import { ErrorMessage } from "./ErrorMessage";
import { parseAmount } from "@/lib/money";
import type { DefaultSplit } from "@/lib/schemas";
import type { MessageKey } from "@/i18n";

type Kind = "none" | "equal" | "percent" | "shares";

export function DefaultSplitForm({ groupId, members, initial }: { groupId: string; members: { id: string; name: string }[]; initial: DefaultSplit | null }) {
  const { t } = useI18n();
  const router = useRouter();
  const [kind, setKind] = useState<Kind>(initial?.type ?? "none");
  const [included, setIncluded] = useState(new Set(initial ? initial.entries.map((e) => e.userId) : members.map((m) => m.id)));
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries((initial?.entries ?? []).map((e) => [e.userId, initial!.type === "percent" ? String(e.value / 100) : String(e.value)])),
  );
  const [error, setError] = useState<unknown>(null);
  const [saved, setSaved] = useState(false);

  async function save() {
    setError(null);
    setSaved(false);
    try {
      let defaultSplit: DefaultSplit | null = null;
      if (kind === "shares" && members.some((m) => included.has(m.id) && !/^\d+$/.test((values[m.id] ?? "1").trim()))) throw new ApiClientError(400, "invalid_weight");
      if (kind !== "none") {
        const ids = members.filter((m) => included.has(m.id)).map((m) => m.id);
        defaultSplit = {
          type: kind,
          entries: ids.map((userId) => ({
            userId,
            value: kind === "equal" ? 0 : kind === "percent" ? (parseAmount(values[userId] ?? "", "EUR") ?? 0) : Number((values[userId] ?? "1").trim()),
          })),
        };
      }
      await api("PATCH", `/api/groups/${groupId}`, { defaultSplit });
      setSaved(true);
      router.refresh();
    } catch (e) {
      setError(e);
    }
  }

  return (
    <section className="card flex flex-col gap-3" data-testid="default-split">
      <div>
        <h2 className="font-semibold">{t("defaults.title")}</h2>
        <p className="muted">{t("defaults.help")}</p>
      </div>
      <select className="input" aria-label={t("defaults.title")} value={kind} onChange={(e) => setKind(e.target.value as Kind)}>
        <option value="none">{t("defaults.none")}</option>
        {(["equal", "percent", "shares"] as const).map((k) => (
          <option key={k} value={k}>{t(`expense.split.${k}` as MessageKey)}</option>
        ))}
      </select>
      {kind !== "none" && (
        <>
          <p className="muted">{t("defaults.members")}</p>
          {members.map((m) => (
            <div key={m.id} className="flex items-center gap-3">
              <label className="flex flex-1 items-center gap-3">
                <input
                  type="checkbox"
                  className="h-5 w-5"
                  checked={included.has(m.id)}
                  aria-label={m.name}
                  onChange={() =>
                    setIncluded((s) => {
                      const n = new Set(s);
                      if (n.has(m.id)) n.delete(m.id);
                      else n.add(m.id);
                      return n;
                    })
                  }
                />
                {m.name}
              </label>
              {kind !== "equal" && included.has(m.id) && (
                <input
                  className="input !w-24 text-right"
                  inputMode="decimal"
                  aria-label={`${t(`expense.split.${kind}` as MessageKey)} ${m.name}`}
                  value={values[m.id] ?? (kind === "shares" ? "1" : "")}
                  onChange={(e) => setValues((v) => ({ ...v, [m.id]: e.target.value }))}
                />
              )}
            </div>
          ))}
        </>
      )}
      <ErrorMessage error={error} />
      {saved && <p className="pos text-sm" role="status" data-testid="defaults-saved">{t("common.saved")}</p>}
      <button className="btn-secondary" onClick={save}>{saved ? t("defaults.saved") : t("defaults.save")}</button>
    </section>
  );
}
