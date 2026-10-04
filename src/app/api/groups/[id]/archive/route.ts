import { z } from "zod";
import { route, parseBody } from "@/server/http";
import { setArchived } from "@/server/services/groups";

/** Gruppe nur für mich archivieren bzw. zurückholen. */
export const POST = route<{ id: string }>(async ({ req, user, params }) => {
  const body = await parseBody(req, z.object({ archived: z.boolean() }));
  await setArchived(user.id, params.id, body.archived);
  return { ok: true };
});
