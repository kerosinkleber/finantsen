"use client";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { api, ApiClientError } from "@/lib/client-api";
import { useI18n } from "@/i18n/client";
import { ErrorMessage } from "./ErrorMessage";
import { CurrencySelect } from "./CurrencySelect";
import { RateSection } from "./RateSection";
import { ItemsEditor, newRow, type ItemRow } from "./ItemsEditor";
import { ReceiptScan, type ScanResult } from "./ReceiptScan";
import { CATEGORIES } from "@/lib/categories";
import { formatMoney, normalizeRate, parseAmount, toDecimalString } from "@/lib/money";
import type { MessageKey } from "@/i18n";
import type { DefaultSplit } from "@/lib/schemas";

type Member = { id: string; name: string };
type SplitType = "equal" | "percent" | "exact" | "shares" | "items" | "full";

export type ExpenseInitial = {
  id: string;
  title: string;
  amountMinor: number;
  currency: string;
  date: string;
  category: string;
  splitType: SplitType;
  payers: { userId: string; amountMinor: number }[];
  shares: { userId: string; amountMinor: number; input: number | null }[];
  baseCurrency: string;
  rate: string;
  rateSource: string;
  items: { items: { name: string; amountMinor: number; participants: string[] }[]; taxMinor: number; tipMinor: number } | null;
};

const SPLITS: SplitType[] = ["equal", "percent", "exact", "shares", "items", "full"];

