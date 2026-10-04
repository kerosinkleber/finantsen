import { route, parseBody, ApiError } from "@/server/http";
import { setupSchema } from "@/lib/schemas";
import { needsSetup, setupAdmin } from "@/server/services/accounts";
import { createSession, rateLimit } from "@/server/auth";

export const dynamic = "force-dynamic";

export const GET = route(async () => ({ needsSetup: await needsSetup() }), { auth: false });

/** Richtet den ersten Admin ein (nur solange es noch kein Konto gibt) und meldet ihn an. */
export const POST = route(
  async ({ req }) => {
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
    if (!rateLimit(`setup:${ip}`, 20)) throw new ApiError(429, "rate_limited");
    const body = await parseBody(req, setupSchema);
    const user = await setupAdmin(body);
    await createSession(user.id);
    return { user: { id: user.id, username: user.username, name: user.name, isAdmin: true } };
  },
  { auth: false },
);
