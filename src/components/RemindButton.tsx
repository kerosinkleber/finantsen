"use client";
import { useState } from "react";
import { api } from "@/lib/client-api";
import { useI18n } from "@/i18n/client";
import { useErrorText } from "./ErrorMessage";

/** „Erinnern“ an einem Ausgleichsvorschlag, bei dem mir jemand Geld schuldet (Server drosselt auf einmal pro Tag). */
export function RemindButton({ groupId, userId, done = false }: { groupId: string; userId: string; done?: boolean }) {
  const { t } = useI18n();
  const errorText = useErrorText();
  const [state, setState] = useState<"idle" | "busy" | "sent">(done ? "sent" : "idle");
  const [error, setError] = useState<string | null>(null);
  async function remind() {
    setState("busy");
    setError(null);
    try {
      await api("POST", `/api/groups/${groupId}/remind`, { userId });
      setState("sent");
    } catch (e) {
      setError(errorText(e));
      setState("idle");
    }
  }
  return (
    <span className="flex flex-col items-end gap-1">
      <button type="button" className="btn-secondary !min-h-9 !px-3" disabled={state !== "idle"} onClick={remind} data-testid="remind">
        {state === "sent" ? t("remind.sent") : t("remind.button")}
      </button>
      {error && <span role="alert" className="text-xs text-red-700 dark:text-red-300">{error}</span>}
    </span>
  );
}
