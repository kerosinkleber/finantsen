import { z } from "zod";
import { route, parseBody } from "@/server/http";
import { addAttachment, listAttachments } from "@/server/services/attachments";

type P = { id: string; eid: string };
export const dynamic = "force-dynamic";

export const GET = route<P>(async ({ user, params }) => ({ attachments: await listAttachments(user.id, params.id, params.eid) }));

/** Belegfoto anhängen (Base64, im Browser verkleinert). */
export const POST = route<P>(async ({ req, user, params }) => {
  const body = await parseBody(req, z.object({ image: z.string().max(8_000_100) }));
  return { attachment: await addAttachment(user.id, params.id, params.eid, body.image) };
});
