import { route } from "@/server/http";
import { expenseHistoryFor } from "@/server/services/expenses";

export const dynamic = "force-dynamic";
export const GET = route<{ id: string; eid: string }>(async ({ user, params }) => ({
  history: await expenseHistoryFor(user.id, params.id, params.eid),
}));
