/**
 * Import von Ausgaben aus CSV (rein, ohne DB): Finantsen-Export, Splitwise, Tricount und ein einfaches Format.
 * Ergebnis ist eine einheitliche Liste von Ausgaben (Zahler/Anteile je Name in Minor-Units, Summen exakt) und Zahlungen.
 * Splitwise und Tricount sind nach öffentlich beschriebenen Formaten umgesetzt, nicht mit echten Exportdateien geprüft.
 */
import { allocate } from "./money/split";
import { minorUnits } from "./money/currency";

export type ImportFormat = "finantsen" | "splitwise" | "tricount" | "simple";
export type ImportPart = { name: string; amountMinor: number };
export type ImportEntry =
  | { kind: "expense"; line: number; date: string; title: string; category: string | null; currency: string; amountMinor: number; payers: ImportPart[]; shares: ImportPart[]; isRefund?: boolean; paymentMethod?: string | null }
  | { kind: "payment"; line: number; date: string; title: string; currency: string; amountMinor: number; from: string; to: string };
export type ImportError = { line: number; code: string };
export type ParsedImport = { format: ImportFormat; people: string[]; entries: ImportEntry[]; errors: ImportError[] };

export const IMPORT_MAX_ROWS = 5000;

// ------------------------------------------------------------------ CSV lesen

