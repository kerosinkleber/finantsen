import { createHash } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { getDb } from "../db";
import { imports } from "../schema";
import { ApiError } from "../http";
import { requireMember } from "./access";
import { createExpense } from "./expenses";
import { createPayment } from "./payments";
import { addGuest } from "./guests";
import { listGroups } from "./groups";
import { parseImport, type ImportEntry, type ParsedImport } from "@/lib/import";
import { CATEGORIES, type Category } from "@/lib/categories";
import { translate } from "@/i18n";

export const IMPORT_MAX_BYTES = 2_000_000;

/** Import nur durch den Besitzer der Gruppe (legt viele Einträge auf einmal an). */
async function requireOwner(userId: string, groupId: string) {
  const m = await requireMember(userId, groupId);
  if (m.role !== "owner") throw new ApiError(403, "owner_only");
  return m;
}

function parseOrThrow(text: string): ParsedImport {
  if (new TextEncoder().encode(text).length > IMPORT_MAX_BYTES) throw new ApiError(413, "file_too_large");
  const r = parseImport(text);
  if ("error" in r) throw new ApiError(400, `import_${r.error}`);
  return r;
}

/** Fingerabdruck der eingelesenen Einträge (gleiche Datei = gleicher Hash, unabhängig von Zeilenenden/BOM). */
function fingerprint(p: ParsedImport) {
  return createHash("sha256").update(JSON.stringify(p.entries.map((e) => ({ ...e, line: 0 })))).digest("hex");
}

/** Kategorie aus Schlüssel oder Bezeichnung (de/en); sonst „other“. */
export function matchCategory(raw: string | null): Category {
  const s = (raw ?? "").trim().toLowerCase();
  if (!s) return "other";
  for (const c of CATEGORIES) {
    if (c === s || translate("de", `cat.${c}` as never).toLowerCase() === s || translate("en", `cat.${c}` as never).toLowerCase() === s) return c;
  }
  const hints: [RegExp, Category][] = [
    [/grocer|lebensmittel|supermarkt/, "groceries"],
    [/dining|restaurant|food|essen|bar|café|cafe/, "restaurant"],
    [/taxi|fuel|gas|bus|train|parking|transport|benzin|bahn|car/, "transport"],
    [/rent|miete|mortgage|household|haushalt/, "housing"],
    [/electric|heat|water|internet|phone|strom|utilities|tv/, "utilities"],
    [/movie|music|game|sport|entertainment|kino|unterhaltung/, "entertainment"],
    [/hotel|flight|travel|reise|flug|vacation|urlaub/, "travel"],
    [/medical|health|gesundheit|arzt|apotheke/, "health"],
    [/clothing|shopping|einkauf|electronics/, "shopping"],
    [/gift|geschenk/, "gifts"],
  ];
  return hints.find(([re]) => re.test(s))?.[1] ?? "other";
}

export async function previewImport(userId: string, groupId: string, text: string) {
  await requireOwner(userId, groupId);
  const p = parseOrThrow(text);
  const group = (await listGroups(userId)).find((g) => g.id === groupId)!;
  const [dup] = await getDb().select({ id: imports.id }).from(imports).where(and(eq(imports.groupId, groupId), eq(imports.hash, fingerprint(p))));
  const members = group.members.map((m) => ({ id: m.id, name: m.name }));
  const norm = (s: string) => s.trim().toLowerCase().replace(/ \((test|gast|guest)\)$/, "");
  return {
    format: p.format,
    expenses: p.entries.filter((e) => e.kind === "expense").length,
    payments: p.entries.filter((e) => e.kind === "payment").length,
    currencies: [...new Set(p.entries.map((e) => e.currency))],
    errors: p.errors,
    alreadyImported: !!dup,
    members,
    // Vorschlag: gleicher Anzeigename → dieses Mitglied, sonst neuer Gast
    people: p.people.map((name) => ({ name, suggestion: members.find((m) => norm(m.name) === norm(name))?.id ?? "new" })),
  };
}

/**
 * Führt den Import aus: ordnet Namen Mitgliedern zu (oder legt Gäste an), bucht Ausgaben mit festen Beträgen
 * (ohne Benachrichtigung je Eintrag) und Zahlungen. Dieselbe Datei kann pro Gruppe nur einmal importiert werden.
 */
export async function runImport(userId: string, groupId: string, text: string, mapping: Record<string, string>) {
  await requireOwner(userId, groupId);
  const p = parseOrThrow(text);
  const group = (await listGroups(userId)).find((g) => g.id === groupId)!;
  const memberIds = new Set(group.members.map((m) => m.id));
  for (const name of p.people) {
    const v = mapping[name];
    if (!v || (v !== "new" && !memberIds.has(v))) throw new ApiError(400, "import_mapping");
  }
  // Datei beanspruchen (eindeutiger Index), danach erst buchen
  const hash = fingerprint(p);
  const claimed = await getDb()
    .insert(imports)
    .values({ groupId, hash, format: p.format, expenses: 0, payments: 0, createdBy: userId })
    .onConflictDoNothing()
    .returning({ id: imports.id });
  if (!claimed.length) throw new ApiError(409, "import_duplicate");
  const ids = new Map<string, string>();
  for (const name of p.people) {
    const v = mapping[name];
    ids.set(name, v === "new" ? (await addGuest(userId, groupId, name)).id : v);
  }
  const idOf = (n: string) => ids.get(n)!;
  let expenses = 0;
  let payments = 0;
  const failed: { line: number; code: string }[] = [];
  for (const e of p.entries) {
    try {
      if (e.kind === "payment") await bookPayment(userId, groupId, e, idOf);
      else await bookExpense(userId, groupId, e, idOf);
      if (e.kind === "payment") payments++;
      else expenses++;
    } catch (err) {
      failed.push({ line: e.line, code: err instanceof ApiError ? err.code : ((err as { code?: string }).code ?? "error") });
    }
  }
  await getDb().update(imports).set({ expenses, payments }).where(eq(imports.id, claimed[0].id));
  return { expenses, payments, failed: [...p.errors, ...failed].sort((a, b) => a.line - b.line) };
}

/** Mehrere Namen können demselben Mitglied zugeordnet sein: Beträge zusammenfassen. */
function merge(parts: { name: string; amountMinor: number }[], idOf: (n: string) => string) {
  const m = new Map<string, number>();
  for (const x of parts) m.set(idOf(x.name), (m.get(idOf(x.name)) ?? 0) + x.amountMinor);
  return [...m.entries()].map(([userId, amountMinor]) => ({ userId, amountMinor }));
}

async function bookExpense(userId: string, groupId: string, e: Extract<ImportEntry, { kind: "expense" }>, idOf: (n: string) => string) {
  await createExpense(
    userId,
    groupId,
    {
      title: (e.title || "Import").slice(0, 200),
      amountMinor: e.amountMinor,
      currency: e.currency,
      date: e.date,
      category: matchCategory(e.category),
      payers: merge(e.payers, idOf),
      split: { type: "exact", entries: merge(e.shares, idOf) },
    },
    null,
    { silent: true },
  );
}

async function bookPayment(userId: string, groupId: string, e: Extract<ImportEntry, { kind: "payment" }>, idOf: (n: string) => string) {
  if (idOf(e.from) === idOf(e.to)) return; // beide Namen derselben Person zugeordnet: nichts zu buchen
  await createPayment(userId, groupId, { fromUser: idOf(e.from), toUser: idOf(e.to), amountMinor: e.amountMinor, currency: e.currency, date: e.date, note: (e.title || undefined)?.slice(0, 200) });
}
