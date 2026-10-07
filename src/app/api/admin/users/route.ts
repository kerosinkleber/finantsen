import { route, parseBody } from "@/server/http";
import { adminCreateUserSchema } from "@/lib/schemas";
import { createUserByAdmin, listUsers } from "@/server/services/accounts";

export const dynamic = "force-dynamic";
export const GET = route(async ({ user }) => ({ users: await listUsers(user) }));
export const POST = route(async ({ req, user }) => {
  const body = await parseBody(req, adminCreateUserSchema);
  return createUserByAdmin(user, body);
});
