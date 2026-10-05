/**
 * Erkennt in gescanntem Text einen Einladungs- oder Verknüpfungslink dieser App und liefert den internen Pfad
 * ("/join/<code>"). Der Host wird bewusst ignoriert (die App kann unter mehreren Adressen erreichbar sein), es wird
 * aber nur dieser eine Pfadtyp akzeptiert – fremde Links werden nie geöffnet.
 */
export function appPathFromScan(text: string): string | null {
  const s = text.trim();
  let path: string;
  try {
    const u = new URL(s);
    if (u.protocol !== "https:" && u.protocol !== "http:") return null;
    path = u.pathname;
  } catch {
    path = s; // auch ein reiner Pfad "/join/abc" ist erlaubt
  }
  const m = /^\/join\/([A-Za-z0-9_-]{6,64})\/?$/.exec(path);
  return m ? `/join/${m[1]}` : null;
}
