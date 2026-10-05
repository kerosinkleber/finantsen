import { and, count, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import { getDb } from "../db";
import { groupMembers, groups, notifications, users } from "../schema";
import { translate, normalizeLocale } from "@/i18n";
import { formatMoney } from "@/lib/money";
import { sendPush } from "./push";
import { env } from "../env";
import { mailEnabled, sendInBackground } from "../mail/mailer";
import { notificationMail } from "../mail/templates";

export type NotificationData = {
  actorName: string;
  title: string;
  groupName: string;
  amountMinor?: number;
  currency?: string;
  excerpt?: string;
  auto?: boolean;
  /** Erinnerung: offene Beträge je Währung */
  amounts?: { amountMinor: number; currency: string }[];
  /** Erinnerung: wer erinnert hat (für die Drossel) */
  actorId?: string;
};

/** Legt In-App-Benachrichtigungen für alle anderen Gruppenmitglieder an und stößt Web Push an. */
export async function notifyGroup(opts: {
  type: "expense_created" | "expense_restored" | "comment";
  /** Automatische Buchung aus einer wiederkehrenden Vorlage */
  auto?: boolean;
  groupId: string;
  expenseId: string;
  actorId: string;
  title: string;
  amountMinor?: number;
  currency?: string;
  excerpt?: string;
}) {
  try {
    const db = getDb();
    const [g] = await db.select({ name: groups.name, kind: groups.kind }).from(groups).where(eq(groups.id, opts.groupId));
    const [actor] = await db.select({ name: sql<string>`case when ${users.kind} = 'test' then ${users.name} || ' (Test)' else ${users.name} end` }).from(users).where(eq(users.id, opts.actorId));
    const recipients = await db
      .select({
        id: users.id,
        locale: users.locale,
        kind: users.kind,
        name: users.name,
        email: users.email,
        status: users.status,
        emailNotifications: users.emailNotifications,
      })
      .from(groupMembers)
      .innerJoin(users, eq(users.id, groupMembers.userId))
      .where(eq(groupMembers.groupId, opts.groupId));
    // Gäste (Mitglieder ohne Konto) können nichts lesen: keine Einträge, kein Push
    const others = recipients.filter((r) => r.id !== opts.actorId && r.kind !== "guest");
    if (!g || !actor || others.length === 0) return;
    const groupName = g.kind === "direct" ? actor.name : g.name;
    const data: NotificationData = {
      actorName: actor.name,
      title: opts.title,
      groupName,
      amountMinor: opts.amountMinor,
      currency: opts.currency,
      excerpt: opts.excerpt,
      auto: opts.auto,
    };
    await db.insert(notifications).values(
      others.map((r) => ({ userId: r.id, type: opts.type, groupId: opts.groupId, expenseId: opts.expenseId, data })),
    );
    await Promise.all(
      others.filter((r) => r.kind !== "test").map((r) => { // Testnutzer bekommen nie Push
        const locale = normalizeLocale(r.locale) ?? "de";
        return sendPush(r.id, {
          title: "Finantsen",
          body: renderNotification(locale, opts.type, data),
          url: `/groups/${opts.groupId}/expenses/${opts.expenseId}`,
        });
      }),
    );
    // E-Mail nur für echte, aktive Konten mit Adresse, die es eingeschaltet haben (nie Testnutzer/Gäste)
    const mailTo = others.filter((r) => r.kind === "user" && r.status === "active" && r.email && r.emailNotifications);
    if (mailTo.length && (await mailEnabled())) {
      for (const r of mailTo) {
        const locale = normalizeLocale(r.locale) ?? "de";
        sendInBackground(
          notificationMail(locale, env.appUrl, { name: r.name, email: r.email! }, {
            group: groupName,
            text: renderNotification(locale, opts.type, data),
            path: `/groups/${opts.groupId}/expenses/${opts.expenseId}`,
          }),
        );
      }
    }
  } catch (e) {
    console.error("[notify] failed", e);
  }
}

/** Link einer Benachrichtigung (Erinnerungen führen zu den Salden der Gruppe). */
export function notificationPath(n: { type: string; groupId: string; expenseId: string | null }) {
  if (n.type === "reminder") return `/groups/${n.groupId}?tab=balances`;
  if (n.type === "budget_exceeded") return `/groups/${n.groupId}?tab=stats`;
  return n.expenseId ? `/groups/${n.groupId}/expenses/${n.expenseId}` : `/groups/${n.groupId}`;
}

/**
 * Benachrichtigung an genau eine Person (z. B. Erinnerung): In-App-Eintrag, Push (nie für Testnutzer), E-Mail wenn
 * eingeschaltet (nur echte, aktive Konten). Gäste bekommen nichts.
 */
export async function notifyUser(opts: { type: "reminder" | "budget_exceeded"; userId: string; groupId: string; data: NotificationData }) {
  const db = getDb();
  const [k] = await db.select({ kind: users.kind }).from(users).where(eq(users.id, opts.userId));
  if (!k || k.kind === "guest") return;
  await db.insert(notifications).values({ userId: opts.userId, type: opts.type, groupId: opts.groupId, expenseId: null, data: opts.data });
  await deliverToUser(opts);
}

/** Push und ggf. E-Mail zu einer schon gespeicherten Benachrichtigung (ohne In-App-Eintrag). */
export async function deliverToUser(opts: { type: "reminder" | "budget_exceeded"; userId: string; groupId: string; data: NotificationData }) {
  const db = getDb();
  const [r] = await db
    .select({ id: users.id, locale: users.locale, kind: users.kind, name: users.name, email: users.email, status: users.status, emailNotifications: users.emailNotifications })
    .from(users)
    .where(eq(users.id, opts.userId));
  if (!r || r.kind === "guest") return;
  const locale = normalizeLocale(r.locale) ?? "de";
  const text = renderNotification(locale, opts.type, opts.data);
  const path = notificationPath({ type: opts.type, groupId: opts.groupId, expenseId: null });
  try {
    if (r.kind !== "test") await sendPush(r.id, { title: "Finantsen", body: text, url: path });
    if (r.kind === "user" && r.status === "active" && r.email && r.emailNotifications && (await mailEnabled())) {
      sendInBackground(notificationMail(locale, env.appUrl, { name: r.name, email: r.email }, { group: opts.data.groupName, text, path }));
    }
  } catch (e) {
    console.error("[notify] user delivery failed", e);
  }
}

export function renderNotification(locale: "de" | "en", type: string, d: NotificationData): string {
  if (type === "budget_exceeded")
    return translate(locale, "notif.budget", {
      group: d.groupName,
      spent: d.amounts?.[0] ? formatMoney(d.amounts[0].amountMinor, d.amounts[0].currency, locale) : "",
      limit: d.amounts?.[1] ? formatMoney(d.amounts[1].amountMinor, d.amounts[1].currency, locale) : "",
    });
  if (type === "reminder")
    return translate(locale, "notif.reminder", {
      actor: d.actorName,
      group: d.groupName,
      amount: (d.amounts ?? []).map((a) => formatMoney(a.amountMinor, a.currency, locale)).join(", "),
    });
  if (type === "comment")
    return translate(locale, "notif.comment", { actor: d.actorName, title: d.title, excerpt: d.excerpt ?? "" });
  return translate(locale, type === "expense_restored" ? "notif.expense_restored" : d.auto ? "notif.expense_auto" : "notif.expense_created", {
    actor: d.actorName,
    title: d.title,
    group: d.groupName,
    amount: d.amountMinor !== undefined && d.currency ? formatMoney(d.amountMinor, d.currency, locale) : "",
  });
}

export async function listNotifications(userId: string, limit = 50) {
  return getDb().select().from(notifications).where(eq(notifications.userId, userId)).orderBy(desc(notifications.createdAt)).limit(limit);
}

export async function unreadCount(userId: string): Promise<number> {
  const [r] = await getDb()
    .select({ n: count() })
    .from(notifications)
    .where(and(eq(notifications.userId, userId), isNull(notifications.readAt)));
  return r.n;
}

export async function markRead(userId: string, ids?: string[]) {
  const where = ids?.length
    ? and(eq(notifications.userId, userId), isNull(notifications.readAt), inArray(notifications.id, ids))
    : and(eq(notifications.userId, userId), isNull(notifications.readAt));
  await getDb().update(notifications).set({ readAt: new Date() }).where(where);
}
