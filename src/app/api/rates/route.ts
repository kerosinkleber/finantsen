import { z } from "zod";
import { route, ApiError } from "@/server/http";
import { getRate } from "@/server/rates";
import { currencySchema } from "@/lib/schemas";
import { invertRate } from "@/lib/money";

export const dynamic = "force-dynamic";

const q = z.object({ from: currencySchema, to: currencySchema, date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) });

/** Vorschau des Kurses (1 from = rate to) zum Buchungsdatum, z. B. für das Ausgabenformular. */
export const GET = route(async ({ req }) => {
  const parsed = q.safeParse(Object.fromEntries(new URL(req.url).searchParams));
  if (!parsed.success) throw new ApiError(400, "validation");
  const r = await getRate(parsed.data.from, parsed.data.to, parsed.data.date);
  return { ...r, inverse: invertRate(r.rate) };
});
