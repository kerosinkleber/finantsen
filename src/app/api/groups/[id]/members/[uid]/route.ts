import { route } from "@/server/http";
import { removeMember } from "@/server/services/groups";

export const DELETE = route<{ id: string; uid: string }>(async ({ user, params }) => {
  await removeMember(user.id, params.id, params.uid);
  return { ok: true };
});
