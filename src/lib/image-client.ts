/**
 * Verkleinert ein Foto im Browser (max. 1600 px, JPEG 85 %) und liefert Base64. Berücksichtigt die EXIF-Drehung;
 * das neu erzeugte JPEG enthält keine EXIF-Daten mehr (also auch keinen Aufnahmeort).
 */
export async function downscaleToBase64(file: File, maxSide = 1600): Promise<string> {
  const bmp = await createImageBitmap(file, { imageOrientation: "from-image" });
  const scale = Math.min(1, maxSide / Math.max(bmp.width, bmp.height));
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
