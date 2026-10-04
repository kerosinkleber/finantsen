import { eq } from "drizzle-orm";
import { getDb } from "../db";
import { settings } from "../schema";

/** Instanz-Einstellungen (Tabelle `settings`), nur vom Admin änderbar. */
const KEYS = {
  registrationEnabled: "registration_enabled",
  allowDuplicateEmails: "allow_duplicate_emails",
  linkValidityHours: "link_validity_hours",
  testFeatures: "test_features_enabled",
} as const;

export const LINK_VALIDITY_MIN = 1;
export const LINK_VALIDITY_MAX = 720; // 30 Tage

async function get(key: string): Promise<string | null> {
  const [row] = await getDb().select().from(settings).where(eq(settings.key, key));
  return row?.value ?? null;
}
async function set(key: string, value: string) {
  await getDb().insert(settings).values({ key, value }).onConflictDoUpdate({ target: settings.key, set: { value } });
}

/** Standard: aus. Der Admin kann die Selbstregistrierung einschalten (Konten warten dann auf Freigabe). */
export const registrationEnabled = async () => (await get(KEYS.registrationEnabled)) === "true";
/** Standard: aus (E-Mail ist dann eindeutig, sofern angegeben). */
export const allowDuplicateEmails = async () => (await get(KEYS.allowDuplicateEmails)) === "true";
/** Gültigkeit von Einmal-Links in Stunden, Standard 72. */
export async function linkValidityHours(): Promise<number> {
  const n = Number(await get(KEYS.linkValidityHours));
  return Number.isInteger(n) && n >= LINK_VALIDITY_MIN && n <= LINK_VALIDITY_MAX ? n : 72;
}

/**
 * Admin-Testfunktionen (Testnutzer, "Handeln als"). Der Standardwert kommt aus TEST_FEATURES_DEFAULT
 * (nur "true" schaltet ein); ohne die Variable ist die Funktion aus, so auch im produktiven Compose-Stack.
 * Eine explizite Wahl im Admin-Bereich (Datenbank) hat Vorrang.
 */
export async function testFeaturesEnabled(): Promise<boolean> {
  const v = await get(KEYS.testFeatures);
  if (v !== null) return v === "true";
  return process.env.TEST_FEATURES_DEFAULT === "true";
}

export async function getAdminSettings() {
  return {
    registrationEnabled: await registrationEnabled(),
    allowDuplicateEmails: await allowDuplicateEmails(),
    linkValidityHours: await linkValidityHours(),
    testFeaturesEnabled: await testFeaturesEnabled(),
  };
}

export async function updateAdminSettings(data: {
  registrationEnabled?: boolean;
  allowDuplicateEmails?: boolean;
  linkValidityHours?: number;
  testFeaturesEnabled?: boolean;
}) {
  if (data.registrationEnabled !== undefined) await set(KEYS.registrationEnabled, String(data.registrationEnabled));
  if (data.allowDuplicateEmails !== undefined) await set(KEYS.allowDuplicateEmails, String(data.allowDuplicateEmails));
  if (data.linkValidityHours !== undefined) await set(KEYS.linkValidityHours, String(data.linkValidityHours));
  if (data.testFeaturesEnabled !== undefined) await set(KEYS.testFeatures, String(data.testFeaturesEnabled));
  return getAdminSettings();
}
