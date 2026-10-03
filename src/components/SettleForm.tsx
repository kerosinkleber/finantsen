"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { api, ApiClientError } from "@/lib/client-api";
import { useI18n } from "@/i18n/client";
import { ErrorMessage } from "./ErrorMessage";
import { CurrencySelect } from "./CurrencySelect";
import { parseAmount, toDecimalString } from "@/lib/money";

export function SettleForm({ groupId, members, meId, initial }: {
  groupId: string;
  members: { id: string; name: string }[];
  meId: string;
  initial: { from?: string; to?: string; amountMinor?: number; currency: string };
}) {
  const { t } = useI18n();
  const router = useRouter();
  const other = members.find((m) => m.id !== meId)?.id ?? meId;
  const [from, setFrom] = useState(initial.from ?? meId);
  const [to, setTo] = useState(initial.to ?? other);
  const [currency, setCurrency] = useState(initial.currency);
  const [amount, setAmount] = useState(initial.amountMinor ? toDecimalString(initial.amountMinor, initial.currency) : "");
  const [note, setNote] = useState("");
  const [error, setError] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const amountMinor = parseAmount(amount, currency);
      if (!amountMinor || amountMinor <= 0) throw new ApiClientError(400, "invalid_amount");
      await api("POST", `/api/groups/${groupId}/payments`, {
        fromUser: from,
        toUser: to,
        amountMinor,
        currency,
        date: new Date().toISOString().slice(0, 10),
        note: note || undefined,
      });
      router.replace(`/groups/${groupId}?tab=balances`);
      router.refresh();
    } catch (err) {
      setError(err);
      setBusy(false);
    }
  }

  const select = (id: string, value: string, set: (v: string) => void) => (
    <select id={id} className="input" value={value} onChange={(e) => set(e.target.value)}>
      {members.map((m) => (
        <option key={m.id} value={m.id}>{m.id === meId ? `${m.name} (${t("common.you")})` : m.name}</option>
      ))}
    </select>
  );
  return (
    <form onSubmit={submit} className="card flex flex-col gap-4">
      <div>
        <label className="label" htmlFor="from">{t("settle.from")}</label>
        {select("from", from, setFrom)}
      </div>
      <div>
        <label className="label" htmlFor="to">{t("settle.to")}</label>
        {select("to", to, setTo)}
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label" htmlFor="amount">{t("expense.amount")}</label>
          <input id="amount" className="input" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} required />
        </div>
        <div>
          <label className="label" htmlFor="cur">{t("expense.currency")}</label>
          <CurrencySelect id="cur" value={currency} onChange={setCurrency} />
        </div>
      </div>
      <div>
        <label className="label" htmlFor="note">{t("settle.note")}</label>
        <input id="note" className="input" value={note} onChange={(e) => setNote(e.target.value)} maxLength={200} />
      </div>
      <ErrorMessage error={error} />
      <button className="btn" disabled={busy}>{t("settle.save")}</button>
    </form>
  );
}
