import { route, parseBody } from "@/server/http";
import { testUserCreateSchema } from "@/lib/schemas";
import { createTestUsers, deleteAllTestUsers, listTestUsers } from "@/server/services/testUsers";

export const dynamic = "force-dynamic";
export const GET = route(async ({ user }) => ({ users: await listTestUsers(user) }));
export const POST = route(async ({ req, user }) => {
  const body = await parseBody(req, testUserCreateSchema);
  const created = await createTestUsers(user, body);
  return { users: created.map((u) => ({ id: u.id, name: u.name, username: u.username })) };
});
/** Alle Testnutzer löschen (Aufräumen vor dem echten Betrieb; geht auch bei ausgeschalteten Testfunktionen). */
export const DELETE = route(async ({ user }) => deleteAllTestUsers(user));
