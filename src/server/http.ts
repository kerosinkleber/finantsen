import { NextResponse } from "next/server";
import { ZodError, type ZodType } from "zod";
import { getCurrentUser, type SessionUser } from "./auth";
import { SplitError } from "@/lib/money";

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message?: string,
    /** Zusätzliche Felder für die JSON-Antwort (z. B. issues, retryAfter) */
    public extra?: Record<string, unknown>,
  ) {
    super(message ?? code);
  }
}

/** ID des echten Admins, wenn er gerade als Testnutzer handelt (für die Nachvollziehbarkeit), sonst null. */
export const actedBy = (user: SessionUser): string | null => (user.impersonating ? user.real.id : null);

export const notFound = () => new ApiError(404, "not_found");
export const forbidden = () => new ApiError(403, "forbidden");

type Ctx<P> = { params: Promise<P> };

/**
 * Wrapper für Route-Handler: Auth, CSRF-Origin-Check, Fehlerabbildung.
 * Fehler werden als { error: code, message?, issues? } mit passendem Status geliefert.
 */
export function route<P = Record<string, string>>(
  handler: (args: { req: Request; user: SessionUser; params: P }) => Promise<Response | object | null>,
  opts: { auth?: boolean; allowMustChange?: boolean; allowTotpSetup?: boolean } = { auth: true },
) {
  return async (req: Request, ctx: Ctx<P>) => {
    try {
      if (!["GET", "HEAD", "OPTIONS"].includes(req.method)) assertSameOrigin(req);
      const current = opts.auth === false ? null : await getCurrentUser();
      if (opts.auth !== false && !current) throw new ApiError(401, "unauthorized");
      const user = current as SessionUser;
      // Wer sein Passwort ändern muss, darf bis dahin nichts anderes tun.
      if (current?.mustChangePassword && !opts.allowMustChange) throw new ApiError(403, "password_change_required");
      // Wer TOTP einrichten muss, darf bis dahin nichts anderes tun.
      if (current?.totpSetupRequired && !opts.allowTotpSetup) throw new ApiError(403, "totp_setup_required");
      const params = (await ctx?.params) as P;
      const result = await handler({ req, user, params });
      if (result instanceof Response) return result;
      return NextResponse.json(result ?? { ok: true });
    } catch (err) {
      return errorResponse(err);
    }
  };
}

export function errorResponse(err: unknown) {
  if (err instanceof ApiError)
    return NextResponse.json(
      { error: err.code, message: err.message, ...err.extra },
      { status: err.status, headers: typeof err.extra?.retryAfter === "number" ? { "Retry-After": String(err.extra.retryAfter) } : undefined },
    );
  if (err instanceof ZodError)
    return NextResponse.json(
      { error: "validation", issues: err.issues.map((i) => ({ path: i.path.join("."), message: i.message })) },
      { status: 400 },
    );
  if (err instanceof SplitError)
    return NextResponse.json({ error: err.code, message: err.message }, { status: 400 });
  console.error("[api] unhandled", err);
  return NextResponse.json({ error: "internal" }, { status: 500 });
}

function assertSameOrigin(req: Request) {
  const origin = req.headers.get("origin");
  if (!origin) return;
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  let originHost: string;
  try {
    originHost = new URL(origin).host;
  } catch {
    throw new ApiError(403, "bad_origin");
  }
  if (originHost !== host) throw new ApiError(403, "bad_origin");
}

export async function parseBody<T>(req: Request, schema: ZodType<T>): Promise<T> {
  let json: unknown;
  try {
    json = await req.json();
  } catch {
    throw new ApiError(400, "invalid_json");
  }
  return schema.parse(json);
}
