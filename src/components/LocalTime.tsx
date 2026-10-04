"use client";

/**
 * Zeitpunkt in der Zeitzone des Browsers. Serverseitig gerendert wäre es die Zeitzone des Servers (meist UTC),
 * daher bewusst im Client formatiert; der Server liefert nur den ISO-Zeitstempel.
 */
export function LocalTime({ iso, locale, className }: { iso: string; locale: string; className?: string }) {
  return (
    <time className={className} dateTime={iso} suppressHydrationWarning>
      {new Date(iso).toLocaleString(locale)}
    </time>
  );
}
