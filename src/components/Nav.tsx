"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useI18n } from "@/i18n/client";

const items = [
  { href: "/", key: "nav.home", icon: "M3 12l9-9 9 9M5 10v10h5v-6h4v6h5V10" },
  { href: "/friends", key: "nav.friends", icon: "M16 11a4 4 0 10-8 0 4 4 0 008 0zM4 21a8 8 0 0116 0" },
  { href: "/settings", key: "nav.settings", icon: "M12 15a3 3 0 100-6 3 3 0 000 6zM19 12a7 7 0 00-.1-1.2l2-1.6-2-3.4-2.4 1a7 7 0 00-2-1.2L14 3h-4l-.4 2.6a7 7 0 00-2 1.2l-2.4-1-2 3.4 2 1.6a7 7 0 000 2.4l-2 1.6 2 3.4 2.4-1a7 7 0 002 1.2L10 21h4l.4-2.6a7 7 0 002-1.2l2.4 1 2-3.4-2-1.6c.1-.4.2-.8.2-1.2z" },
] as const;

export function Nav() {
  const path = usePathname();
  const { t } = useI18n();
  return (
    <nav className="fixed inset-x-0 bottom-0 z-10 border-t border-slate-200 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur dark:border-slate-800 dark:bg-slate-900/95 md:static md:border-0 md:bg-transparent md:pb-0 md:backdrop-blur-none">
      <ul className="mx-auto flex max-w-3xl justify-around md:justify-start md:gap-2">
        {items.map((it) => {
          const active = it.href === "/" ? path === "/" || path.startsWith("/groups") : path.startsWith(it.href);
          return (
            <li key={it.href} className="flex-1 md:flex-none">
              <Link
                href={it.href}
                aria-current={active ? "page" : undefined}
                className={`flex min-h-14 flex-col items-center justify-center gap-0.5 text-xs md:min-h-10 md:flex-row md:gap-2 md:rounded-lg md:px-3 md:text-sm ${active ? "font-semibold text-brand" : "text-slate-500"}`}
              >
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d={it.icon} />
                </svg>
                {t(it.key)}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
