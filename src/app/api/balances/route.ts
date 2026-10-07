import { route } from "@/server/http";
import { overallBalances } from "@/server/services/balances";

export const dynamic = "force-dynamic";
export const GET = route(async ({ user }) => overallBalances(user.id));
