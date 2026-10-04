"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/client-api";
import { useI18n } from "@/i18n/client";
import { ErrorMessage } from "./ErrorMessage";
import { QrCode } from "./QrCode";
import { useConfirm } from "./useConfirm";

type Guest = { id: string; name: string };

/** Mitglieder ohne Konto: anlegen, umbenennen, löschen (nur ohne Daten), Verknüpfungs-Link mit QR-Code. */
export function Guests({ groupId, guests }: { groupId: string; guests: Guest[] }) {
  const { t } = useI18n();
  const router = useRouter();
  const { ask, dialog } = useConfirm();
  const [name, setName] = useState("");
  const [error, setError] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);
  const [link, setLink] = useState<{ guestId: string; url: string } | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [editName, setEditName] = useState("");

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
  const add = (e: React.FormEvent) => {
    e.preventDefault();
    return run(async () => {
      await api("POST", `/api/groups/${groupId}/guests`, { name });
      setName("");
    });
  };
  const makeLink = (g: Guest) =>
    run(async () => {
      const r = await api<{ code: string }>("POST", `/api/groups/${groupId}/guests/${g.id}/link`);
      setLink({ guestId: g.id, url: `${window.location.origin}/join/${r.code}` });
    });

  return (
    <section className="card flex flex-col gap-3" data-testid="guests">
      {dialog}
      <h2 className="font-semibold">{t("guest.title")}</h2>
      <p className="muted">{t("guest.intro")}</p>
      {guests.length > 0 && (
        <ul className="flex flex-col gap-2">
          {guests.map((g) => (
            <li key={g.id} className="flex flex-col gap-2 rounded-lg border border-slate-300 p-3 dark:border-slate-700" data-testid="guest-item">
              {editing === g.id ? (
                <form
                  className="flex gap-2"
                  onSubmit={(e) => {
                    e.preventDefault();
                    void run(async () => {
                      await api("PATCH", `/api/groups/${groupId}/guests/${g.id}`, { name: editName });
                      setEditing(null);
                    });
                  }}
                >
                  <input className="input" aria-label={t("guest.name")} value={editName} onChange={(e) => setEditName(e.target.value)} required maxLength={100} />
                  <button className="btn-secondary" disabled={busy}>{t("common.save")}</button>
                </form>
              ) : (
                <span className="font-medium">{g.name}</span>
              )}
              <div className="flex flex-wrap gap-2">
                <button className="btn-secondary !min-h-9 !px-3" disabled={busy} onClick={() => makeLink(g)} data-testid="guest-link">{t("guest.link")}</button>
                <button className="btn-secondary !min-h-9 !px-3" onClick={() => { setEditing(g.id); setEditName(g.name); }}>{t("common.edit")}</button>
                <button
                  className="btn-danger !min-h-9 !px-3"
                  disabled={busy}
                  data-testid="guest-delete"
                  onClick={async () => (await ask(t("guest.confirmDelete", { name: g.name }))) && run(() => api("DELETE", `/api/groups/${groupId}/guests/${g.id}`).then(() => {}))}
                >
                  {t("common.delete")}
                </button>
              </div>
              {link?.guestId === g.id && (
                <div className="flex flex-col gap-2 rounded-lg bg-slate-100 p-3 dark:bg-slate-800">
                  <p className="text-sm">{t("guest.linkHelp", { name: g.name })}</p>
                  <input readOnly className="input" value={link.url} data-testid="guest-link-url" onFocus={(e) => e.currentTarget.select()} />
                  <QrCode text={link.url} label={t("invite.qrAlt")} />
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
      <form onSubmit={add} className="flex gap-2">
        <input className="input" aria-label={t("guest.name")} placeholder={t("guest.name")} value={name} onChange={(e) => setName(e.target.value)} required maxLength={100} />
        <button className="btn" disabled={busy} data-testid="guest-add">{t("guest.add")}</button>
      </form>
      <ErrorMessage error={error} />
    </section>
  );
}
