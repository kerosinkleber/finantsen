import { route, parseBody, ApiError } from "@/server/http";
import { registerSchema } from "@/lib/schemas";
import { registerSelf } from "@/server/services/accounts";
import { rateLimit } from "@/server/auth";

/** Selbstregistrierung (nur wenn vom Admin aktiviert). Das Konto bleibt gesperrt, bis der Admin es freigibt. */
export const POST = route(
  async ({ req }) => {
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
    if (!rateLimit(`reg:${ip}`, 10)) throw new ApiError(429, "rate_limited");
    const body = await parseBody(req, registerSchema);
    await registerSelf(body);
    return Response.json({ status: "pending" }, { status: 202 });
  },
  { auth: false },
);
