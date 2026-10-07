import { z } from "zod";
import type { RegistrationResponseJSON } from "@simplewebauthn/server";
import { route, parseBody } from "@/server/http";
import { listPasskeys, registerPasskey, rpFromRequest } from "@/server/services/passkeys";

export const dynamic = "force-dynamic";

// Passkeys zählen als zweiter Faktor, daher darf auch einrichten, wer TOTP-Einrichtung schuldet (allowTotpSetup).
export const GET = route(async ({ user }) => ({ passkeys: await listPasskeys(user.real.id) }), { allowTotpSetup: true });

export const POST = route(
  async ({ req, user }) => {
    const body = await parseBody(req, z.object({ token: z.string().min(10).max(2000), name: z.string().max(100).default(""), response: z.custom<RegistrationResponseJSON>((v) => typeof v === "object" && v !== null) }));
    return registerPasskey(user.real.id, body, rpFromRequest(req));
  },
  { allowTotpSetup: true },
);
