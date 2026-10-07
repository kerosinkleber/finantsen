"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/client-api";
import { useI18n } from "@/i18n/client";
import { ErrorMessage } from "./ErrorMessage";

export function AcceptInvite({ code }: { code: string }) {
  const { t } = useI18n();
  const router = useRouter();
  const [error, setError] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);
  async function accept() {
    setBusy(true);
    try {
      const r = await api<{ groupId: string }>("POST", `/api/invites/${code}/accept`);
      router.replace(`/groups/${r.groupId}`);
    } catch (e) {
      setError(e);
      setBusy(false);
    }
  }
  return (
    <>
      <ErrorMessage error={error} />
      <button className="btn" onClick={accept} disabled={busy}>{t("join.accept")}</button>
    </>
  );
}
