import { NextResponse } from "next/server";
import { route, parseBody, ApiError } from "@/server/http";
import { loginSchema } from "@/lib/schemas";
import { authenticate } from "@/server/services/accounts";
import { clearRateLimit, createSession, rateLimit } from "@/server/auth";

export const POST = route(
  async ({ req }) => {
    const body = await parseBody(req, loginSchema);
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
    const key = `login:${ip}:${body.identifier.toLowerCase()}`;
    if (!rateLimit(key, 20)) throw new ApiError(429, "rate_limited");
    const res = await authenticate(body.identifier, body.password);
    if (res.kind === "locked") throw new ApiError(429, "account_locked", "account_locked", { retryAfter: res.retryAfter });
    if (res.kind === "invalid") throw new ApiError(401, "invalid_credentials");
    if (res.kind === "blocked") throw new ApiError(403, res.reason === "pending" ? "account_pending" : "account_disabled");
    const user = res.matches.length === 1 ? res.matches[0] : res.matches.find((m) => m.id === body.userId);
    if (!user) {
      // Mehrere Konten mit dieser E-Mail und diesem Passwort (nur wenn der Admin Duplikate erlaubt): Nutzer wählt eines.
      return NextResponse.json(
        {
          error: "choose_account",
          accounts: res.matches.map((m) => ({ id: m.id, name: m.name, username: m.username, createdAt: m.createdAt })),
        },
        { status: 409 },
      );
    }
    clearRateLimit(key);
    await createSession(user.id);
    return { user: { id: user.id, username: user.username, name: user.name, isAdmin: user.isAdmin, mustChangePassword: user.mustChangePassword } };
  },
  { auth: false },
);
