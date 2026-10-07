import { z } from "zod";
import { route, parseBody, ApiError } from "@/server/http";
import { rateLimit } from "@/server/auth";
import { requestPasswordReset } from "@/server/services/accounts";

/**
 * „Passwort vergessen“: antwortet immer gleich (verrät nicht, ob es das Konto gibt). Begrenzt pro IP (10/Stunde)
 * und pro Konto (3/Stunde, darüber wird still nichts verschickt).
 */
export const POST = route(
  async ({ req }) => {
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
    if (!rateLimit(`forgot:${ip}`, 10, 3600_000)) throw new ApiError(429, "rate_limited");
    const body = await parseBody(req, z.object({ identifier: z.string().max(320) }));
    await requestPasswordReset(body.identifier, (userId) => rateLimit(`forgot-account:${userId}`, 3, 3600_000));
    return { ok: true };
  },
  { auth: false },
);
