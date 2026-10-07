import { route } from "@/server/http";
import { deleteAttachment, getAttachment } from "@/server/services/attachments";

type P = { id: string; eid: string; aid: string };
export const dynamic = "force-dynamic";

/** Foto ausliefern: nur für Mitglieder, nicht in geteilten Caches, Typ nie raten lassen. */
export const GET = route<P>(async ({ user, params }) => {
  const a = await getAttachment(user.id, params.id, params.eid, params.aid);
  return new Response(new Uint8Array(a.data), {
    headers: {
      "Content-Type": a.mime,
      "Cache-Control": "private, max-age=3600",
      "X-Content-Type-Options": "nosniff",
      "Content-Disposition": "inline",
      "Content-Security-Policy": "default-src 'none'; sandbox",
    },
  });
});

export const DELETE = route<P>(async ({ user, params }) => {
  await deleteAttachment(user.id, params.id, params.eid, params.aid);
  return { ok: true };
});
