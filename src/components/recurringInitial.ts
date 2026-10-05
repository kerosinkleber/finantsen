import { computeShares, type SplitInput } from "@/lib/money";
import type { ExpenseInitial } from "./ExpenseForm";

type Template = {
  title: string;
  amountMinor: number;
  currency: string;
  category: string;
  isRefund?: boolean;
  paymentMethod?: string | null;
  payers: { userId: string; amountMinor: number }[];
  split:
    | { type: "equal"; participants: string[] }
    | { type: "percent"; entries: { userId: string; bp: number }[] }
    | { type: "exact"; entries: { userId: string; amountMinor: number }[] }
    | { type: "shares"; entries: { userId: string; shares: number }[] }
    | { type: "adjust"; entries: { userId: string; adjustMinor: number }[] }
    | { type: "full"; owner: string }
    | { type: "items"; items: { name: string; amountMinor: number; participants: string[] }[]; taxMinor: number; tipMinor: number };
};

/** Baut aus einer gespeicherten Vorlage die Startwerte des Ausgabenformulars (Anteile werden wie auf dem Server berechnet). */
export function templateToInitial(id: string, startDate: string, t: Template): ExpenseInitial {
  const s = t.split;
  const input: SplitInput =
    s.type === "percent" ? { type: "percent", entries: s.entries.map((e) => ({ id: e.userId, bp: e.bp })) }
    : s.type === "exact" ? { type: "exact", entries: s.entries.map((e) => ({ id: e.userId, amount: e.amountMinor })) }
    : s.type === "shares" ? { type: "shares", entries: s.entries.map((e) => ({ id: e.userId, shares: e.shares })) }
    : s.type === "adjust" ? { type: "adjust", entries: s.entries.map((e) => ({ id: e.userId, adjust: e.adjustMinor })) }
    : s.type === "items" ? { type: "items", items: s.items.map((i) => ({ name: i.name, amount: i.amountMinor, participants: i.participants })), tax: s.taxMinor, tip: s.tipMinor }
    : s;
  const raw = new Map<string, number>();
  if (s.type === "percent") s.entries.forEach((e) => raw.set(e.userId, e.bp));
  if (s.type === "shares") s.entries.forEach((e) => raw.set(e.userId, e.shares));
  if (s.type === "adjust") s.entries.forEach((e) => raw.set(e.userId, e.adjustMinor));
  return {
    id,
    title: t.title,
    amountMinor: t.amountMinor,
    currency: t.currency,
    date: startDate,
    category: t.category,
    splitType: s.type,
    payers: t.payers,
    shares: computeShares(t.amountMinor, input).map((a) => ({ userId: a.id, amountMinor: a.amount, input: raw.get(a.id) ?? null })),
    baseCurrency: t.currency,
    rate: "1",
    rateSource: "same",
    isRefund: t.isRefund ?? false,
    paymentMethod: t.paymentMethod ?? null,
    items: s.type === "items" ? { items: s.items, taxMinor: s.taxMinor, tipMinor: s.tipMinor } : null,
  };
}
