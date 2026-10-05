import jsQR from "jsqr";

/** Liest einen QR-Code aus Bilddaten (RGBA). Rein, ohne DOM: im Browser mit Canvas-Daten, im Test mit erzeugten Daten. */
export function decodeQr(data: Uint8ClampedArray, width: number, height: number): string | null {
  const r = jsQR(data, width, height, { inversionAttempts: "attemptBoth" });
  return r?.data || null;
}
