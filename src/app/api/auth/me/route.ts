import { z } from "zod";
import { route, parseBody } from "@/server/http";
import { setEmailPrefs, setLocale } from "@/server/services/accounts";

export const dynamic = "force-dynamic";
export const GET = route(async ({ user }) => ({ user }), { allowMustChange: true, allowTotpSetup: true });
export const PATCH = route(async ({ req, user }) => {
  const body = await parseBody(
    req,
    z.object({ locale: z.enum(["de", "en"]).optional(), emailNotifications: z.boolean().optional(), weeklyDigest: z.boolean().optional() }),
  );
  if (body.locale) await setLocale(user.id, body.locale);
  await setEmailPrefs(user.id, body);
  return { ok: true };
});