/** CSV mit Anführungszeichen, BOM, CRLF; Trennzeichen (; , Tab) wird aus der Kopfzeile erkannt. */
export function parseCsv(text: string): string[][] {
  const src = text.replace(/^﻿/, "");
  const firstLine = src.split(/\r?\n/, 1)[0] ?? "";
  const counts = [";", ",", "\t"].map((c) => [c, firstLine.split(c).length] as const);
  const sep = counts.sort((a, b) => b[1] - a[1])[0][0];
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (quoted) {
      if (ch === '"' && src[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"' && cell === "") quoted = true;
    else if (ch === sep) {
      row.push(cell);
      cell = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && src[i + 1] === "\n") i++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else cell += ch;
  }
  if (cell !== "" || row.length) {
    row.push(cell);
    rows.push(row);
  }
  // Schutz-Hochkomma gegen CSV-Injection (unser Export) entfernen, leere Zeilen weg
  return rows.map((r) => r.map((c) => c.trim().replace(/^'(?=[=+\-@])/, ""))).filter((r) => r.some((c) => c !== ""));
}

// ------------------------------------------------------------------ Werte

/** Betrag „1.234,56“ / „1,234.56“ / „-12.5“ in Minor-Units (Trennzeichen-Heuristik wie in parseAmount). */
export function parseDecimal(raw: string, currency: string): number | null {
  let s = raw.replace(/[\s '’]/g, "").replace(/[€$£¥]/g, "");
  if (s === "") return 0;
  let neg = false;
  if (/^[-−]/.test(s)) {
    neg = true;
    s = s.slice(1);
  } else if (s.startsWith("+")) s = s.slice(1);
  if (!/^[\d.,]+$/.test(s)) return null;
  const lastDot = s.lastIndexOf(".");
  const lastComma = s.lastIndexOf(",");
  let int = s;
  let frac = "";
  const sepIdx = Math.max(lastDot, lastComma);
  if (sepIdx >= 0) {
    const sepChar = s[sepIdx];
    const mixed = lastDot >= 0 && lastComma >= 0;
    const after = s.length - sepIdx - 1;
    // Ein einzelnes Trennzeichen mit genau 3 Ziffern danach ist ein Tausendertrenner („1.234“), außer bei mehreren gemischten
    if (!mixed && s.split(sepChar).length - 1 === 1 && after !== 3) {
      int = s.slice(0, sepIdx);
      frac = s.slice(sepIdx + 1);
    } else if (mixed) {
      int = s.slice(0, sepIdx).replace(/[.,]/g, "");
      frac = s.slice(sepIdx + 1);
    } else int = s.replace(/[.,]/g, "");
  }
  const digits = minorUnits(currency);
  if (frac.length > digits) {
    // mehr Nachkommastellen als die Währung hat: nur zulassen, wenn der Rest null ist
    if (/[1-9]/.test(frac.slice(digits))) return null;
    frac = frac.slice(0, digits);
  }
  const n = Number((int || "0") + frac.padEnd(digits, "0"));
  if (!Number.isSafeInteger(n)) return null;
  return neg ? -n : n;
}

/** Datum „2024-01-15“, „2024-01-15 13:45“, „15.01.2024“, „15/01/2024“ → ISO-Datum. */
export function parseDate(raw: string): string | null {
  const s = raw.trim();
  let m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  if (m) return valid(m[1], m[2], m[3]);
  m = /^(\d{1,2})[./](\d{1,2})[./](\d{4})/.exec(s);
  if (m) return valid(m[3], m[2].padStart(2, "0"), m[1].padStart(2, "0"));
  return null;
  function valid(y: string, mo: string, d: string) {
    const iso = `${y}-${mo}-${d}`;
    const dt = new Date(`${iso}T00:00:00Z`);
    return !Number.isNaN(+dt) && dt.toISOString().slice(0, 10) === iso ? iso : null;
  }
}

const cleanName = (s: string) => s.replace(/\s+/g, " ").trim().slice(0, 100);
const norm = (s: string) => s.trim().toLowerCase();

// ------------------------------------------------------------------ Formate

export function detectFormat(header: string[]): ImportFormat | null {
  const h = header.map(norm);
  if (h.some((c) => /^(paid by|bezahlt von) .+/.test(c)) && h.some((c) => /^(paid for|bezahlt für) .+/.test(c))) return "tricount";
  if ((h[0] === "art" || h[0] === "type") && h.some((c) => / (bezahlt|paid)$/.test(c)) && h.some((c) => / (anteil|share)$/.test(c))) return "finantsen";
  if (h[0] === "date" && h[1] === "description" && h[2] === "category" && h[3] === "cost" && h[4] === "currency") return "splitwise";
  if (["date", "title", "amount", "currency", "paid_by", "split_between"].every((k) => h.includes(k))) return "simple";
  return null;
}

/**
 * Splitwise kennt je Person nur den Netto-Effekt (bezahlt − Anteil). Daraus werden eindeutige, exakte Zahler und
 * Anteile gebaut: Anteile der Netto-Negativen = −Netto; der Rest des Betrags wird auf die Netto-Positiven nach
 * ihrem Netto verteilt (größter Rest), deren Zahlung = Netto + Anteil. Salden bleiben dadurch exakt gleich.
 */
export function fromNets(total: number, nets: { name: string; net: number }[]): { payers: ImportPart[]; shares: ImportPart[] } | null {
  if (nets.reduce((a, n) => a + n.net, 0) !== 0) return null;
  const pos = nets.filter((n) => n.net > 0);
  const negSum = nets.filter((n) => n.net < 0).reduce((a, n) => a - n.net, 0);
  const rest = total - negSum;
  if (rest < 0 || pos.length === 0) return null;
  const restParts = allocate(rest, pos.map((p) => p.net));
  const shares: ImportPart[] = [
    ...nets.filter((n) => n.net < 0).map((n) => ({ name: n.name, amountMinor: -n.net })),
    ...pos.map((p, i) => ({ name: p.name, amountMinor: restParts[i] })),
  ].filter((s) => s.amountMinor > 0);
  const payers = pos.map((p, i) => ({ name: p.name, amountMinor: p.net + restParts[i] }));
  return { payers, shares };
}

export function parseImport(text: string): ParsedImport | { error: "unknown_format" | "too_many_rows" | "empty" } {
  const rows = parseCsv(text);
  if (rows.length < 2) return { error: "empty" };
  if (rows.length - 1 > IMPORT_MAX_ROWS) return { error: "too_many_rows" };
  const header = rows[0];
  const format = detectFormat(header);
  if (!format) return { error: "unknown_format" };
  const h = header.map(norm);
  const col = (...names: string[]) => h.findIndex((c) => names.includes(c));
  const entries: ImportEntry[] = [];
  const errors: ImportError[] = [];
  const people = new Set<string>();
  const sumOf = (l: ImportPart[]) => l.reduce((a, p) => a + p.amountMinor, 0);
  const addExpense = (e: Extract<ImportEntry, { kind: "expense" }>) => {
    e.payers = e.payers.filter((p) => p.amountMinor !== 0);
    e.shares = e.shares.filter((p) => p.amountMinor !== 0);
    if (e.amountMinor <= 0 || [...e.payers, ...e.shares].some((p) => p.amountMinor < 0)) return errors.push({ line: e.line, code: "invalid_amount" });
    if (!e.payers.length || !e.shares.length) return errors.push({ line: e.line, code: "no_participants" });
    if (sumOf(e.payers) !== e.amountMinor || sumOf(e.shares) !== e.amountMinor) return errors.push({ line: e.line, code: "sum_mismatch" });
    [...e.payers, ...e.shares].forEach((p) => people.add(p.name));
    entries.push(e);
  };
  const addPayment = (p: Extract<ImportEntry, { kind: "payment" }>) => {
    if (p.amountMinor <= 0 || !p.from || !p.to || p.from === p.to) return errors.push({ line: p.line, code: "invalid_payment" });
    people.add(p.from);
    people.add(p.to);
    entries.push(p);
  };

  rows.slice(1).forEach((r, idx) => {
    const line = idx + 2;
    const cell = (i: number) => (i >= 0 ? (r[i] ?? "") : "");
    if (format === "splitwise") {
      // Splitwise: Date, Description, Category, Cost, Currency, <Person>…; letzte Zeile „Total balance“
      if (norm(cell(1)) === "total balance" || cell(0) === "") return;
      const currency = cell(4).toUpperCase();
      const date = parseDate(cell(0));
      const total = parseDecimal(cell(3), currency);
      if (!date || !/^[A-Z]{3}$/.test(currency) || total === null) return errors.push({ line, code: "invalid_row" });
      const nets = header.slice(5).map((name, i) => ({ name: cleanName(name), net: parseDecimal(cell(5 + i), currency) }));
      if (nets.some((n) => n.net === null)) return errors.push({ line, code: "invalid_amount" });
      const ns = nets.filter((n) => n.net !== 0) as { name: string; net: number }[];
      if (norm(cell(2)) === "payment") {
        const from = ns.find((n) => n.net > 0);
        const to = ns.find((n) => n.net < 0);
        return addPayment({ kind: "payment", line, date, title: cell(1), currency, amountMinor: total, from: from?.name ?? "", to: to?.name ?? "" });
      }
      const parts = fromNets(total, ns);
      if (!parts) return errors.push({ line, code: "sum_mismatch" });
      return addExpense({ kind: "expense", line, date, title: cell(1), category: cell(2) || null, currency, amountMinor: total, ...parts });
    }
    if (format === "tricount") {
      const iDate = col("date", "datum", "date & time", "datum & uhrzeit");
      const iTitle = col("title", "titel", "description", "beschreibung");
      const iCur = col("currency", "währung");
      const iAmount = col("amount", "betrag");
      const iType = col("transaction type", "type", "typ", "art");
      const currency = (cell(iCur) || "EUR").toUpperCase();
      const date = parseDate(cell(iDate));
      const total = parseDecimal(cell(iAmount), currency);
      if (!date || !/^[A-Z]{3}$/.test(currency) || total === null) return errors.push({ line, code: "invalid_row" });
      const payers: ImportPart[] = [];
      const shares: ImportPart[] = [];
      let bad = false;
      h.forEach((c, i) => {
        const by = /^(?:paid by|bezahlt von) (.+)$/.exec(c);
        const fo = /^(?:paid for|bezahlt für) (.+)$/.exec(c);
        if (!by && !fo) return;
        const v = parseDecimal(cell(i), currency);
        if (v === null) bad = true;
        const name = cleanName(header[i].replace(/^(paid by|bezahlt von|paid for|bezahlt für)\s+/i, ""));
        (by ? payers : shares).push({ name, amountMinor: Math.abs(v ?? 0) });
      });
      if (bad) return errors.push({ line, code: "invalid_amount" });
      const amount = Math.abs(total);
      if (/transfer|überweisung|money transfer|ausgleich/.test(norm(cell(iType)))) {
        const from = payers.find((p) => p.amountMinor > 0)?.name ?? "";
        const to = shares.find((p) => p.amountMinor > 0)?.name ?? "";
        return addPayment({ kind: "payment", line, date, title: cell(iTitle), currency, amountMinor: amount, from, to });
      }
      return addExpense({ kind: "expense", line, date, title: cell(iTitle), category: null, currency, amountMinor: amount, payers, shares });
    }
    if (format === "finantsen") {
      // Unser eigener Export (de oder en): Art, Datum, Titel, Kategorie, Betrag, Währung, Betrag (Abrechnung), Abrechnungswährung, je Person „bezahlt“/„Anteil“
      const kind = norm(cell(0));
      if (kind === "saldo" || kind === "balance") return;
      const refund = kind === "rückerstattung" || kind === "refund";
      const sign = refund ? -1 : 1;
      const currency = cell(7).toUpperCase();
      const date = parseDate(cell(1));
      const rawTotal = parseDecimal(cell(6), currency);
      const total = rawTotal === null ? null : sign * rawTotal;
      if (!date || !/^[A-Z]{3}$/.test(currency) || total === null) return errors.push({ line, code: "invalid_row" });
      const payers: ImportPart[] = [];
      const shares: ImportPart[] = [];
      let bad = false;
      header.forEach((c, i) => {
        const m = /^(.+) (bezahlt|paid|anteil|share)$/i.exec(c.trim());
        if (!m || i < 8 || /^(zahlungsart|payment method)$/i.test(c.trim())) return;
        const v = parseDecimal(cell(i), currency);
        if (v === null) bad = true;
        const name = cleanName(m[1].replace(/ \((Test|Gast|Guest)\)$/, ""));
        (/^(bezahlt|paid)$/i.test(m[2]) ? payers : shares).push({ name, amountMinor: sign * (v ?? 0) });
      });
      if (bad) return errors.push({ line, code: "invalid_amount" });
      if (kind === "zahlung" || kind === "payment") {
        return addPayment({ kind: "payment", line, date, title: cell(2), currency, amountMinor: total, from: payers.find((p) => p.amountMinor > 0)?.name ?? "", to: shares.find((p) => p.amountMinor > 0)?.name ?? "" });
      }
      return addExpense({ kind: "expense", line, date, title: cell(2), category: cell(3) || null, currency, amountMinor: total, payers, shares, isRefund: refund || undefined, paymentMethod: cell(col("zahlungsart", "payment method")) || null });
    }
    // Einfaches Format: date, title, amount, currency, paid_by, split_between (Namen mit | getrennt), optional category
    const currency = cell(col("currency")).toUpperCase();
    const date = parseDate(cell(col("date")));
    const total = parseDecimal(cell(col("amount")), currency);
    const payer = cleanName(cell(col("paid_by")));
    const between = cell(col("split_between")).split("|").map(cleanName).filter(Boolean);
    if (!date || !/^[A-Z]{3}$/.test(currency) || total === null || !payer || !between.length) return errors.push({ line, code: "invalid_row" });
    const uniq = [...new Set(between)];
    const parts = allocate(total, uniq.map(() => 1));
    return addExpense({
      kind: "expense", line, date, title: cell(col("title")), category: cell(col("category")) || null, currency, amountMinor: total,
      payers: [{ name: payer, amountMinor: total }], shares: uniq.map((name, i) => ({ name, amountMinor: parts[i] })),
    });
  });
  return { format, people: [...people].sort((a, b) => a.localeCompare(b)), entries, errors };
}
