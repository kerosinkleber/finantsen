import { z } from "zod";
import { route, parseBody } from "@/server/http";
import { setLocale } from "@/server/services/users";

export const dynamic = "force-dynamic";
export const GET = route(async ({ user }) => ({ user }));
export const PATCH = route(async ({ req, user }) => {
  const body = await parseBody(req, z.object({ locale: z.enum(["de", "en"]) }));
  await setLocale(user.id, body.locale);
  return { ok: true };
});
