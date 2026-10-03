import { z } from "zod";
import { route, parseBody } from "@/server/http";
import { addComment, listComments } from "@/server/services/comments";

type P = { id: string; eid: string };
export const dynamic = "force-dynamic";
export const GET = route<P>(async ({ user, params }) => ({ comments: await listComments(user.id, params.id, params.eid) }));
export const POST = route<P>(async ({ req, user, params }) => {
  const { body } = await parseBody(req, z.object({ body: z.string().trim().min(1).max(2000) }));
  return { comment: await addComment(user.id, params.id, params.eid, body) };
});
