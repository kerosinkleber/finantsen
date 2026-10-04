"use client";
import { useSyncExternalStore } from "react";

const subscribe = () => () => {};

/**
 * Zeitpunkt in der Zeitzone des Browsers. Der Server kennt die Zeitzone nicht (er rendert in UTC); deshalb zeigt
 * die Server-Ausgabe nur das Datum, und erst im Browser wird Datum + Uhrzeit in Ortszeit eingesetzt.
 * (`suppressHydrationWarning` allein reicht nicht: React behält dann den Server-Text.)
 */
export function LocalTime({ iso, locale, className }: { iso: string; locale: string; className?: string }) {
  const inBrowser = useSyncExternalStore(subscribe, () => true, () => false);
  const d = new Date(iso);
  return (
    <time className={className} dateTime={iso} data-testid="local-time">
      {inBrowser ? d.toLocaleString(locale) : d.toLocaleDateString(locale, { timeZone: "UTC" })}
    </time>
  );
}
