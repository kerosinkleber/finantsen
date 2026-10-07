import { route } from "@/server/http";
import { deleteComment } from "@/server/services/comments";

export const DELETE = route<{ id: string; eid: string; cid: string }>(async ({ user, params }) => {
  await deleteComment(user.id, params.id, params.eid, params.cid);
  return { ok: true };
});
