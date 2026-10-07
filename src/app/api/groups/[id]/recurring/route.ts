import { route, parseBody } from "@/server/http";
import { recurringSchema } from "@/lib/schemas";
import { createRecurring, listRecurring } from "@/server/services/recurring";

export const dynamic = "force-dynamic";
export const GET = route<{ id: string }>(async ({ user, params }) => listRecurring(user.id, params.id));
export const POST = route<{ id: string }>(async ({ req, user, params }) => {
  const body = await parseBody(req, recurringSchema);
  return createRecurring(user.id, params.id, body);
});
