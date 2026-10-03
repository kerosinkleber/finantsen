export const MAX_BASE64 = 8_000_000; // ca. 6 MB Bild

export type ImageType = "image/jpeg" | "image/png" | "image/webp";

/** Erkennt den Bildtyp an den Magic Bytes; der vom Client behauptete Typ wird nicht geglaubt. */
export function sniffImage(b64: string): ImageType | null {
  const head = Buffer.from(b64.slice(0, 32), "base64");
  if (head[0] === 0xff && head[1] === 0xd8 && head[2] === 0xff) return "image/jpeg";
  if (head.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "image/png";
  if (head.subarray(0, 4).toString("ascii") === "RIFF" && head.subarray(8, 12).toString("ascii") === "WEBP") return "image/webp";
  return null;
}

/** Entfernt ein optionales data:-Präfix und prüft Größe und Zeichensatz. Wirft einen Fehlercode-String. */
export function cleanBase64(input: string): { ok: true; b64: string } | { ok: false; code: "image_too_large" | "invalid_image" } {
  const b64 = input.replace(/^data:[^,]*,/, "");
  if (b64.length > MAX_BASE64) return { ok: false, code: "image_too_large" };
  if (!/^[A-Za-z0-9+/=\s]+$/.test(b64)) return { ok: false, code: "invalid_image" };
  return { ok: true, b64: b64.replace(/\s/g, "") };
}
