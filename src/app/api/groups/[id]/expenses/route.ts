import { route, parseBody } from "@/server/http";
import { expenseSchema } from "@/lib/schemas";
import { createExpense, listExpenses } from "@/server/services/expenses";
import { getGroup } from "@/server/services/groups";
import { parseExpenseFilter } from "@/server/filter";

type P = { id: string };
export const dynamic = "force-dynamic";
export const GET = route<P>(async ({ req, user, params }) => {
  const group = await getGroup(user.id, params.id);
  const { filter } = parseExpenseFilter(Object.fromEntries(new URL(req.url).searchParams), group.defaultCurrency);
  return { expenses: await listExpenses(user.id, params.id, { filter }) };
});
export const POST = route<P>(async ({ req, user, params }) => {
  const body = await parseBody(req, expenseSchema);
  return { expense: await createExpense(user.id, params.id, body) };
});
