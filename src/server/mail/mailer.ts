import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { randomBytes } from "node:crypto";
import { smtpSettings, type SmtpSettings } from "../services/settings";

/**
 * E-Mail-Versand (optional). Quelle der Zugangsdaten, in dieser Reihenfolge:
 * 1. `.env`: `SMTP_URL` (z. B. `smtps://user:pass@mail.example.org:465`) und `MAIL_FROM`
 * 2. Admin-Bereich (Datenbank, Passwort verschlüsselt mit APP_SECRET)
 * Sonst ist der Versand aus und alles funktioniert wie ohne Mail (Admin gibt Links selbst weiter).
 *
 * Nur für Tests: `SMTP_URL=file:///pfad` legt jede Mail als JSON-Datei ab (nie über den Admin-Bereich wählbar).
 */
export type Mail = { to: string; subject: string; text: string };
export type MailSource = "env" | "admin" | null;

type Transport = { send(m: Mail & { from: string }): Promise<void> };

let override: ((m: Mail) => void | Promise<void>) | null = null;
/** Test-Hook: fängt alle Mails ab (Versand gilt dann als eingerichtet). `null` setzt zurück. */
export function setMailSink(fn: ((m: Mail) => void | Promise<void>) | null) {
  override = fn;
}

async function envConfig(): Promise<{ from: string; transport: Transport } | null> {
  const url = process.env.SMTP_URL;
  if (!url) return null;
  const from = process.env.MAIL_FROM || "Finantsen <noreply@localhost>";
  if (url.startsWith("file://")) {
    const dir = fileURLToPath(url);
    return {
      from,
      transport: {
        async send(m) {
          await mkdir(dir, { recursive: true });
          const name = `${Date.now()}-${randomBytes(4).toString("hex")}.json`;
          await writeFile(path.join(dir, name), JSON.stringify(m, null, 2));
        },
      },
    };
  }
  return { from, transport: await smtpTransport(url) };
}

async function smtpTransport(options: string | Record<string, unknown>): Promise<Transport> {
  const { createTransport } = await import("nodemailer");
  const t = createTransport(options as Parameters<typeof createTransport>[0]);
  return {
    async send(m) {
      await t.sendMail({ from: m.from, to: m.to, subject: m.subject, text: m.text });
    },
  };
}

export function smtpOptions(s: SmtpSettings) {
  return {
    host: s.host,
    port: s.port,
    secure: s.security === "tls",
    requireTLS: s.security === "starttls",
    ignoreTLS: s.security === "none",
    auth: s.user ? { user: s.user, pass: s.pass } : undefined,
    connectionTimeout: 15_000,
    greetingTimeout: 15_000,
    socketTimeout: 30_000,
  };
}

async function config(): Promise<{ from: string; transport: Transport; source: MailSource } | null> {
  const e = await envConfig();
  if (e) return { ...e, source: "env" };
  const s = await smtpSettings();
  if (s?.host && s.from) return { from: s.from, transport: await smtpTransport(smtpOptions(s)), source: "admin" };
  return null;
}

/** Woher die Zugangsdaten kommen (`null` = Versand aus). */
export async function mailSource(): Promise<MailSource> {
  if (override) return "env";
  if (process.env.SMTP_URL) return "env";
  const s = await smtpSettings();
  return s?.host && s.from ? "admin" : null;
}

export async function mailEnabled(): Promise<boolean> {
  return (await mailSource()) !== null;
}

/** Verschickt eine Mail. Wirft bei Fehlern (Aufrufer entscheiden, ob das stört). */
export async function sendMailOrThrow(mail: Mail): Promise<void> {
  // Betreff kann Gruppennamen enthalten: keine Zeilenumbrüche in Kopfzeilen
  const m = { ...mail, subject: mail.subject.replace(/[\r\n]+/g, " ") };
  if (override) return void (await override(m));
  const c = await config();
  if (!c) throw new Error("mail_disabled");
  await c.transport.send({ ...m, from: c.from });
}

/** Verschickt eine Mail; Fehler werden geloggt, nie geworfen. Liefert, ob der Versand geklappt hat. */
export async function sendMail(m: Mail): Promise<boolean> {
  try {
    await sendMailOrThrow(m);
    return true;
  } catch (e) {
    console.error("[mail] send failed", (e as Error).message);
    return false;
  }
}

const pending = new Set<Promise<unknown>>();
/** Versand im Hintergrund (die Anfrage wartet nicht auf den Mailserver). */
export function sendInBackground(m: Mail) {
  trackBackground(sendMail(m));
}
export function trackBackground(p: Promise<unknown>) {
  const t = p.finally(() => pending.delete(t));
  pending.add(t);
}
/** Für Tests: wartet, bis alle Hintergrund-Mails verschickt sind. */
export async function flushMail() {
  while (pending.size) await Promise.all([...pending]);
}
