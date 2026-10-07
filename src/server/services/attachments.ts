import { and, count, desc, eq } from "drizzle-orm";
import { getDb } from "../db";
import { expenseAttachments, expenses } from "../schema";
import { ApiError, notFound } from "../http";
import { cleanBase64, sniffImage } from "../receipts/image";
import { requireMember } from "./access";

export const ATTACHMENT_MAX_BYTES = 5_000_000;
export const ATTACHMENTS_PER_EXPENSE = 5;

const isUuid = (s: string) => /^[0-9a-f-]{36}$/i.test(s);

/** Ausgabe gehört zur Gruppe (und der Nutzer ist Mitglied), sonst 404. */
async function requireExpense(userId: string, groupId: string, expenseId: string) {
  await requireMember(userId, groupId);
  if (!isUuid(expenseId)) throw notFound();
  const [e] = await getDb().select({ id: expenses.id, deletedAt: expenses.deletedAt }).from(expenses).where(and(eq(expenses.id, expenseId), eq(expenses.groupId, groupId)));
  if (!e) throw notFound();
  return e;
}

export async function listAttachments(userId: string, groupId: string, expenseId: string) {
  await requireExpense(userId, groupId, expenseId);
  return getDb()
    .select({ id: expenseAttachments.id, mime: expenseAttachments.mime, size: expenseAttachments.size, createdAt: expenseAttachments.createdAt })
    .from(expenseAttachments)
    .where(eq(expenseAttachments.expenseId, expenseId))
    .orderBy(desc(expenseAttachments.createdAt));
}

/** Foto speichern (Base64 vom Client, Typ nach Magic Bytes, nur JPEG/PNG/WebP). */
export async function addAttachment(userId: string, groupId: string, expenseId: string, image: string) {
  const e = await requireExpense(userId, groupId, expenseId);
  if (e.deletedAt) throw new ApiError(409, "invalid_state");
  const c = cleanBase64(image);
  if (!c.ok) throw new ApiError(400, c.code);
  const mime = sniffImage(c.b64);
  if (!mime) throw new ApiError(400, "invalid_image");
  const data = Buffer.from(c.b64, "base64");
  if (data.length > ATTACHMENT_MAX_BYTES) throw new ApiError(413, "image_too_large");
  // Zählen und Einfügen unter Zeilensperre der Ausgabe: parallele Uploads überschreiten die Grenze nicht
  return getDb().transaction(async (tx) => {
    await tx.select({ id: expenses.id }).from(expenses).where(eq(expenses.id, expenseId)).for("update");
    const [{ n }] = await tx.select({ n: count() }).from(expenseAttachments).where(eq(expenseAttachments.expenseId, expenseId));
    if (n >= ATTACHMENTS_PER_EXPENSE) throw new ApiError(409, "too_many_attachments");
    const [row] = await tx
      .insert(expenseAttachments)
      .values({ expenseId, mime, size: data.length, data, createdBy: userId })
      .returning({ id: expenseAttachments.id, mime: expenseAttachments.mime, size: expenseAttachments.size, createdAt: expenseAttachments.createdAt });
    return row;
  });
}

export async function getAttachment(userId: string, groupId: string, expenseId: string, attachmentId: string) {
  await requireExpense(userId, groupId, expenseId);
  if (!isUuid(attachmentId)) throw notFound();
  const [a] = await getDb()
    .select({ mime: expenseAttachments.mime, data: expenseAttachments.data })
    .from(expenseAttachments)
    .where(and(eq(expenseAttachments.id, attachmentId), eq(expenseAttachments.expenseId, expenseId)));
  if (!a) throw notFound();
  return a;
}

export async function deleteAttachment(userId: string, groupId: string, expenseId: string, attachmentId: string) {
  const e = await requireExpense(userId, groupId, expenseId);
  // Ausgabe im Papierkorb: Fotos bleiben unverändert (fürs Wiederherstellen)
  if (e.deletedAt) throw new ApiError(409, "invalid_state");
  if (!isUuid(attachmentId)) throw notFound();
  const r = await getDb()
    .delete(expenseAttachments)
    .where(and(eq(expenseAttachments.id, attachmentId), eq(expenseAttachments.expenseId, expenseId)))
    .returning({ id: expenseAttachments.id });
  if (!r.length) throw notFound();
}
