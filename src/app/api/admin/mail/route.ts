import { z } from "zod";
import { route, parseBody, forbidden } from "@/server/http";
import { setSmtpSettings, smtpSettingsPublic } from "@/server/services/settings";
import { mailSource } from "@/server/mail/mailer";

export const dynamic = "force-dynamic";

async function state() {
  return { source: await mailSource(), smtp: await smtpSettingsPublic() };
}

export const GET = route(async ({ user }) => {
  if (!user.isAdmin) throw forbidden();
  return state();
});

/** Mailserver im Admin-Bereich speichern (Passwort verschlüsselt; leeres Passwort behält das alte). */
export const PUT = route(async ({ req, user }) => {
  if (!user.isAdmin) throw forbidden();
  const body = await parseBody(
    req,
    z.object({
      host: z.string().trim().min(1).max(255).regex(/^[A-Za-z0-9.-]+$|^\[[0-9a-fA-F:.]+\]$/),
      port: z.number().int().min(1).max(65535),
      security: z.enum(["tls", "starttls", "none"]),
      user: z.string().trim().max(255),
      pass: z.string().max(1000),
      from: z.string().trim().min(3).max(320).regex(/^[^\r\n]+$/),
    }),
  );
  await setSmtpSettings(body);
  return state();
});

export const DELETE = route(async ({ user }) => {
  if (!user.isAdmin) throw forbidden();
  await setSmtpSettings(null);
  return state();
});
