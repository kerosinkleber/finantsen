import type { ExpenseInitial } from "./ExpenseForm";
import type { ExpenseDetail } from "@/server/services/expenses";

/** Startwerte des Ausgabenformulars aus einer gespeicherten Ausgabe (Bearbeiten und Kopieren). */
export function expenseToInitial(expense: ExpenseDetail): ExpenseInitial {
  return {
    id: expense.id,
    title: expense.title,
    amountMinor: expense.amountMinor,
    currency: expense.currency,
    date: expense.date,
    category: expense.category,
    splitType: expense.splitType as ExpenseInitial["splitType"],
    payers: expense.payers,
    shares: expense.shares,
    baseCurrency: expense.baseCurrency,
    rate: expense.rate,
    rateSource: expense.rateSource,
    items: expense.items,
  };
}
