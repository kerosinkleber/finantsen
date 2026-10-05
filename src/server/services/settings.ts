import { eq } from "drizzle-orm";
import { getDb } from "../db";
import { settings } from "../schema";
import { decryptSecret, encryptSecret } from "../secrets";

/** Instanz-Einstellungen (Tabelle `settings`), nur vom Admin änderbar. */
const KEYS = {
  registrationEnabled: "registration_enabled",
  allowDuplicateEmails: "allow_duplicate_emails",
  linkValidityHours: "link_validity_hours",
  testFeatures: "test_features_enabled",
  totpRequiredAll: "totp_required_all",
  recoveryCodeCount: "recovery_code_count",
  passwordResetEnabled: "password_reset_enabled",
  smtp: "smtp_config",
} as const;

export const RECOVERY_CODES_MAX = 20;

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

/** TOTP für alle Konten verpflichtend (Standard aus). */
export const totpRequiredAll = async () => (await get(KEYS.totpRequiredAll)) === "true";
/** Anzahl Wiederherstellungscodes je Einrichtung/Neuerzeugung, 0–20, Standard 1. */
export async function recoveryCodeCount(): Promise<number> {
  const raw = await get(KEYS.recoveryCodeCount);
  if (raw === null) return 1;
  const n = Number(raw);
  return Number.isInteger(n) && n >= 0 && n <= RECOVERY_CODES_MAX ? n : 1;
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

/** „Passwort vergessen“ per Mail (Standard an; wirkt nur, wenn der Mailversand eingerichtet ist). */
export const passwordResetEnabled = async () => (await get(KEYS.passwordResetEnabled)) !== "false";

export type SmtpSettings = {
  host: string;
  port: number;
  /** tls = direkt verschlüsselt (meist 465), starttls = Upgrade (meist 587), none = unverschlüsselt (nur im eigenen Netz) */
  security: "tls" | "starttls" | "none";
  user: string;
  pass: string;
  from: string;
};

/** Mailserver aus dem Admin-Bereich (verschlüsselt mit APP_SECRET gespeichert). */
export async function smtpSettings(): Promise<SmtpSettings | null> {
  const raw = await get(KEYS.smtp);
  if (!raw) return null;
  try {
    return JSON.parse(decryptSecret(raw)) as SmtpSettings;
  } catch {
    console.error("[settings] smtp_config nicht lesbar (APP_SECRET geändert?)");
    return null;
  }
}

/**
 * Speichert den Mailserver. Ein leeres Passwort behält das bisherige, `null` löscht die ganze Konfiguration.
 */
export async function setSmtpSettings(s: SmtpSettings | null) {
  if (s === null) {
    await getDb().delete(settings).where(eq(settings.key, KEYS.smtp));
    return;
  }
  const prev = await smtpSettings();
  const pass = s.pass || (prev && prev.host === s.host && prev.user === s.user ? prev.pass : "");
  await set(KEYS.smtp, encryptSecret(JSON.stringify({ ...s, pass })));
}

/** Für die Admin-Oberfläche: nie das Passwort, nur ob eines hinterlegt ist. */
export async function smtpSettingsPublic() {
  const s = await smtpSettings();
  if (!s) return null;
  const { pass, ...rest } = s;
  return { ...rest, hasPassword: pass.length > 0 };
}

export async function getAdminSettings() {
  return {
    registrationEnabled: await registrationEnabled(),
    allowDuplicateEmails: await allowDuplicateEmails(),
    linkValidityHours: await linkValidityHours(),
    testFeaturesEnabled: await testFeaturesEnabled(),
    totpRequiredAll: await totpRequiredAll(),
    recoveryCodeCount: await recoveryCodeCount(),
    passwordResetEnabled: await passwordResetEnabled(),
  };
}

export async function updateAdminSettings(data: {
  registrationEnabled?: boolean;
  allowDuplicateEmails?: boolean;
  linkValidityHours?: number;
  testFeaturesEnabled?: boolean;
  totpRequiredAll?: boolean;
  recoveryCodeCount?: number;
  passwordResetEnabled?: boolean;
}) {
  if (data.registrationEnabled !== undefined) await set(KEYS.registrationEnabled, String(data.registrationEnabled));
  if (data.allowDuplicateEmails !== undefined) await set(KEYS.allowDuplicateEmails, String(data.allowDuplicateEmails));
  if (data.linkValidityHours !== undefined) await set(KEYS.linkValidityHours, String(data.linkValidityHours));
  if (data.testFeaturesEnabled !== undefined) await set(KEYS.testFeatures, String(data.testFeaturesEnabled));
  if (data.totpRequiredAll !== undefined) await set(KEYS.totpRequiredAll, String(data.totpRequiredAll));
  if (data.recoveryCodeCount !== undefined) await set(KEYS.recoveryCodeCount, String(data.recoveryCodeCount));
  if (data.passwordResetEnabled !== undefined) await set(KEYS.passwordResetEnabled, String(data.passwordResetEnabled));
  return getAdminSettings();
}
