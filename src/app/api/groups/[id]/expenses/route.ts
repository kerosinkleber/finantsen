import { route, parseBody } from "@/server/http";
import { expenseSchema } from "@/lib/schemas";
import { createExpense, listExpenses } from "@/server/services/expenses";

type P = { id: string };
export const dynamic = "force-dynamic";
export const GET = route<P>(async ({ user, params }) => ({ expenses: await listExpenses(user.id, params.id) }));
export const POST = route<P>(async ({ req, user, params }) => {
  const body = await parseBody(req, expenseSchema);
  return { expense: await createExpense(user.id, params.id, body) };
});
