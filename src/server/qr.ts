import QRCode from "qrcode";

/** QR-Code als SVG-Data-URL (auch für spätere Einladungs-QR-Codes nutzbar). */
export async function qrDataUrl(text: string): Promise<string> {
  const svg = await QRCode.toString(text, { type: "svg", margin: 1, errorCorrectionLevel: "M" });
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
}
