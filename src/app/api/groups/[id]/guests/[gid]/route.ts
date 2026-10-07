import { z } from "zod";
import { route, parseBody } from "@/server/http";
import { deleteGuest, renameGuest } from "@/server/services/guests";

type P = { id: string; gid: string };
export const PATCH = route<P>(async ({ req, user, params }) => {
  const body = await parseBody(req, z.object({ name: z.string().trim().min(1).max(100) }));
  await renameGuest(user.id, params.id, params.gid, body.name);
  return { ok: true };
});
export const DELETE = route<P>(async ({ user, params }) => {
  await deleteGuest(user.id, params.id, params.gid);
  return { ok: true };
});
