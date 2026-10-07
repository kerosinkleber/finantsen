import { route, parseBody } from "@/server/http";
import { groupCreateSchema } from "@/lib/schemas";
import { createGroup, listGroups } from "@/server/services/groups";

export const dynamic = "force-dynamic";
export const GET = route(async ({ user }) => ({ groups: await listGroups(user.id) }));
export const POST = route(async ({ req, user }) => {
  const body = await parseBody(req, groupCreateSchema);
  return { group: await createGroup(user.id, body) };
});
