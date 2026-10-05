import { z } from "zod";
import { route, parseBody } from "@/server/http";
import { setOwnEmail } from "@/server/services/accounts";

export const dynamic = "force-dynamic";

/** Eigene E-Mail-Adresse setzen oder entfernen (leer = entfernen); aktuelles Passwort nötig. */
export const PUT = route(async ({ req, user }) => {
  const body = await parseBody(
    req,
    z.object({ email: z.union([z.literal(""), z.string().trim().toLowerCase().email().max(320)]), password: z.string().max(1000) }),
  );
  await setOwnEmail(user.id, body.email || null, body.password);
  return { ok: true };
});
