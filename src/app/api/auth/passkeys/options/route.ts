import { z } from "zod";
import { route, parseBody } from "@/server/http";
import { registrationOptions, rpFromRequest } from "@/server/services/passkeys";

/** Schritt 1 der Einrichtung: erneute Passworteingabe, dann Optionen für den Browser. */
export const POST = route(
  async ({ req, user }) => {
    const body = await parseBody(req, z.object({ password: z.string().min(1).max(300) }));
    return registrationOptions(user.real.id, body.password, rpFromRequest(req));
  },
  { allowTotpSetup: true },
);
