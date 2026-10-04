import { z } from "zod";
import { route, parseBody } from "@/server/http";
import { setRecurringPaused } from "@/server/services/recurring";

/** Pausieren oder fortsetzen (beim Fortsetzen werden verpasste Termine nachgebucht). */
export const POST = route<{ id: string; rid: string }>(async ({ req, user, params }) => {
  const body = await parseBody(req, z.object({ paused: z.boolean() }));
  return setRecurringPaused(user.id, params.id, params.rid, body.paused);
});
