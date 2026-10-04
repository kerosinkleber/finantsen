import { z } from "zod";
import { route, parseBody } from "@/server/http";
import { disableTotp } from "@/server/services/totp";

export const POST = route(async ({ req, user }) => {
  const body = await parseBody(req, z.object({ password: z.string().min(1).max(300), code: z.string().trim().min(6).max(20) }));
  await disableTotp(user.real.id, body.password, body.code);
  return { ok: true };
});
