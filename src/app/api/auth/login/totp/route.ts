import { z } from "zod";
import { route, parseBody, ApiError } from "@/server/http";
import { createSession, rateLimit } from "@/server/auth";
import { completeLogin } from "@/server/services/totp";

/** Zweiter Anmeldeschritt: Challenge aus dem Passwortschritt + TOTP- oder Wiederherstellungscode. */
export const POST = route(
  async ({ req }) => {
    const body = await parseBody(req, z.object({ challenge: z.string().min(10).max(1000), code: z.string().trim().min(6).max(20) }));
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
    if (!rateLimit(`login-totp:${ip}`, 30)) throw new ApiError(429, "rate_limited");
    const user = await completeLogin(body.challenge, body.code);
    await createSession(user.id);
    return { user: { id: user.id, username: user.username, name: user.name, isAdmin: user.isAdmin, mustChangePassword: user.mustChangePassword } };
  },
  { auth: false },
);
