// Erzeugt die PWA-Icons (ohne Abhängigkeiten) als PNG: türkiser Hintergrund, weißes "F" mit Münz-Punkt.
import { deflateSync } from "node:zlib";
import { mkdirSync, writeFileSync } from "node:fs";

function crc32(buf) {
  let c, crc = ~0;
  for (let n = 0; n < buf.length; n++) {
    c = (crc ^ buf[n]) & 0xff;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    crc = (crc >>> 8) ^ c;
  }
  return ~crc >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}
function png(size, { maskable }) {
  const bg = [15, 118, 110];
  const fg = [255, 255, 255];
  const raw = Buffer.alloc((size * 3 + 1) * size);
  const pad = maskable ? 0.2 : 0.12; // maskable: Safe-Zone
  const radius = maskable ? 0 : size * 0.22;
  const inRounded = (x, y) => {
    if (!radius) return true;
    const cx = Math.min(Math.max(x, radius), size - radius);
    const cy = Math.min(Math.max(y, radius), size - radius);
    return (x - cx) ** 2 + (y - cy) ** 2 <= radius ** 2;
  };
  const u = (1 - 2 * pad - 0.1) * size; // Zeichenfläche
  const x0 = (size - u) / 2, y0 = (size - u) / 2;
  const rects = [
    [0.18, 0.0, 0.2, 1.0], // Schaft
    [0.18, 0.0, 0.7, 0.2], // oben
    [0.18, 0.42, 0.55, 0.18], // Mitte
  ];
  const coin = { cx: 0.74, cy: 0.82, r: 0.13 };
  for (let y = 0; y < size; y++) {
    raw[y * (size * 3 + 1)] = 0;
    for (let x = 0; x < size; x++) {
      const nx = (x - x0) / u, ny = (y - y0) / u;
      let on = rects.some(([rx, ry, rw, rh]) => nx >= rx && nx <= rx + rw && ny >= ry && ny <= ry + rh);
      on = on || (nx - coin.cx) ** 2 + (ny - coin.cy) ** 2 <= coin.r ** 2;
      const col = !inRounded(x, y) ? [255, 255, 255] : on ? fg : bg;
      const o = y * (size * 3 + 1) + 1 + x * 3;
      raw[o] = col[0]; raw[o + 1] = col[1]; raw[o + 2] = col[2];
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4); ihdr[8] = 8; ihdr[9] = 2;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk("IHDR", ihdr), chunk("IDAT", deflateSync(raw)), chunk("IEND", Buffer.alloc(0))]);
}

mkdirSync("public/icons", { recursive: true });
writeFileSync("public/icons/icon-192.png", png(192, {}));
writeFileSync("public/icons/icon-512.png", png(512, {}));
writeFileSync("public/icons/maskable-512.png", png(512, { maskable: true }));
writeFileSync("public/icons/apple-touch-icon.png", png(180, { maskable: true }));
console.log("icons written");
