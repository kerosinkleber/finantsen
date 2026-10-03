import { z } from "zod";
import { route, parseBody, ApiError } from "@/server/http";
import { rateLimit } from "@/server/auth";
import { getReceiptScanner } from "@/server/receipts/scanner";
import { normalizeReceipt } from "@/server/receipts/normalize";
import { currencySchema } from "@/lib/schemas";

export const dynamic = "force-dynamic";

const MAX_BASE64 = 8_000_000; // ca. 6 MB Bild

export const GET = route(async () => ({ enabled: getReceiptScanner() !== null }));

/** Magic Bytes prüfen: nur JPEG, PNG, WebP; der vom Client behauptete Typ wird nicht geglaubt. */
function sniff(b64: string): "image/jpeg" | "image/png" | "image/webp" | null {
  const head = Buffer.from(b64.slice(0, 32), "base64");
  if (head[0] === 0xff && head[1] === 0xd8 && head[2] === 0xff) return "image/jpeg";
  if (head.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "image/png";
  if (head.subarray(0, 4).toString("ascii") === "RIFF" && head.subarray(8, 12).toString("ascii") === "WEBP") return "image/webp";
  return null;
}

/**
 * Liest einen Beleg per Vision-Modell. Speichert nichts: Das Ergebnis ist nur ein Vorschlag,
 * den der Nutzer im Formular prüft und korrigiert. Das Bild wird nicht gespeichert.
 */
export const POST = route(async ({ req, user }) => {
  const scanner = getReceiptScanner();
  if (!scanner) throw new ApiError(503, "scan_disabled");
  if (!rateLimit(`scan:${user.id}`, 30, 3600_000)) throw new ApiError(429, "rate_limited");
  const body = await parseBody(req, z.object({ image: z.string().max(MAX_BASE64 + 1000), fallbackCurrency: currencySchema.default("EUR") }));
  const b64 = body.image.replace(/^data:[^,]*,/, "");
  if (b64.length > MAX_BASE64) throw new ApiError(413, "image_too_large");
  if (!/^[A-Za-z0-9+/=\s]+$/.test(b64)) throw new ApiError(400, "invalid_image");
  const mediaType = sniff(b64);
  if (!mediaType) throw new ApiError(400, "invalid_image");
  const raw = await scanner.scan({ mediaType, base64: b64.replace(/\s/g, "") });
  return { receipt: normalizeReceipt(raw, body.fallbackCurrency) };
});
