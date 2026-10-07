"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/client-api";
import { useI18n } from "@/i18n/client";
import { ErrorMessage } from "./ErrorMessage";
import { CurrencySelect } from "./CurrencySelect";

export function NewGroupForm() {
  const { t } = useI18n();
  const router = useRouter();
  const [error, setError] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);
  const [currency, setCurrency] = useState("EUR");
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setBusy(true);
    try {
      const r = await api<{ group: { id: string } }>("POST", "/api/groups", { name: f.get("name"), defaultCurrency: currency });
      router.replace(`/groups/${r.group.id}`);
    } catch (err) {
      setError(err);
      setBusy(false);
    }
  }
  return (
    <form onSubmit={submit} className="card flex flex-col gap-4">
      <div>
        <label className="label" htmlFor="name">{t("group.name")}</label>
        <input id="name" name="name" className="input" required maxLength={100} />
      </div>
      <div>
        <label className="label" htmlFor="cur">{t("group.defaultCurrency")}</label>
        <CurrencySelect id="cur" value={currency} onChange={setCurrency} />
      </div>
      <ErrorMessage error={error} />
      <button className="btn" disabled={busy}>{t("group.create")}</button>
    </form>
  );
}
