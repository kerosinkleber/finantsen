import { route } from "@/server/http";
import { env } from "@/server/env";
import { createInvite } from "@/server/services/groups";

export const POST = route<{ id: string }>(async ({ user, params }) => {
  const inv = await createInvite(user.id, params.id);
  return { code: inv.code, url: `${env.appUrl.replace(/\/$/, "")}/join/${inv.code}`, expiresAt: inv.expiresAt };
});
