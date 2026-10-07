import { PAYMENT_METHODS } from "@/lib/schemas";
import { CATEGORIES } from "@/lib/categories";
import { isValidCurrency, parseAmount } from "@/lib/money";
import type { ExpenseFilter } from "./services/expenses";

type Raw = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v)?.trim() || undefined;
const isDate = (s?: string) => !!s && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s));

/**
 * Liest Filter aus Query-Parametern (q, min, max, from, to, category, person, currency).
 * Beträge min/max werden in der Währung `currency` (Standard: `fallbackCurrency`) interpretiert;
 * ungültige Werte werden ignoriert. Gibt zusätzlich die Roh-Eingaben für das Formular zurück.
 */
export function parseExpenseFilter(raw: Raw, fallbackCurrency: string): { filter: ExpenseFilter; active: boolean } {
  const cur = one(raw.currency)?.toUpperCase();
  const currency = cur && isValidCurrency(cur) ? cur : fallbackCurrency;
  const filter: ExpenseFilter = {};
  const q = one(raw.q);
  if (q) filter.q = q.slice(0, 100);
  const min = one(raw.min);
  const max = one(raw.max);
  const minV = min ? parseAmount(min, currency) : null;
  const maxV = max ? parseAmount(max, currency) : null;
  if (minV !== null) filter.minMinor = minV;
  if (maxV !== null) filter.maxMinor = maxV;
  if (minV !== null || maxV !== null) filter.amountCurrency = currency;
  const from = one(raw.from);
  const to = one(raw.to);
  if (isDate(from)) filter.from = from;
  if (isDate(to)) filter.to = to;
  const cat = one(raw.category);
  if (cat && (CATEGORIES as readonly string[]).includes(cat)) filter.category = cat;
  const method = one(raw.method);
  if (method && (PAYMENT_METHODS as readonly string[]).includes(method)) filter.paymentMethod = method;
  const person = one(raw.person);
  if (person && /^[0-9a-f-]{36}$/i.test(person)) filter.person = person;
  return { filter, active: Object.keys(filter).length > 0 };
}
