"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useI18n } from "@/i18n/client";
import { appPathFromScan } from "@/lib/qr-link";
import { useSecureContext } from "@/lib/use-secure";
import { InsecureNote } from "./InsecureNote";

type Detector = { detect(source: CanvasImageSource): Promise<{ rawValue: string }[]> };
declare global {
  interface Window {
    BarcodeDetector?: new (opts: { formats: string[] }) => Detector;
  }
}

/**
 * QR-Code einer Einladung (oder Gast-Verknüpfung) mit der Kamera scannen und öffnen. Nutzt die Barcode-Erkennung
 * des Browsers, wo vorhanden (Chrome/Android), sonst jsQR (z. B. iPhone). Nur Links dieser App werden geöffnet;
 * ohne Kamera kann der Link eingefügt werden.
 */
export function QrScanner() {
  const { t } = useI18n();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<"idle" | "starting" | "scanning" | "no-camera" | "insecure">("idle");
  const secure = useSecureContext();
  const [foreign, setForeign] = useState<string | null>(null);
  const [pasted, setPasted] = useState("");
  const [pasteError, setPasteError] = useState(false);
  const video = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (!open) return;
    let stream: MediaStream | null = null;
    let raf = 0;
    let stopped = false;
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d", { willReadFrequently: true });

    function found(text: string) {
      const path = appPathFromScan(text);
      if (path) {
        stopped = true;
        router.push(path);
      } else setForeign(text.slice(0, 200));
    }

    async function start() {
      // Ohne HTTPS gibt der Browser keine Kamera frei: gleich den Hinweis zeigen, Einfügen geht weiter
      if (!window.isSecureContext) return setStatus("insecure");
      setStatus("starting");
      if (!navigator.mediaDevices?.getUserMedia) return setStatus("no-camera");
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" }, audio: false });
      } catch {
        return setStatus("no-camera");
      }
      if (stopped || !video.current) return;
      video.current.srcObject = stream;
      await video.current.play().catch(() => {});
      setStatus("scanning");
      const detector = window.BarcodeDetector ? new window.BarcodeDetector({ formats: ["qr_code"] }) : null;
      const { decodeQr } = detector ? { decodeQr: null } : await import("@/lib/qr-decode");
      const tick = async () => {
        if (stopped || !video.current) return;
        const v = video.current;
        if (v.readyState >= 2 && v.videoWidth > 0) {
          try {
            if (detector) {
              const codes = await detector.detect(v);
              if (codes[0]?.rawValue) found(codes[0].rawValue);
            } else if (ctx && decodeQr) {
              // Für jsQR verkleinern: schneller und auf Handys ausreichend
              const scale = Math.min(1, 640 / Math.max(v.videoWidth, v.videoHeight));
              canvas.width = Math.round(v.videoWidth * scale);
              canvas.height = Math.round(v.videoHeight * scale);
              ctx.drawImage(v, 0, 0, canvas.width, canvas.height);
              const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
              const text = decodeQr(img.data, img.width, img.height);
              if (text) found(text);
            }
          } catch {
            /* einzelner Frame nicht lesbar: weiter */
          }
        }
        if (!stopped) raf = requestAnimationFrame(() => void tick());
      };
      raf = requestAnimationFrame(() => void tick());
    }
    void start();
    return () => {
      stopped = true;
      cancelAnimationFrame(raf);
      stream?.getTracks().forEach((tr) => tr.stop());
    };
  }, [open, router]);

  function openPasted(e: React.FormEvent) {
    e.preventDefault();
    const path = appPathFromScan(pasted);
    if (path) router.push(path);
    else setPasteError(true);
  }

  if (!open)
    return (
      <>
        <button type="button" className={`btn-secondary ${secure === false ? "opacity-60" : ""}`} onClick={() => { setOpen(true); setForeign(null); }} data-testid="qr-scan-open">
          {t("qrscan.open")}
        </button>
        {secure === false && <InsecureNote k="insecure.camera" />}
      </>
    );

  return (
    <section className="card flex flex-col gap-3" data-testid="qr-scanner">
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-semibold">{t("qrscan.title")}</h2>
        <button type="button" className="btn-secondary !min-h-9 !px-3" onClick={() => setOpen(false)}>{t("common.close")}</button>
      </div>
      {status === "insecure" ? (
        <InsecureNote k="insecure.camera" />
      ) : status !== "no-camera" ? (
        <>
          <video ref={video} className="aspect-square w-full rounded-lg bg-black object-cover" muted playsInline data-testid="qr-video" />
          <p className="muted text-sm">{status === "scanning" ? t("qrscan.hint") : t("qrscan.starting")}</p>
        </>
      ) : (
        <p className="muted text-sm" data-testid="qr-no-camera">{t("qrscan.noCamera")}</p>
      )}
      {foreign && <p className="text-sm text-amber-700 dark:text-amber-400" data-testid="qr-foreign">{t("qrscan.foreign")} <span className="break-all">{foreign}</span></p>}
      <form onSubmit={openPasted} className="flex flex-col gap-2">
        <label className="label" htmlFor="qr-paste">{t("qrscan.paste")}</label>
        <div className="flex gap-2">
          <input id="qr-paste" className="input" value={pasted} onChange={(e) => { setPasted(e.target.value); setPasteError(false); }} placeholder="https://…/join/…" />
          <button className="btn">{t("qrscan.go")}</button>
        </div>
        {pasteError && <p className="text-sm text-red-700 dark:text-red-400" role="alert">{t("qrscan.invalid")}</p>}
      </form>
    </section>
  );
}
