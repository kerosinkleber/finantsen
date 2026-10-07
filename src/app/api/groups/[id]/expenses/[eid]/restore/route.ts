import { actedBy, route } from "@/server/http";
import { restoreExpense } from "@/server/services/expenses";

/** Gelöschte Ausgabe wiederherstellen. */
export const POST = route<{ id: string; eid: string }>(async ({ user, params }) => {
  return { expense: await restoreExpense(user.id, params.id, params.eid, actedBy(user)) };
});
