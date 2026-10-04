import { eq } from "drizzle-orm";
import { getDb } from "../db";
import { settings } from "../schema";

/** Schlüssel in der Tabelle `settings` (Instanz-Einstellungen, vom Admin änderbar). */
export const ALLOW_DUPLICATE_EMAILS = "allow_duplicate_emails";

async function getSetting(key: string): Promise<string | null> {
  const [row] = await getDb().select().from(settings).where(eq(settings.key, key));
  return row?.value ?? null;
}

async function setSetting(key: string, value: string) {
  await getDb().insert(settings).values({ key, value }).onConflictDoUpdate({ target: settings.key, set: { value } });
}

/** Standard: erlaubt (mehrere Konten mit derselben E-Mail). */
export async function allowDuplicateEmails(): Promise<boolean> {
  return (await getSetting(ALLOW_DUPLICATE_EMAILS)) !== "false";
}

export async function getAdminSettings() {
  return { allowDuplicateEmails: await allowDuplicateEmails() };
}

export async function updateAdminSettings(data: { allowDuplicateEmails?: boolean }) {
  if (data.allowDuplicateEmails !== undefined) await setSetting(ALLOW_DUPLICATE_EMAILS, String(data.allowDuplicateEmails));
  return getAdminSettings();
}
