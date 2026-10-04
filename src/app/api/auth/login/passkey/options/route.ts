import { z } from "zod";
import { route, parseBody, ApiError } from "@/server/http";
import { rateLimit } from "@/server/auth";
import { authenticationOptions, rpFromRequest } from "@/server/services/passkeys";

export const POST = route(
  async ({ req }) => {
    const body = await parseBody(req, z.object({ identifier: z.string().trim().min(1).max(320) }));
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
    if (!rateLimit(`passkey-options:${ip}`, 60)) throw new ApiError(429, "rate_limited");
    return authenticationOptions(body.identifier, rpFromRequest(req));
  },
  { auth: false },
);
