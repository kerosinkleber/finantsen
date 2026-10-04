import { route } from "@/server/http";
import { accountExport } from "@/server/services/export";

export const dynamic = "force-dynamic";

/** Alle eigenen Daten als JSON-Datei. Beim „Handeln als“ die Daten des Testnutzers. */
export const GET = route(async ({ user }) => {
  const data = await accountExport(user.id);
  return new Response(JSON.stringify(data, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="finantsen-${user.username.replace(/[^a-z0-9._-]/g, "_")}-${new Date().toISOString().slice(0, 10)}.json"`,
      "Cache-Control": "no-store",
    },
  });
});
