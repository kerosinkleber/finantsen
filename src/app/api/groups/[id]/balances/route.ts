import { route } from "@/server/http";
import { getGroupBalances } from "@/server/services/balances";

export const dynamic = "force-dynamic";
export const GET = route<{ id: string }>(async ({ user, params }) => getGroupBalances(user.id, params.id));
