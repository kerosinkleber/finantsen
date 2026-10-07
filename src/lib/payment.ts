/**
 * Bezahlhilfen beim Begleichen (rein, Client und Server): IBAN-Prüfung, GiroCode (EPC-QR, EPC069-12 Version 002)
 * und PayPal.me-Links. Die App bewegt kein Geld, sie füllt nur Überweisungsdaten vor.
 */

/** Leerzeichen raus, groß. */
export const normalizeIban = (s: string) => s.replace(/\s+/g, "").toUpperCase();

/** IBAN-Prüfung: Format (Land, Prüfziffern, 11–30 Zeichen Kontoteil) und Prüfsumme modulo 97. */
export function isValidIban(raw: string): boolean {
  const iban = normalizeIban(raw);
  if (!/^[A-Z]{2}\d{2}[A-Z0-9]{11,30}$/.test(iban)) return false;
  const moved = iban.slice(4) + iban.slice(0, 4);
  let rest = 0;
  for (const ch of moved) {
    const v = ch >= "A" ? String(ch.charCodeAt(0) - 55) : ch;
    for (const d of v) rest = (rest * 10 + Number(d)) % 97;
  }
  return rest === 1;
}

/** In Vierergruppen zur Anzeige. */
export const formatIban = (raw: string) => normalizeIban(raw).replace(/(.{4})(?=.)/g, "$1 ");

/** PayPal.me-Name: nur Buchstaben und Ziffern (PayPal-Vorgabe), 1–30 Zeichen. */
export const isValidPaypalName = (s: string) => /^[A-Za-z0-9]{1,30}$/.test(s);

/** Minor-Units (2 Nachkommastellen) als „23.50“. */
function decimal2(minor: number) {
  return `${Math.floor(minor / 100)}.${String(minor % 100).padStart(2, "0")}`;
}

/** Text ohne Steuerzeichen, gekürzt (EPC erlaubt keine Zeilenumbrüche innerhalb eines Felds). */
const field = (s: string, max: number) => s.replace(/[\r\n\t]+/g, " ").replace(/\s+/g, " ").trim().slice(0, max);

/**
 * GiroCode-Inhalt (EPC-QR). Nur Euro, 0,01 bis 999 999 999,99 €. `null`, wenn etwas nicht passt.
 * Aufbau: BCD, 002, 1 (UTF-8), SCT, BIC (leer erlaubt), Name, IBAN, Betrag, Zweck, Referenz, Verwendungszweck.
 */
export function epcPayload(p: { name: string; iban: string; amountMinor: number; currency: string; text: string; bic?: string }): string | null {
  if (p.currency !== "EUR" || !Number.isInteger(p.amountMinor) || p.amountMinor < 1 || p.amountMinor > 99_999_999_999) return null;
  if (!isValidIban(p.iban)) return null;
  const name = field(p.name, 70);
  if (!name) return null;
  const payload = ["BCD", "002", "1", "SCT", field(p.bic ?? "", 11), name, normalizeIban(p.iban), `EUR${decimal2(p.amountMinor)}`, "", "", field(p.text, 140)].join("\n");
  // Höchstens 331 Bytes laut Standard
  return new TextEncoder().encode(payload).length <= 331 ? payload : null;
}

/**
 * PayPal.me-Link mit Betrag, z. B. https://paypal.me/anna/23.50EUR. Nur Währungen mit 2 Nachkommastellen,
 * sonst ohne Betrag (die Person tippt ihn dann selbst).
 */
export function paypalMeUrl(name: string, amountMinor: number, currency: string, fractionDigits: number): string | null {
  if (!isValidPaypalName(name)) return null;
  const base = `https://paypal.me/${name}`;
  if (fractionDigits !== 2 || amountMinor < 1) return base;
  return `${base}/${decimal2(amountMinor)}${currency}`;
}
