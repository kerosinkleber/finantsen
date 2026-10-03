"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/client-api";
import { useI18n } from "@/i18n/client";
import { ErrorMessage } from "./ErrorMessage";

export type CommentView = { id: string; userId: string; userName: string; body: string; createdAt: string };

export function Comments({ groupId, expenseId, meId, comments }: { groupId: string; expenseId: string; meId: string; comments: CommentView[] }) {
  const { t, locale } = useI18n();
  const router = useRouter();
  const [body, setBody] = useState("");
  const [error, setError] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);
  const base = `/api/groups/${groupId}/expenses/${expenseId}/comments`;

  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (!body.trim()) return;
    setBusy(true);
    setError(null);
    try {
      await api("POST", base, { body });
      setBody("");
      router.refresh();
    } catch (err) {
      setError(err);
    }
    setBusy(false);
  }
  async function remove(id: string) {
    try {
      await api("DELETE", `${base}/${id}`);
      router.refresh();
    } catch (err) {
      setError(err);
    }
  }

  return (
    <section className="card flex flex-col gap-3" data-testid="comments">
      <h2 className="font-semibold">{t("comments.title")}</h2>
      {comments.length === 0 && <p className="muted">{t("comments.none")}</p>}
      <ul className="flex flex-col gap-3">
        {comments.map((c) => (
          <li key={c.id} className="text-sm" data-testid="comment">
            <p className="flex items-center justify-between gap-2">
              <span>
                <span className="font-medium">{c.userName}</span>{" "}
                <time className="muted" dateTime={c.createdAt}>{new Date(c.createdAt).toLocaleString(locale)}</time>
              </span>
              {c.userId === meId && (
                <button className="muted underline" onClick={() => remove(c.id)}>{t("common.delete")}</button>
              )}
            </p>
            <p className="whitespace-pre-wrap break-words">{c.body}</p>
          </li>
        ))}
      </ul>
      <ErrorMessage error={error} />
      <form onSubmit={send} className="flex gap-2">
        <input className="input" value={body} onChange={(e) => setBody(e.target.value)} placeholder={t("comments.placeholder")} aria-label={t("comments.placeholder")} maxLength={2000} />
        <button className="btn" disabled={busy}>{t("comments.send")}</button>
      </form>
    </section>
  );
}
