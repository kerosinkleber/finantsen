import { z } from "zod";
import { route, parseBody } from "@/server/http";
import { setOwnPayInfo } from "@/server/services/payinfo";

export const dynamic = "force-dynamic";

/** Eigene Bezahldaten (IBAN mit Kontoinhaber, PayPal.me-Name) setzen; aktuelles Passwort nötig. */
export const PUT = route(async ({ req, user }) => {
  const body = await parseBody(
    req,
    z.object({
      holder: z.string().max(200),
      iban: z.string().max(60),
      paypal: z.string().max(200),
      password: z.string().max(1000),
    }),
  );
  return setOwnPayInfo(user.id, body, body.password);
});
