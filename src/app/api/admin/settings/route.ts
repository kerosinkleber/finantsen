import { z } from "zod";
import { route, parseBody, forbidden } from "@/server/http";
import { getAdminSettings, RECOVERY_CODES_MAX, LINK_VALIDITY_MAX, LINK_VALIDITY_MIN, updateAdminSettings } from "@/server/services/settings";

export const dynamic = "force-dynamic";

export const GET = route(async ({ user }) => {
  if (!user.isAdmin) throw forbidden();
  return getAdminSettings();
});

export const PATCH = route(async ({ req, user }) => {
  if (!user.isAdmin) throw forbidden();
  const body = await parseBody(
    req,
    z.object({
      registrationEnabled: z.boolean().optional(),
      allowDuplicateEmails: z.boolean().optional(),
      testFeaturesEnabled: z.boolean().optional(),
      totpRequiredAll: z.boolean().optional(),
      passwordResetEnabled: z.boolean().optional(),
      recoveryCodeCount: z.number().int().min(0).max(RECOVERY_CODES_MAX).optional(),
      linkValidityHours: z.number().int().min(LINK_VALIDITY_MIN).max(LINK_VALIDITY_MAX).optional(),
    }),
  );
  return updateAdminSettings(body);
});
