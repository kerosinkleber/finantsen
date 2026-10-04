import { isAllowedPushEndpoint } from "@/lib/safe-next";
import webpush from "web-push";
import { and, eq } from "drizzle-orm";
import { getDb } from "../db";
import { env } from "../env";
import { pushSubscriptions } from "../schema";

let configured = false;
function ensureConfigured(): boolean {
  const v = env.vapid;
  if (!v) return false;
  if (!configured) {
    webpush.setVapidDetails(v.subject, v.publicKey, v.privateKey);
    configured = true;
  }
  return true;
}

export function pushConfig() {
  return { enabled: env.vapid !== null, publicKey: env.vapid?.publicKey ?? null };
}

export async function saveSubscription(userId: string, sub: { endpoint: string; p256dh: string; auth: string }) {
  await getDb()
    .insert(pushSubscriptions)
    .values({ userId, ...sub })
    .onConflictDoUpdate({ target: pushSubscriptions.endpoint, set: { userId, p256dh: sub.p256dh, auth: sub.auth } });
}

export async function removeSubscription(userId: string, endpoint: string) {
  await getDb().delete(pushSubscriptions).where(and(eq(pushSubscriptions.userId, userId), eq(pushSubscriptions.endpoint, endpoint)));
}

/** Sendet eine Push-Nachricht an alle Geräte eines Nutzers. Fehler werden geschluckt (Push ist best effort). */
export async function sendPush(userId: string, payload: { title: string; body: string; url: string }) {
  if (!ensureConfigured()) return;
  const subs = await getDb().select().from(pushSubscriptions).where(eq(pushSubscriptions.userId, userId));
  await Promise.all(
    subs.map(async (s) => {
      if (!isAllowedPushEndpoint(s.endpoint)) return; // nie interne Adressen ansprechen (auch nicht alte Einträge)
      try {
        await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, JSON.stringify(payload), { TTL: 86400 });
      } catch (e) {
        const status = (e as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) await getDb().delete(pushSubscriptions).where(eq(pushSubscriptions.id, s.id));
      }
    }),
  );
}
