import { route, parseBody } from "@/server/http";
import { recurringSchema } from "@/lib/schemas";
import { deleteRecurring, getRecurring, updateRecurring } from "@/server/services/recurring";

type P = { id: string; rid: string };
export const dynamic = "force-dynamic";
export const GET = route<P>(async ({ user, params }) => ({ recurring: await getRecurring(user.id, params.id, params.rid) }));
export const PUT = route<P>(async ({ req, user, params }) => {
  const body = await parseBody(req, recurringSchema);
  return updateRecurring(user.id, params.id, params.rid, body);
});
export const DELETE = route<P>(async ({ user, params }) => {
  await deleteRecurring(user.id, params.id, params.rid);
  return { ok: true };
});
