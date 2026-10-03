import { route, parseBody, ApiError } from "@/server/http";
import { loginSchema } from "@/lib/schemas";
import { authenticate } from "@/server/services/users";
import { clearRateLimit, createSession, rateLimit } from "@/server/auth";

export const POST = route(
  async ({ req }) => {
    const body = await parseBody(req, loginSchema);
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
    const key = `login:${ip}:${body.email}`;
    if (!rateLimit(key)) throw new ApiError(429, "rate_limited");
    const user = await authenticate(body.email, body.password);
    if (!user) throw new ApiError(401, "invalid_credentials");
    clearRateLimit(key);
    await createSession(user.id);
    return { user: { id: user.id, name: user.name, email: user.email, isAdmin: user.isAdmin } };
  },
  { auth: false },
);
