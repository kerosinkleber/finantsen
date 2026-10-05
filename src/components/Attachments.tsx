"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/client-api";
import { useI18n } from "@/i18n/client";
import { downscaleToBase64 } from "@/lib/image-client";
import { useConfirm } from "./useConfirm";
import { ErrorMessage } from "./ErrorMessage";

type Att = { id: string; size: number };

/** Belegfotos einer Ausgabe: ansehen (für alle Mitglieder), hinzufügen, löschen. */
export function Attachments({ groupId, expenseId, initial, canAdd, max }: { groupId: string; expenseId: string; initial: Att[]; canAdd: boolean; max: number }) {
  const { t } = useI18n();
  const router = useRouter();
  const { ask, dialog } = useConfirm();
  const [list, setList] = useState(initial);
  const [error, setError] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);
  const base = `/api/groups/${groupId}/expenses/${expenseId}/attachments`;

  async function add(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    setBusy(true);
    setError(null);
    try {
      const image = await downscaleToBase64(f);
      const r = await api<{ attachment: Att }>("POST", base, { image });
      setList((l) => [r.attachment, ...l]);
      router.refresh();
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    if (!(await ask(t("attach.confirmDelete")))) return;
    setError(null);
    try {
      await api("DELETE", `${base}/${id}`);
      setList((l) => l.filter((a) => a.id !== id));
    } catch (err) {
      setError(err);
    }
  }

  if (!canAdd && list.length === 0) return null;
  return (
    <section className="card flex flex-col gap-3" data-testid="attachments">
      {dialog}
      <h2 className="font-semibold">{t("attach.title")}</h2>
      {list.length === 0 && <p className="muted">{t("attach.none")}</p>}
      <ul className="grid grid-cols-2 gap-2">
        {list.map((a) => (
          <li key={a.id} className="flex flex-col gap-1" data-testid="attachment">
            <a href={`${base}/${a.id}`} target="_blank" rel="noopener">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={`${base}/${a.id}`} alt={t("attach.alt")} className="aspect-square w-full rounded-lg bg-slate-100 object-cover dark:bg-slate-800" loading="lazy" />
            </a>
            <button type="button" className="btn-secondary !min-h-9 text-sm" onClick={() => remove(a.id)}>{t("common.delete")}</button>
          </li>
        ))}
      </ul>
      {canAdd && list.length < max && (
        <label className="btn-secondary cursor-pointer">
          {busy ? t("attach.uploading") : t("attach.add")}
          <input type="file" accept="image/*" capture="environment" className="sr-only" disabled={busy} onChange={add} data-testid="attach-input" />
        </label>
      )}
      <p className="muted text-sm">{t("attach.help")}</p>
      <ErrorMessage error={error} />
    </section>
  );
}
