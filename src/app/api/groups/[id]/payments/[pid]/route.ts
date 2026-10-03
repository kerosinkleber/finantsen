import { route } from "@/server/http";
import { deletePayment } from "@/server/services/payments";

export const DELETE = route<{ id: string; pid: string }>(async ({ user, params }) => {
  await deletePayment(user.id, params.id, params.pid);
  return { ok: true };
});
