import { z } from "zod";
import type { AuthenticationResponseJSON } from "@simplewebauthn/server";
import { route, parseBody, ApiError } from "@/server/http";
import { createSession, rateLimit } from "@/server/auth";
import { completePasskeyLogin, rpFromRequest } from "@/server/services/passkeys";

/** Anmeldung mit Passkey: ersetzt Passwort und TOTP (der Passkey ist selbst Besitz + Biometrie/PIN). */
export const POST = route(
  async ({ req }) => {
    const body = await parseBody(req, z.object({ token: z.string().min(10).max(2000), response: z.custom<AuthenticationResponseJSON>((v) => typeof v === "object" && v !== null) }));
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
    if (!rateLimit(`passkey-login:${ip}`, 30)) throw new ApiError(429, "rate_limited");
    const user = await completePasskeyLogin(body.token, body.response, rpFromRequest(req));
    await createSession(user.id);
    return { user: { id: user.id, username: user.username, name: user.name, isAdmin: user.isAdmin, mustChangePassword: user.mustChangePassword } };
  },
  { auth: false },
);
