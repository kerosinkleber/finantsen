"use client";
import { useEffect, useState } from "react";
import QRCode from "qrcode";

/** QR-Code für einen Link (im Browser erzeugt, nichts verlässt das Gerät). Weiß hinterlegt, damit er auch im Dunkelmodus scannbar bleibt. */
export function QrCode({ text, label }: { text: string; label: string }) {
  const [src, setSrc] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    QRCode.toDataURL(text, { margin: 2, width: 240, errorCorrectionLevel: "M" })
      .then((u) => alive && setSrc(u))
      .catch(() => alive && setSrc(null));
    return () => {
      alive = false;
    };
  }, [text]);
  if (!src) return null;
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt={label} width={240} height={240} className="mx-auto rounded-lg bg-white" data-testid="qr" />;
}
