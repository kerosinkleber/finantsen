import { actedBy, route, parseBody } from "@/server/http";
import { expenseSchema } from "@/lib/schemas";
import { deleteExpense, getExpense, updateExpense } from "@/server/services/expenses";

type P = { id: string; eid: string };
export const dynamic = "force-dynamic";
export const GET = route<P>(async ({ user, params }) => ({ expense: await getExpense(user.id, params.id, params.eid) }));
export const PUT = route<P>(async ({ req, user, params }) => {
  const body = await parseBody(req, expenseSchema);
  return { expense: await updateExpense(user.id, params.id, params.eid, body, actedBy(user)) };
});
export const DELETE = route<P>(async ({ user, params }) => {
  await deleteExpense(user.id, params.id, params.eid, actedBy(user));
  return { ok: true };
});
