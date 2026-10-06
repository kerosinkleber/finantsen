"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { useI18n } from "@/i18n/client";

const items = [
  { href: "/", key: "nav.home", icon: "M3 12l9-9 9 9M5 10v10h5v-6h4v6h5V10" },
  { href: "/friends", key: "nav.friends", icon: "M16 11a4 4 0 10-8 0 4 4 0 008 0zM4 21a8 8 0 0116 0" },
  { href: "/settings", key: "nav.settings", icon: "M12 15a3 3 0 100-6 3 3 0 000 6zM19 12a7 7 0 00-.1-1.2l2-1.6-2-3.4-2.4 1a7 7 0 00-2-1.2L14 3h-4l-.4 2.6a7 7 0 00-2 1.2l-2.4-1-2 3.4 2 1.6a7 7 0 000 2.4l-2 1.6 2 3.4 2.4-1a7 7 0 002 1.2L10 21h4l.4-2.6a7 7 0 002-1.2l2.4 1 2-3.4-2-1.6c.1-.4.2-.8.2-1.2z" },
] as const;

/** Eingabefeld, bei dem auf dem Handy die Bildschirmtastatur aufgeht (nicht Knöpfe, Häkchen, Auswahl). */
function opensKeyboard(el: Element | null): boolean {
  if (!el) return false;
  if (el instanceof HTMLTextAreaElement) return !el.readOnly;
  if (el instanceof HTMLInputElement) {
    return !el.readOnly && !["button", "submit", "reset", "checkbox", "radio", "range", "color", "file", "image", "hidden"].includes(el.type);
  }
  return el instanceof HTMLElement && el.isContentEditable;
}

/**
 * Solange die Tastatur offen ist, würde die feste Leiste unten direkt über der Tastatur sitzen und Eingabefelder
 * verdecken (WebView/Browser verkleinern das Fenster). Deshalb ausblenden, solange ein Eingabefeld den Fokus hat.
 */
function useKeyboardOpen() {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const update = () => setOpen(opensKeyboard(document.activeElement));
    // Ausblenden sofort, wieder einblenden erst verzögert: Ein Tipp auf „Senden“ o. Ä. gibt dem Knopf den Fokus, bevor
    // der Klick ankommt. Würde die Leiste sofort erscheinen, läge sie evtl. über dem Knopf und finge den Klick ab.
    const later = () => {
      clearTimeout(timer);
      timer = setTimeout(update, 400);
    };
    const onIn = () => {
      if (opensKeyboard(document.activeElement)) {
        clearTimeout(timer);
        setOpen(true);
      } else later();
    };
    const onOut = later;
    document.addEventListener("focusin", onIn);
    document.addEventListener("focusout", onOut);
    return () => {
      clearTimeout(timer);
      document.removeEventListener("focusin", onIn);
      document.removeEventListener("focusout", onOut);
    };
  }, []);
  return open;
}

export function Nav() {
  const path = usePathname();
  const { t } = useI18n();
  const keyboard = useKeyboardOpen();
  return (
    <nav data-testid="bottom-nav" data-keyboard={keyboard ? "open" : undefined} className="fixed inset-x-0 bottom-0 z-10 data-[keyboard=open]:max-md:hidden border-t border-slate-200 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur dark:border-slate-800 dark:bg-slate-900/95 md:static md:border-0 md:bg-transparent md:pb-0 md:backdrop-blur-none">
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
