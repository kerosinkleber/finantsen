import { z } from "zod";
import { route, parseBody } from "@/server/http";
import { previewImport } from "@/server/services/import";

export const dynamic = "force-dynamic";

/** Vorschau eines CSV-Imports (nichts wird gespeichert). */
export const POST = route<{ id: string }>(async ({ req, user, params }) => {
  const body = await parseBody(req, z.object({ text: z.string().max(3_000_000) }));
  return previewImport(user.id, params.id, body.text);
});
