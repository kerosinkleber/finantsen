import { and, eq, sql } from "drizzle-orm";
import { getDb } from "../db";
import { groupMembers, users } from "../schema";
import { ApiError } from "../http";
import { verifyPassword } from "../auth";
import { isValidIban, isValidPaypalName, normalizeIban } from "@/lib/payment";
import { requireMember } from "./access";

export type PayInfo = { holder: string | null; iban: string | null; paypal: string | null };

/** Eigene Bezahldaten (für die Kontoseite). */
export async function getOwnPayInfo(userId: string): Promise<PayInfo> {
  const [u] = await getDb().select({ holder: users.payHolder, iban: users.payIban, paypal: users.payPaypal }).from(users).where(eq(users.id, userId));
  return u ?? { holder: null, iban: null, paypal: null };
}

/**
 * Bezahldaten setzen (leer = entfernen). Nur mit aktuellem Passwort: Wer eine fremde Sitzung erwischt, soll keine
 * Zahlungen auf sein Konto umleiten können.
 */
export async function setOwnPayInfo(userId: string, data: { holder: string; iban: string; paypal: string }, password: string) {
  const [u] = await getDb().select().from(users).where(eq(users.id, userId));
  if (!u || u.kind !== "user") throw new ApiError(403, "forbidden");
  if (u.passwordHash && !(await verifyPassword(u.passwordHash, password))) throw new ApiError(403, "wrong_password");
  const iban = data.iban.trim() ? normalizeIban(data.iban) : null;
  if (iban && !isValidIban(iban)) throw new ApiError(400, "invalid_iban");
  // Ein eingefügter Link „paypal.me/name/…“ wird auf den Namen gekürzt, sonst gilt die Eingabe unverändert
  const raw = data.paypal.trim();
  const fromLink = /^(?:https?:\/\/)?(?:www\.)?paypal\.me\/([^/?#]+)/i.exec(raw);
  const paypal = (fromLink ? fromLink[1] : raw) || null;
  if (paypal && !isValidPaypalName(paypal)) throw new ApiError(400, "invalid_paypal");
  const holder = data.holder.replace(/\s+/g, " ").trim().slice(0, 70) || null;
  // Für GiroCode braucht es den Namen des Kontoinhabers
  if (iban && !holder) throw new ApiError(400, "holder_required");
  await getDb().update(users).set({ payIban: iban, payHolder: holder, payPaypal: paypal }).where(eq(users.id, userId));
  return { holder, iban, paypal };
}

/**
 * Bezahldaten der Empfänger, denen `viewerId` in dieser Gruppe laut Ausgleichsvorschlag Geld schuldet.
 * Andere Empfänger bekommt man nie zu sehen. Nur echte Konten (keine Gäste/Testnutzer).
 */
export async function payInfoForCreditors(viewerId: string, groupId: string, creditorIds: string[]): Promise<Map<string, PayInfo>> {
  await requireMember(viewerId, groupId);
  const out = new Map<string, PayInfo>();
  const ids = [...new Set(creditorIds)].filter((id) => id !== viewerId);
  if (!ids.length) return out;
  const rows = await getDb()
    .select({ id: users.id, holder: users.payHolder, iban: users.payIban, paypal: users.payPaypal })
    .from(users)
    .innerJoin(groupMembers, and(eq(groupMembers.userId, users.id), eq(groupMembers.groupId, groupId)))
    .where(and(eq(users.kind, "user"), sql`${users.id} = any(${sql.param(ids)}::uuid[])`));
  for (const r of rows) if (r.iban || r.paypal) out.set(r.id, { holder: r.holder, iban: r.iban, paypal: r.paypal });
  return out;
}
