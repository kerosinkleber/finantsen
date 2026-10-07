import { route, notFound } from "@/server/http";
import { previewInvite } from "@/server/services/groups";

export const dynamic = "force-dynamic";
export const GET = route<{ code: string }>(
  async ({ params }) => {
    const p = await previewInvite(params.code);
    if (!p) throw notFound();
    return { invite: { kind: p.kind, groupName: p.groupName, inviter: p.inviter } };
  },
  { auth: false },
);
