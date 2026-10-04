import { z } from "zod";
import { route, parseBody, ApiError } from "@/server/http";
import { isAllowedPushEndpoint } from "@/lib/safe-next";
import { pushConfig, removeSubscription, saveSubscription } from "@/server/services/push";

export const dynamic = "force-dynamic";
/** Liefert, ob Web Push serverseitig aktiviert ist, und den öffentlichen VAPID-Schlüssel. */
export const GET = route(async () => pushConfig());
export const POST = route(async ({ req, user }) => {
  if (!pushConfig().enabled) return Response.json({ error: "push_disabled" }, { status: 503 });
  const body = await parseBody(
    req,
    z.object({ endpoint: z.string().url().max(2000), keys: z.object({ p256dh: z.string().max(200), auth: z.string().max(100) }) }),
  );
  if (!isAllowedPushEndpoint(body.endpoint)) throw new ApiError(400, "push_endpoint_invalid");
  await saveSubscription(user.id, { endpoint: body.endpoint, p256dh: body.keys.p256dh, auth: body.keys.auth });
  return { ok: true };
});
export const DELETE = route(async ({ req, user }) => {
  const body = await parseBody(req, z.object({ endpoint: z.string().url().max(2000) }));
  await removeSubscription(user.id, body.endpoint);
  return { ok: true };
});
