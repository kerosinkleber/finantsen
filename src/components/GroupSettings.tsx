"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/client-api";
import { useConfirm } from "./useConfirm";
import { useI18n } from "@/i18n/client";
import { ErrorMessage } from "./ErrorMessage";

export function GroupSettings({ groupId, simplify, recurringOnlyOwner, isOwner, isDirect, members, meId }: {
  groupId: string;
  simplify: boolean;
  recurringOnlyOwner: boolean;
  isOwner: boolean;
  isDirect: boolean;
  members: { id: string; name: string }[];
  meId: string;
}) {
  const { t } = useI18n();
  const { ask, dialog } = useConfirm();
  const router = useRouter();
  const [error, setError] = useState<unknown>(null);

  async function run(fn: () => Promise<unknown>, after?: () => void) {
    setError(null);
    try {
      await fn();
      if (after) after();
      else router.refresh();
    } catch (e) {
      setError(e);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {dialog}
      <ErrorMessage error={error} />
      {isOwner && (
        <label className="card flex items-start gap-3">
          <input
            type="checkbox"
            className="mt-1 h-5 w-5"
            defaultChecked={simplify}
            onChange={(e) => run(() => api("PATCH", `/api/groups/${groupId}`, { simplifyDebts: e.target.checked }))}
          />
          <span>
            <span className="font-medium">{t("group.simplify")}</span>
            <span className="muted block">{t("group.simplifyHelp")}</span>
          </span>
        </label>
      )}
      {isOwner && (
        <label className="card flex items-start gap-3">
          <input
            type="checkbox"
            className="mt-1 h-5 w-5"
            data-testid="recurring-policy"
            defaultChecked={recurringOnlyOwner}
            onChange={(e) => run(() => api("PATCH", `/api/groups/${groupId}`, { recurringPolicy: e.target.checked ? "owner" : "members" }))}
          />
          <span>
            <span className="font-medium">{t("recurring.policy")}</span>
            <span className="muted block">{t("recurring.policyHelp")}</span>
          </span>
        </label>
      )}
      {!isDirect && isOwner && (
        <ul className="flex flex-col gap-1">
          {members.filter((m) => m.id !== meId).map((m) => (
            <li key={m.id} className="flex items-center justify-between">
              <span>{m.name}</span>
              <button className="btn-danger" onClick={() => run(() => api("DELETE", `/api/groups/${groupId}/members/${m.id}`))}>{t("group.remove")}</button>
            </li>
          ))}
        </ul>
      )}
      {!isDirect && (
        <button className="btn-secondary" onClick={() => run(() => api("DELETE", `/api/groups/${groupId}/members/${meId}`), () => { router.replace("/"); router.refresh(); })}>
          {t("group.leave")}
        </button>
      )}
      {isOwner && (
        <button
          className="btn-danger"
          onClick={async () => (await ask(t("group.deleteGroupConfirm"))) && run(() => api("DELETE", `/api/groups/${groupId}`), () => { router.replace("/"); router.refresh(); })}
        >
          {t("group.deleteGroup")}
        </button>
      )}
    </div>
  );
}
