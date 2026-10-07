/**
 * CSV-Bausteine (rein). Zellen werden bei Bedarf in Anführungszeichen gesetzt; Werte, die mit = + - @ beginnen,
 * bekommen ein vorangestelltes Hochkomma, damit Tabellenprogramme sie nicht als Formel ausführen (CSV-Injection).
 * Reine Zahlen (auch negative Beträge) bleiben unverändert.
 */
export function csvCell(v: string | number | null | undefined, sep: string): string {
  let s = v === null || v === undefined ? "" : String(v);
  if (typeof v !== "number" && /^[=+\-@\t\r]/.test(s) && !/^-?\d+([.,]\d+)?$/.test(s)) s = "'" + s;
  return s.includes(sep) || /["\r\n]/.test(s) ? `"${s.replaceAll('"', '""')}"` : s;
}

/** Baut eine CSV-Datei (mit BOM, damit Excel UTF-8 erkennt; Zeilenende CRLF). */
export function toCsv(rows: (string | number | null | undefined)[][], sep: ";" | ","): string {
  return "﻿" + rows.map((r) => r.map((c) => csvCell(c, sep)).join(sep)).join("\r\n") + "\r\n";
}

/** Betrag in Minor-Units als Dezimalzahl mit dem Dezimaltrennzeichen der Sprache (de: Komma). */
export function decimal(minor: number, digits: number, sep: ";" | ","): string {
  const neg = minor < 0;
  const abs = Math.abs(minor).toString().padStart(digits + 1, "0");
  const int = abs.slice(0, abs.length - digits);
  const frac = digits ? (sep === ";" ? "," : ".") + abs.slice(abs.length - digits) : "";
  return (neg ? "-" : "") + int + frac;
}
