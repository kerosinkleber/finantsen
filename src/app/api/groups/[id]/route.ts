import { route, parseBody } from "@/server/http";
import { groupUpdateSchema } from "@/lib/schemas";
import { deleteGroup, getGroup, updateGroup } from "@/server/services/groups";

type P = { id: string };
export const dynamic = "force-dynamic";
export const GET = route<P>(async ({ user, params }) => ({ group: await getGroup(user.id, params.id) }));
export const PATCH = route<P>(async ({ req, user, params }) => {
  const body = await parseBody(req, groupUpdateSchema);
  return { group: await updateGroup(user.id, params.id, body) };
});
export const DELETE = route<P>(async ({ user, params }) => {
  await deleteGroup(user.id, params.id);
  return { ok: true };
});
