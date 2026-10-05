import { z } from "zod";
import { route, parseBody } from "@/server/http";
import { runImport } from "@/server/services/import";

export const dynamic = "force-dynamic";

/** CSV-Import ausführen (nur Gruppenbesitzer). `mapping`: Name aus der Datei → Mitglieds-ID oder "new" (neuer Gast). */
export const POST = route<{ id: string }>(async ({ req, user, params }) => {
  const body = await parseBody(req, z.object({ text: z.string().max(3_000_000), mapping: z.record(z.string(), z.string().max(64)) }));
  return runImport(user.id, params.id, body.text, body.mapping);
});
