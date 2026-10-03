import { z } from "zod";
import { route, parseBody, ApiError } from "@/server/http";
import { rateLimit } from "@/server/auth";
import { getReceiptScanner } from "@/server/receipts/scanner";
import { normalizeReceipt } from "@/server/receipts/normalize";
import { currencySchema } from "@/lib/schemas";
import { cleanBase64, MAX_BASE64, sniffImage } from "@/server/receipts/image";

export const dynamic = "force-dynamic";

export const GET = route(async () => ({ enabled: getReceiptScanner() !== null }));

/**
 * Liest einen Beleg per Vision-Modell. Speichert nichts: Das Ergebnis ist nur ein Vorschlag,
 * den der Nutzer im Formular prüft und korrigiert. Das Bild wird nicht gespeichert.
 */
export const POST = route(async ({ req, user }) => {
  const scanner = getReceiptScanner();
  if (!scanner) throw new ApiError(503, "scan_disabled");
  if (!rateLimit(`scan:${user.id}`, 30, 3600_000)) throw new ApiError(429, "rate_limited");
  const body = await parseBody(req, z.object({ image: z.string().max(MAX_BASE64 + 1000), fallbackCurrency: currencySchema.default("EUR") }));
  const cleaned = cleanBase64(body.image);
  if (!cleaned.ok) throw new ApiError(cleaned.code === "image_too_large" ? 413 : 400, cleaned.code);
  const mediaType = sniffImage(cleaned.b64);
  if (!mediaType) throw new ApiError(400, "invalid_image");
  const raw = await scanner.scan({ mediaType, base64: cleaned.b64 });
  return { receipt: normalizeReceipt(raw, body.fallbackCurrency) };
});
