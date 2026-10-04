import { route } from "@/server/http";
import { groupCsv } from "@/server/services/export";
import { getLocale } from "@/i18n/server";

export const dynamic = "force-dynamic";

/** CSV-Export einer Gruppe (Trennzeichen und Dezimalkomma nach der angezeigten Sprache). */
export const GET = route<{ id: string }>(async ({ user, params }) => {
  const { csv, filename } = await groupCsv(user.id, params.id, await getLocale());
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
});
