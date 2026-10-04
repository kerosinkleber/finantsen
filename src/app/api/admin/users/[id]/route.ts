import { route, parseBody } from "@/server/http";
import { adminUserActionSchema } from "@/lib/schemas";
import { adminAction } from "@/server/services/accounts";

/** Admin-Aktionen auf einem Konto: freigeben, deaktivieren, Admin-Recht, Passwort setzen, Einmal-Link. */
export const POST = route<{ id: string }>(async ({ req, user, params }) => {
  const body = await parseBody(req, adminUserActionSchema);
  return adminAction(user, params.id, body);
});
