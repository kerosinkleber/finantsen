import { route, parseBody, ApiError } from "@/server/http";
import { registerSchema } from "@/lib/schemas";
import { registerUser } from "@/server/services/users";
import { createSession, rateLimit } from "@/server/auth";

export const POST = route(
  async ({ req }) => {
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
    if (!rateLimit(`reg:${ip}`, 20)) throw new ApiError(429, "rate_limited");
    const body = await parseBody(req, registerSchema);
    const user = await registerUser(body);
    await createSession(user.id);
    return { user: { id: user.id, name: user.name, email: user.email, isAdmin: user.isAdmin }, joinedGroupId: user.joinedGroupId };
  },
  { auth: false },
);
