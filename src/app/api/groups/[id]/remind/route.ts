import { z } from "zod";
import { route, parseBody } from "@/server/http";
import { remind } from "@/server/services/reminders";

export const dynamic = "force-dynamic";

/** Eine Person an ihre Schulden bei mir erinnern (höchstens einmal pro Tag). */
export const POST = route<{ id: string }>(async ({ req, user, params }) => {
  const body = await parseBody(req, z.object({ userId: z.string().uuid() }));
  return remind(user.id, params.id, body.userId);
});
