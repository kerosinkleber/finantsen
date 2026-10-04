import { NextResponse } from "next/server";
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
    const matches = await authenticate(body.email, body.password);
    if (matches.length === 0) throw new ApiError(401, "invalid_credentials");
    const user = matches.length === 1 ? matches[0] : matches.find((m) => m.id === body.userId);
    if (!user) {
      // Mehrere Konten mit dieser E-Mail und diesem Passwort: Nutzer wählt eines (Passwort wurde bereits geprüft).
      return NextResponse.json(
        { error: "choose_account", accounts: matches.map((m) => ({ id: m.id, name: m.name, createdAt: m.createdAt })) },
        { status: 409 },
      );
    }
    clearRateLimit(key);
    await createSession(user.id);
    return { user: { id: user.id, name: user.name, email: user.email, isAdmin: user.isAdmin } };
  },
  { auth: false },
);
