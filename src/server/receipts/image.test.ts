import { describe, expect, it } from "vitest";
import { cleanBase64, MAX_BASE64, sniffImage } from "./image";

const b64 = (bytes: number[]) => Buffer.from([...bytes, 0, 0, 0, 0, 0, 0, 0, 0]).toString("base64");

describe("receipt image validation", () => {
  it("erkennt JPEG, PNG, WebP anhand der Magic Bytes", () => {
    expect(sniffImage(b64([0xff, 0xd8, 0xff, 0xe0]))).toBe("image/jpeg");
    expect(sniffImage(b64([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))).toBe("image/png");
    expect(sniffImage(b64([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50]))).toBe("image/webp");
  });
  it("lehnt andere Dateien ab (z. B. GIF, HTML, PDF)", () => {
    expect(sniffImage(Buffer.from("GIF89a....").toString("base64"))).toBeNull();
    expect(sniffImage(Buffer.from("<html><script>").toString("base64"))).toBeNull();
    expect(sniffImage(Buffer.from("%PDF-1.7").toString("base64"))).toBeNull();
  });
  it("entfernt data:-Präfix, prüft Zeichensatz und Größe", () => {
    expect(cleanBase64("data:image/png;base64,AAAA")).toEqual({ ok: true, b64: "AAAA" });
    expect(cleanBase64("AA AA\n")).toEqual({ ok: true, b64: "AAAA" });
    expect(cleanBase64("not base64!!")).toEqual({ ok: false, code: "invalid_image" });
    expect(cleanBase64("A".repeat(MAX_BASE64 + 1))).toEqual({ ok: false, code: "image_too_large" });
  });
});
