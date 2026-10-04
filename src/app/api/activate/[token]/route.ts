import { route, parseBody, ApiError } from "@/server/http";
import { activateSchema } from "@/lib/schemas";
import { peekLink, redeemLink } from "@/server/services/accounts";
import { createSession, rateLimit } from "@/server/auth";

export const dynamic = "force-dynamic";

/** Prüft einen Einmal-Link (Konto aktivieren oder Passwort neu setzen). */
export const GET = route<{ token: string }>(
  async ({ params }) => {
    const l = await peekLink(params.token);
    if (!l) throw new ApiError(410, "link_invalid");
    return l;
  },
  { auth: false },
);

export const POST = route<{ token: string }>(
  async ({ req, params }) => {
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
    if (!rateLimit(`activate:${ip}`, 30)) throw new ApiError(429, "rate_limited");
    const body = await parseBody(req, activateSchema);
    const user = await redeemLink(params.token, body.password);
    await createSession(user.id);
    return { user: { id: user.id, username: user.username, name: user.name, isAdmin: user.isAdmin } };
  },
  { auth: false },
);
