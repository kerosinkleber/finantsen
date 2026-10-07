import { translate, type Locale } from "@/i18n";
import { formatMoney } from "@/lib/money";
import type { Mail } from "./mailer";

/**
 * Reine Text-Mails (kein HTML: nichts, was Mailprogramme blockieren oder falsch darstellen) in der Sprache
 * des Empfängers. Uhrzeiten stehen ausdrücklich in UTC, weil der Server die Zeitzone des Empfängers nicht kennt.
 */
const base = (appUrl: string) => appUrl.replace(/\/$/, "");

function wrap(locale: Locale, appUrl: string, name: string, body: string) {
  return `${translate(locale, "mail.hello", { name })}\n\n${body}\n\n-- \n${translate(locale, "mail.footer", { url: base(appUrl) })}\n`;
}

export function utcStamp(d: Date) {
  return `${d.toISOString().slice(0, 16).replace("T", " ")} UTC`;
}

export function linkMail(
  locale: Locale,
  appUrl: string,
  u: { name: string; username: string; email: string },
  link: { url: string; expiresAt: Date; purpose: string },
): Mail {
  const kind = link.purpose === "activation" ? "activation" : "reset";
  const body = translate(locale, `mail.${kind}.body`, { username: u.username, link: link.url, expires: utcStamp(link.expiresAt) });
  return { to: u.email, subject: translate(locale, `mail.${kind}.subject`), text: wrap(locale, appUrl, u.name, body) };
}

export function notificationMail(locale: Locale, appUrl: string, to: { name: string; email: string }, n: { group: string; text: string; path: string }): Mail {
  const body = [
    n.text,
    translate(locale, "mail.notif.open", { link: base(appUrl) + n.path }),
    translate(locale, "mail.notif.why", { link: `${base(appUrl)}/settings` }),
  ].join("\n\n");
  return { to: to.email, subject: translate(locale, "mail.notif.subject", { group: n.group }), text: wrap(locale, appUrl, to.name, body) };
}

export type DigestLine = { group: string; currency: string; amount: number };

/** Wöchentliche Übersicht; `null`, wenn nichts offen ist (dann wird nichts verschickt). */
export function digestMail(locale: Locale, appUrl: string, to: { name: string; email: string }, lines: DigestLine[]): Mail | null {
  const open = lines.filter((l) => l.amount !== 0);
  if (!open.length) return null;
  const fmt = (n: number, c: string) => formatMoney(n, c, locale);
  const rows = open.map((l) =>
    translate(locale, l.amount > 0 ? "mail.digest.gets" : "mail.digest.owes", { group: l.group, amount: fmt(Math.abs(l.amount), l.currency) }),
  );
  const totals = new Map<string, number>();
  for (const l of open) totals.set(l.currency, (totals.get(l.currency) ?? 0) + l.amount);
  const totalText = [...totals.entries()].map(([c, n]) => (n > 0 ? "+" : n < 0 ? "−" : "") + fmt(Math.abs(n), c)).join(", ");
  const body = [
    translate(locale, "mail.digest.intro"),
    rows.map((r) => `- ${r}`).join("\n"),
    translate(locale, "mail.digest.total", { amount: totalText }),
    translate(locale, "mail.digest.open", { link: base(appUrl) }),
    translate(locale, "mail.digest.why", { link: `${base(appUrl)}/settings` }),
  ].join("\n\n");
  return { to: to.email, subject: translate(locale, "mail.digest.subject"), text: wrap(locale, appUrl, to.name, body) };
}

export function testMail(locale: Locale, appUrl: string, to: { name: string; email: string }): Mail {
  return { to: to.email, subject: translate(locale, "mail.test.subject"), text: wrap(locale, appUrl, to.name, translate(locale, "mail.test.body")) };
}
