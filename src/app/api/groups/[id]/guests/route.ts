import { z } from "zod";
import { route, parseBody } from "@/server/http";
import { addGuest } from "@/server/services/guests";

/** Mitglied ohne Konto anlegen. */
export const POST = route<{ id: string }>(async ({ req, user, params }) => {
  const body = await parseBody(req, z.object({ name: z.string().trim().min(1).max(100) }));
  return { guest: await addGuest(user.id, params.id, body.name) };
});
