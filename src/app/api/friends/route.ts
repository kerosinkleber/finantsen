import { route } from "@/server/http";
import { env } from "@/server/env";
import { createGroup, createInvite } from "@/server/services/groups";

/** Legt eine Freundschaft (Direktgruppe mit 2 Personen) samt Einladungslink an. */
export const POST = route(async ({ user }) => {
  const g = await createGroup(user.id, { name: "direct", defaultCurrency: "EUR", kind: "direct" });
  const inv = await createInvite(user.id, g.id);
  return { groupId: g.id, code: inv.code, url: `${env.appUrl.replace(/\/$/, "")}/join/${inv.code}` };
});
