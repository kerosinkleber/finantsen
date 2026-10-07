import { LocalTime } from "@/components/LocalTime";
import Link from "next/link";
import { requireUser } from "@/server/auth";
import { getT } from "@/i18n/server";
import { listNotifications, notificationPath, renderNotification, type NotificationData } from "@/server/services/notifications";
import { MarkRead } from "@/components/MarkRead";

export default async function NotificationsPage() {
  const user = await requireUser();
  const { t, locale } = await getT();
  const list = await listNotifications(user.id);
  const hasUnread = list.some((n) => !n.readAt);
  return (
    <>
      <h1 className="text-xl font-semibold">{t("notif.title")}</h1>
      {hasUnread && <MarkRead label={t("notif.markAll")} />}
      {list.length === 0 && <p className="muted">{t("notif.none")}</p>}
      <ul className="flex flex-col gap-2">
        {list.map((n) => (
          <li key={n.id}>
            <Link
              href={notificationPath(n)}
              className={`card block hover:border-brand ${n.readAt ? "" : "border-l-4 border-l-brand"}`}
              data-testid="notification"
            >
              <p className="text-sm">{renderNotification(locale, n.type, n.data as NotificationData)}</p>
              <p className="muted"><LocalTime iso={n.createdAt.toISOString()} locale={locale} /></p>
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}
