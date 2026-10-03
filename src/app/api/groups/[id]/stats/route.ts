import { route } from "@/server/http";
import { getGroupStats } from "@/server/services/stats";

export const dynamic = "force-dynamic";
export const GET = route<{ id: string }>(async ({ req, user, params }) => {
  const sp = new URL(req.url).searchParams;
  const ok = (s: string | null) => (s && /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : undefined);
  return { stats: await getGroupStats(user.id, params.id, { from: ok(sp.get("from")), to: ok(sp.get("to")) }) };
});