export function ExpenseForm({ groupId, members, meId, defaultCurrency, baseCurrency, initial, defaultSplit }: {
  groupId: string;
  members: Member[];
  meId: string;
  defaultCurrency: string;
  /** Abrechnungswährung: Gruppenwährung (neu) bzw. die der bearbeiteten Ausgabe */
  baseCurrency: string;
  initial?: ExpenseInitial;
  defaultSplit?: DefaultSplit | null;
}) {
  const { t, locale } = useI18n();
  const router = useRouter();
  const [error, setError] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);

  const [title, setTitle] = useState(initial?.title ?? "");
  const [currency, setCurrency] = useState(initial?.currency ?? defaultCurrency);
  const [amount, setAmount] = useState(initial ? toDecimalString(initial.amountMinor, initial.currency) : "");
  const [date, setDate] = useState(initial?.date ?? new Date().toISOString().slice(0, 10));
  const [category, setCategory] = useState(initial?.category ?? "other");
  const usableDefault =
    !initial && defaultSplit && defaultSplit.entries.every((e) => members.some((m) => m.id === e.userId)) ? defaultSplit : null;
  const [splitType, setSplitType] = useState<SplitType>(initial?.splitType ?? usableDefault?.type ?? "equal");

  // Zahler
  const [multi, setMulti] = useState((initial?.payers.length ?? 1) > 1);
  const [payer, setPayer] = useState(initial?.payers[0]?.userId ?? meId);
  const [payerAmounts, setPayerAmounts] = useState<Record<string, string>>(() =>
    Object.fromEntries((initial?.payers ?? []).map((p) => [p.userId, toDecimalString(p.amountMinor, initial!.currency)])),
  );

  // Aufteilung
  const [included, setIncluded] = useState<Set<string>>(
    new Set(initial ? initial.shares.map((s) => s.userId) : usableDefault ? usableDefault.entries.map((e) => e.userId) : members.map((m) => m.id)),
  );
  const [values, setValues] = useState<Record<string, string>>(() => {
    const v: Record<string, string> = {};
    if (!initial) {
      if (usableDefault?.type === "percent") usableDefault.entries.forEach((e) => (v[e.userId] = String(e.value / 100)));
      if (usableDefault?.type === "shares") usableDefault.entries.forEach((e) => (v[e.userId] = String(e.value)));
      return v;
    }
    for (const s of initial.shares) {
      if (initial.splitType === "percent" && s.input !== null) v[s.userId] = (s.input / 100).toString();
      if (initial.splitType === "exact") v[s.userId] = toDecimalString(s.amountMinor, initial.currency);
      if (initial.splitType === "shares" && s.input !== null) v[s.userId] = String(s.input);
    }
    return v;
  });
  const [owner, setOwner] = useState(initial?.splitType === "full" ? (initial.shares[0]?.userId ?? meId) : members.find((m) => m.id !== meId)?.id ?? meId);

  // Einzelposten
  const allIds = members.map((m) => m.id);
  const [rows, setRows] = useState<ItemRow[]>(() =>
    initial?.items
      ? initial.items.items.map((i) => newRow(i.participants, i.name, toDecimalString(i.amountMinor, initial.currency)))
      : [newRow(allIds)],
  );
  const [tax, setTax] = useState(initial?.items?.taxMinor ? toDecimalString(initial.items.taxMinor, initial.currency) : "");
  const [tip, setTip] = useState(initial?.items?.tipMinor ? toDecimalString(initial.items.tipMinor, initial.currency) : "");
  const [manualRate, setManualRate] = useState<string | null>(null);

  const itemsTotal =
    rows.reduce((a, r) => a + (parseAmount(r.price, currency) ?? 0), 0) + (parseAmount(tax, currency) ?? 0) + (parseAmount(tip, currency) ?? 0);
  const amountText = splitType === "items" ? toDecimalString(itemsTotal, currency) : amount;
  const total = useMemo(() => parseAmount(amountText, currency), [amountText, currency]);

  function applyScan(r: ScanResult) {
    if (r.merchant) setTitle(r.merchant);
    if (r.date) setDate(r.date);
    setCurrency(r.currency);
    setRows(r.items.length ? r.items.map((i) => newRow(allIds, i.name, toDecimalString(i.amountMinor, r.currency))) : [newRow(allIds)]);
    setTax(r.taxMinor ? toDecimalString(r.taxMinor, r.currency) : "");
    setTip(r.tipMinor ? toDecimalString(r.tipMinor, r.currency) : "");
    setManualRate(null);
    setSplitType("items");
  }
  const fmt = (n: number) => formatMoney(Math.abs(n), currency, locale);

  const nameOf = (id: string) => members.find((m) => m.id === id)?.name ?? "?";
  const toggle = (id: string) =>
    setIncluded((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  const setVal = (id: string, v: string) => setValues((x) => ({ ...x, [id]: v }));

  // Summenkontrollen
  const pctSum = [...included].reduce((a, id) => a + (parseAmount(values[id] ?? "", "EUR") ?? 0), 0); // Basispunkte
  const exactSum = [...included].reduce((a, id) => a + (parseAmount(values[id] ?? "", currency) ?? 0), 0);
  const payerSum = Object.values(payerAmounts).reduce((a, v) => a + (parseAmount(v, currency) ?? 0), 0);

  function sumHint(diff: number, formatted: string) {
    if (diff === 0) return <span className="pos">{t("expense.sumOk")}</span>;
    return <span className="neg">{diff > 0 ? t("expense.sumLeft", { amount: formatted }) : t("expense.sumOver", { amount: formatted })}</span>;
  }

  function buildBody() {
    if (total === null || total <= 0) throw new ApiClientError(400, "invalid_amount");
    const payers = multi
      ? Object.entries(payerAmounts)
          .map(([userId, v]) => ({ userId, amountMinor: parseAmount(v, currency) ?? 0 }))
          .filter((p) => p.amountMinor > 0)
      : [{ userId: payer, amountMinor: total }];
    const ids = [...included];
    let split: unknown;
    switch (splitType) {
      case "equal":
        split = { type: "equal", participants: ids };
        break;
      case "full":
        split = { type: "full", owner };
        break;
      case "percent":
        split = { type: "percent", entries: ids.map((userId) => ({ userId, bp: parseAmount(values[userId] ?? "", "EUR") ?? 0 })) };
        break;
      case "exact":
        split = { type: "exact", entries: ids.map((userId) => ({ userId, amountMinor: parseAmount(values[userId] ?? "", currency) ?? 0 })) };
        break;
      case "shares":
        split = { type: "shares", entries: ids.map((userId) => ({ userId, shares: Math.max(0, parseInt(values[userId] ?? "1", 10) || 0) })) };
        break;
      case "items":
        if (rows.some((r) => r.who.length === 0)) throw new ApiClientError(400, "no_participants");
        split = {
          type: "items",
          items: rows.map((r) => ({ name: r.name, amountMinor: parseAmount(r.price, currency) ?? 0, participants: r.who })),
          taxMinor: parseAmount(tax, currency) ?? 0,
          tipMinor: parseAmount(tip, currency) ?? 0,
        };
        break;
    }
    let rate: string | undefined;
    if (manualRate !== null && currency !== baseCurrency) {
      if (!normalizeRate(manualRate)) throw new ApiClientError(400, "invalid_rate");
      rate = manualRate;
    }
    return { title, amountMinor: total, currency, date, category, payers, split, rate };
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const body = buildBody();
      if (initial) await api("PUT", `/api/groups/${groupId}/expenses/${initial.id}`, body);
      else await api("POST", `/api/groups/${groupId}/expenses`, body);
      router.replace(`/groups/${groupId}`);
      router.refresh();
    } catch (err) {
      setError(err);
      setBusy(false);
    }
  }

  async function remove() {
    if (!initial || !confirm(t("expense.deleteConfirm"))) return;
    setBusy(true);
    try {
      await api("DELETE", `/api/groups/${groupId}/expenses/${initial.id}`);
      router.replace(`/groups/${groupId}`);
      router.refresh();
    } catch (err) {
      setError(err);
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      {!initial && <ReceiptScan fallbackCurrency={defaultCurrency} onResult={applyScan} />}
      <div className="card flex flex-col gap-4">
        <div>
          <label className="label" htmlFor="title">{t("expense.title")}</label>
          <input id="title" className="input" value={title} onChange={(e) => setTitle(e.target.value)} required maxLength={200} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label" htmlFor="amount">{t("expense.amount")}</label>
            <input
              id="amount"
              className="input"
              inputMode="decimal"
              value={amountText}
              onChange={(e) => setAmount(e.target.value)}
              required
              placeholder="0,00"
              readOnly={splitType === "items"}
              aria-describedby={splitType === "items" ? "amount-auto" : undefined}
            />
            {splitType === "items" && <span id="amount-auto" className="muted block">{t("items.totalAuto")}</span>}
          </div>
          <div>
            <label className="label" htmlFor="currency">{t("expense.currency")}</label>
            <CurrencySelect id="currency" value={currency} onChange={setCurrency} />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label" htmlFor="date">{t("expense.date")}</label>
            <input id="date" type="date" className="input" value={date} onChange={(e) => setDate(e.target.value)} required />
          </div>
          <div>
            <label className="label" htmlFor="category">{t("expense.category")}</label>
            <select id="category" className="input" value={category} onChange={(e) => setCategory(e.target.value)}>
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>{t(`cat.${c}` as MessageKey)}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <RateSection
        from={currency}
        to={baseCurrency}
        date={date}
        amountMinor={total}
        stored={initial ? { rate: initial.rate, source: initial.rateSource, currency: initial.currency, date: initial.date } : null}
        manual={manualRate}
        setManual={setManualRate}
      />

      <fieldset className="card flex flex-col gap-3">
        <legend className="sr-only">{t("expense.paidBy")}</legend>
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">{t("expense.paidBy")}</h2>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" className="h-4 w-4" checked={multi} onChange={(e) => setMulti(e.target.checked)} />
            {t("expense.multiplePayers")}
          </label>
        </div>
        {!multi ? (
          <select className="input" aria-label={t("expense.paidBy")} value={payer} onChange={(e) => setPayer(e.target.value)}>
            {members.map((m) => (
              <option key={m.id} value={m.id}>{m.id === meId ? `${m.name} (${t("common.you")})` : m.name}</option>
            ))}
          </select>
        ) : (
          <>
            {members.map((m) => (
              <div key={m.id} className="flex items-center gap-3">
                <span className="flex-1">{m.name}</span>
                <input
                  className="input !w-32 text-right"
                  inputMode="decimal"
                  aria-label={`${t("expense.paidBy")} ${m.name}`}
                  value={payerAmounts[m.id] ?? ""}
                  onChange={(e) => setPayerAmounts((x) => ({ ...x, [m.id]: e.target.value }))}
                  placeholder="0"
                />
              </div>
            ))}
            {total !== null && <p className="text-sm" data-testid="payer-hint">{sumHint(total - payerSum, fmt(total - payerSum))}</p>}
          </>
        )}
      </fieldset>

      <fieldset className="card flex flex-col gap-3">
        <legend className="sr-only">{t("expense.splitType")}</legend>
        <h2 className="font-semibold">{t("expense.splitType")}</h2>
        <div className="flex flex-wrap gap-2" role="radiogroup">
          {SPLITS.map((s) => (
            <button
              type="button"
              key={s}
              role="radio"
              aria-checked={splitType === s}
              onClick={() => setSplitType(s)}
              className={`min-h-9 rounded-full border px-3 text-sm ${splitType === s ? "border-brand bg-brand text-white" : "border-slate-300 dark:border-slate-700"}`}
            >
              {t(`expense.split.${s}` as MessageKey)}
            </button>
          ))}
        </div>

        {splitType === "items" ? (
          <ItemsEditor members={members} currency={currency} rows={rows} setRows={setRows} tax={tax} setTax={setTax} tip={tip} setTip={setTip} totalMinor={itemsTotal} />
        ) : splitType === "full" ? (
          <div>
            <label className="label" htmlFor="owner">{t("expense.owner")}</label>
            <select id="owner" className="input" value={owner} onChange={(e) => setOwner(e.target.value)}>
              {members.map((m) => (
                <option key={m.id} value={m.id}>{m.name}</option>
              ))}
            </select>
          </div>
        ) : (
          <>
            <p className="muted">{t("expense.splitBetween")}</p>
            {members.map((m) => (
              <div key={m.id} className="flex items-center gap-3">
                <label className="flex flex-1 items-center gap-3">
                  <input type="checkbox" className="h-5 w-5" checked={included.has(m.id)} onChange={() => toggle(m.id)} aria-label={m.name} />
                  <span>{nameOf(m.id)}</span>
                </label>
                {splitType !== "equal" && included.has(m.id) && (
                  <span className="flex items-center gap-1">
                    <input
                      className="input !w-28 text-right"
                      inputMode="decimal"
                      aria-label={`${t(`expense.split.${splitType}` as MessageKey)} ${m.name}`}
                      value={values[m.id] ?? (splitType === "shares" ? "1" : "")}
                      onChange={(e) => setVal(m.id, e.target.value)}
                    />
                    <span className="muted w-4">{splitType === "percent" ? "%" : ""}</span>
                  </span>
                )}
              </div>
            ))}
            {splitType === "percent" && <p className="text-sm" data-testid="split-hint">{sumHint(10000 - pctSum, `${((10000 - pctSum) / 100).toLocaleString(locale)} %`)}</p>}
            {splitType === "exact" && total !== null && <p className="text-sm" data-testid="split-hint">{sumHint(total - exactSum, fmt(total - exactSum))}</p>}
          </>
        )}
      </fieldset>

      <ErrorMessage error={error} />
      <div className="flex flex-col gap-2">
        <button className="btn" disabled={busy}>{t("common.save")}</button>
        {initial && <button type="button" className="btn-danger" onClick={remove} disabled={busy}>{t("common.delete")}</button>}
      </div>
    </form>
  );
}
