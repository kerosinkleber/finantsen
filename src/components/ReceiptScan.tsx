"use client";
import { useEffect, useRef, useState } from "react";
import { api, ApiClientError } from "@/lib/client-api";
import { useI18n } from "@/i18n/client";
import { ErrorMessage } from "./ErrorMessage";
import { formatMoney } from "@/lib/money";

export type ScanResult = {
  merchant: string | null;
  date: string | null;
  currency: string;
  items: { name: string; amountMinor: number }[];
  taxMinor: number;
  tipMinor: number;
  totalMinor: number | null;
  mismatch: boolean;
  dropped: number;
};

/** Verkleinert das Foto im Browser (max. 1600 px, JPEG) - spart Upload-Zeit und berücksichtigt EXIF-Drehung. */
async function downscale(file: File): Promise<string> {
  const bmp = await createImageBitmap(file, { imageOrientation: "from-image" });
  const scale = Math.min(1, 1600 / Math.max(bmp.width, bmp.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bmp.width * scale);
  canvas.height = Math.round(bmp.height * scale);
  canvas.getContext("2d")!.drawImage(bmp, 0, 0, canvas.width, canvas.height);
  const blob: Blob = await new Promise((res, rej) => canvas.toBlob((b) => (b ? res(b) : rej(new Error("toBlob"))), "image/jpeg", 0.85));
  const buf = new Uint8Array(await blob.arrayBuffer());
  let bin = "";
  for (let i = 0; i < buf.length; i += 0x8000) bin += String.fromCharCode(...buf.subarray(i, i + 0x8000));
  return btoa(bin);
}

/**
 * Foto aufnehmen/hochladen und per Vision-Modell auslesen. Das Ergebnis geht nur über `onResult`
 * zurück ins Formular; gespeichert wird erst, wenn der Nutzer es geprüft und bestätigt hat.
 */
export function ReceiptScan({ fallbackCurrency, onResult }: { fallbackCurrency: string; onResult: (r: ScanResult) => void }) {
  const { t, locale } = useI18n();
  const [enabled, setEnabled] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [info, setInfo] = useState<ScanResult | null>(null);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    api<{ enabled: boolean }>("GET", "/api/receipts/scan").then((r) => setEnabled(r.enabled)).catch(() => setEnabled(false));
  }, []);
  if (!enabled) return null;

  async function pick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setBusy(true);
    setError(null);
    setInfo(null);
    try {
      const image = await downscale(file).catch(() => {
        throw new ApiClientError(400, "invalid_image");
      });
      const { receipt } = await api<{ receipt: ScanResult }>("POST", "/api/receipts/scan", { image, fallbackCurrency });
      setInfo(receipt);
      onResult(receipt);
    } catch (err) {
      setError(err);
    }
    setBusy(false);
  }

  return (
    <div className="card flex flex-col gap-2" data-testid="scan">
      <input ref={input} type="file" accept="image/*" capture="environment" className="hidden" onChange={pick} data-testid="scan-input" />
      <button type="button" className="btn-secondary" disabled={busy} onClick={() => input.current?.click()}>
        {busy ? t("scan.busy") : t("scan.button")}
      </button>
      <p className="muted">{t("scan.privacy")}</p>
      <ErrorMessage error={error} />
      {info && (
        <div className="flex flex-col gap-1 text-sm" data-testid="scan-info">
          {info.merchant && <p>{t("scan.merchant", { name: info.merchant })}</p>}
          <p className="font-medium">{t("scan.hint")}</p>
          {info.mismatch && info.totalMinor !== null && (
            <p className="text-amber-700 dark:text-amber-400">{t("scan.mismatch", { total: formatMoney(info.totalMinor, info.currency, locale) })}</p>
          )}
        </div>
      )}
    </div>
  );
}
