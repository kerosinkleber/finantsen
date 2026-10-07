import { route, parseBody } from "@/server/http";
import { testUserUpdateSchema } from "@/lib/schemas";
import { deleteTestUser, getTestUserDetail, updateTestUser } from "@/server/services/testUsers";

type P = { id: string };
export const dynamic = "force-dynamic";
export const GET = route<P>(async ({ user, params }) => getTestUserDetail(user, params.id));
export const PATCH = route<P>(async ({ req, user, params }) => {
  const u = await updateTestUser(user, params.id, await parseBody(req, testUserUpdateSchema));
  return { user: { id: u.id, name: u.name, username: u.username, locale: u.locale } };
});
export const DELETE = route<P>(async ({ user, params }) => deleteTestUser(user, params.id));
