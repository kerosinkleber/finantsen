import { describe, expect, it } from "vitest";
import QRCode from "qrcode";
import { appPathFromScan } from "./qr-link";
import { decodeQr } from "./qr-decode";

describe("appPathFromScan", () => {
  it("erkennt Einladungslinks dieser App, auch unter anderer Adresse", () => {
    expect(appPathFromScan("https://splits.example.com/join/AbC_123-xyz")).toBe("/join/AbC_123-xyz");
    expect(appPathFromScan("http://192.168.1.5:3000/join/AbC_123-xyz/")).toBe("/join/AbC_123-xyz");
    expect(appPathFromScan("  /join/AbC_123-xyz ")).toBe("/join/AbC_123-xyz");
  });
  it("öffnet nichts anderes", () => {
    for (const bad of ["https://evil.com/login", "javascript:alert(1)", "https://x.com/join/../admin", "/join/a", "/join/abc/def", "ftp://x/join/abcdefg", "WIFI:S:net;;", ""]) expect(appPathFromScan(bad)).toBeNull();
  });
});

describe("decodeQr", () => {
  it("liest einen erzeugten QR-Code (Ende-zu-Ende ohne Kamera)", () => {
    const text = "https://splits.example.com/join/AbC_123-xyz";
    const qr = QRCode.create(text, { errorCorrectionLevel: "M" });
    const n = qr.modules.size;
    const scale = 6;
    const quiet = 4;
    const size = (n + 2 * quiet) * scale;
    const img = new Uint8ClampedArray(size * size * 4).fill(255);
    for (let y = 0; y < n; y++)
      for (let x = 0; x < n; x++) {
        if (!qr.modules.get(y, x)) continue;
        for (let dy = 0; dy < scale; dy++)
          for (let dx = 0; dx < scale; dx++) {
            const px = ((y + quiet) * scale + dy) * size + (x + quiet) * scale + dx;
            img[px * 4] = img[px * 4 + 1] = img[px * 4 + 2] = 0;
          }
      }
    const decoded = decodeQr(img, size, size);
    expect(decoded).toBe(text);
    expect(appPathFromScan(decoded!)).toBe("/join/AbC_123-xyz");
    expect(decodeQr(new Uint8ClampedArray(40 * 40 * 4).fill(255), 40, 40)).toBeNull();
  });
});
