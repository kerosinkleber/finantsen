import { route, parseBody } from "@/server/http";
import { paymentSchema } from "@/lib/schemas";
import { createPayment, listPayments } from "@/server/services/payments";

type P = { id: string };
export const dynamic = "force-dynamic";
export const GET = route<P>(async ({ user, params }) => ({ payments: await listPayments(user.id, params.id) }));
export const POST = route<P>(async ({ req, user, params }) => {
  const body = await parseBody(req, paymentSchema);
  return { payment: await createPayment(user.id, params.id, body) };
});
