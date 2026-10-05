import { and, eq, isNotNull, isNull, lt, or } from "drizzle-orm";
import { getDb } from "../db";
import { env } from "../env";
import { users } from "../schema";
import { normalizeLocale } from "@/i18n";
import { mailEnabled, sendMail } from "../mail/mailer";
import { digestMail, type DigestLine } from "../mail/templates";
import { overallBalances } from "./balances";
import { listGroups } from "./groups";

/** Beginn der aktuellen Versandwoche: letzter Montag 06:00 UTC (≤ now). */
export function digestWeekStart(now: Date): Date {
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 6));
  const back = (d.getUTCDay() + 6) % 7; // Tage seit Montag
  d.setUTCDate(d.getUTCDate() - back);
  if (d > now) d.setUTCDate(d.getUTCDate() - 7);
  return d;
}

export async function digestLines(userId: string): Promise<DigestLine[]> {
  const [groups, balances] = await Promise.all([listGroups(userId), overallBalances(userId)]);
  const names = new Map(groups.map((g) => [g.id, g.displayName]));
  return Object.entries(balances.perGroup).flatMap(([gid, m]) =>
    Object.entries(m).map(([currency, amount]) => ({ group: names.get(gid) ?? "?", currency, amount })),
  );
}

/**
 * Wöchentliche Zusammenfassung: einmal pro Woche ab Montag 06:00 UTC (verpasste Läufe werden in derselben Woche
 * nachgeholt). Jedes Konto wird atomar beansprucht (`digest_sent_at`), damit nie doppelt verschickt wird.
 * Nur echte, aktive Konten mit Adresse; ohne offene Salden geht keine Mail raus.
 */
export async function runWeeklyDigest(now = new Date()): Promise<number> {
  if (!(await mailEnabled())) return 0;
  const weekStart = digestWeekStart(now);
  const due = or(isNull(users.digestSentAt), lt(users.digestSentAt, weekStart));
  const candidates = await getDb()
    .select({ id: users.id })
    .from(users)
    .where(and(eq(users.weeklyDigest, true), eq(users.kind, "user"), eq(users.status, "active"), isNotNull(users.email), due));
  let sent = 0;
  for (const c of candidates) {
    const [u] = await getDb().update(users).set({ digestSentAt: now }).where(and(eq(users.id, c.id), due)).returning();
    if (!u?.email) continue; // schon von einem anderen Lauf beansprucht
    const mail = digestMail(normalizeLocale(u.locale) ?? env.defaultLocale, env.appUrl, { name: u.name, email: u.email }, await digestLines(u.id));
    if (mail && (await sendMail(mail))) sent++;
  }
  return sent;
}

export function startDigestScheduler(everyMs = 15 * 60_000) {
  if (process.env.SCHEDULER === "off") return;
  const tick = () => runWeeklyDigest().catch((e) => console.error("[digest] run failed", e));
  void tick();
  setInterval(tick, everyMs).unref();
}
