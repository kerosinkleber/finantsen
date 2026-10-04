import { z } from "zod";
import { route, parseBody, forbidden } from "@/server/http";
import { getAdminSettings, updateAdminSettings } from "@/server/services/settings";

export const dynamic = "force-dynamic";

export const GET = route(async ({ user }) => {
  if (!user.isAdmin) throw forbidden();
  return getAdminSettings();
});

export const PATCH = route(async ({ req, user }) => {
  if (!user.isAdmin) throw forbidden();
  const body = await parseBody(req, z.object({ allowDuplicateEmails: z.boolean().optional() }));
  return updateAdminSettings(body);
});
