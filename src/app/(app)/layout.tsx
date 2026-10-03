import Link from "next/link";
import { requireUser } from "@/server/auth";
import { Nav } from "@/components/Nav";
import { getT } from "@/i18n/server";
import { unreadCount } from "@/server/services/notifications";
import { OfflineBanner } from "@/components/OfflineBanner";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const unread = await unreadCount(user.id);
  const { t } = await getT();
  return (
    <div className="mx-auto min-h-dvh w-full max-w-3xl px-4 pb-24 pt-4 md:pb-8">
      <header className="mb-4 flex items-center justify-between gap-4">
        <Link href="/" className="text-xl font-bold text-brand">Finantsen</Link>
        <div className="flex items-center gap-2">
          <div className="hidden md:block"><Nav /></div>
          <Link href="/notifications" aria-label={t("notif.title")} data-testid="bell" className="relative flex min-h-11 min-w-11 items-center justify-center rounded-lg text-slate-600 dark:text-slate-300">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M18 8a6 6 0 10-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.7 21a2 2 0 01-3.4 0" />
            </svg>
            {unread > 0 && (
              <span data-testid="unread" className="absolute right-1 top-1 min-w-5 rounded-full bg-red-600 px-1 text-center text-xs font-semibold text-white">{unread > 99 ? "99+" : unread}</span>
            )}
          </Link>
        </div>
      </header>
      <OfflineBanner />
      <main className="flex flex-col gap-4">{children}</main>
      <div className="md:hidden"><Nav /></div>
    </div>
  );
}
