import { z } from "zod";
import { route, parseBody } from "@/server/http";
import { regenerateRecoveryCodes } from "@/server/services/totp";

/** Neue Wiederherstellungscodes erzeugen (die alten werden ungültig). */
export const POST = route(async ({ req, user }) => {
  const body = await parseBody(req, z.object({ password: z.string().min(1).max(300) }));
  return regenerateRecoveryCodes(user.real.id, body.password);
});
