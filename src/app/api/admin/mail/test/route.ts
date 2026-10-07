import { route, forbidden, ApiError } from "@/server/http";
import { sendTestMail } from "@/server/services/accounts";

export const dynamic = "force-dynamic";

/** Test-E-Mail an die Adresse des angemeldeten Admins. */
export const POST = route(async ({ user }) => {
  if (!user.isAdmin) throw forbidden();
  const to = await sendTestMail(user.id);
  if (!to) throw new ApiError(400, "no_email");
  return { to };
});
