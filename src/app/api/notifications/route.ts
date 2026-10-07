import { z } from "zod";
import { route, parseBody } from "@/server/http";
import { listNotifications, markRead, unreadCount } from "@/server/services/notifications";

export const dynamic = "force-dynamic";
export const GET = route(async ({ user }) => ({
  notifications: await listNotifications(user.id),
  unread: await unreadCount(user.id),
}));
/** Markiert Benachrichtigungen als gelesen (ohne ids: alle). */
export const POST = route(async ({ req, user }) => {
  const body = await parseBody(req, z.object({ ids: z.array(z.string().uuid()).max(200).optional() }));
  await markRead(user.id, body.ids);
  return { ok: true };
});
