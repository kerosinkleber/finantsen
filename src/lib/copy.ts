/**
 * Text in die Zwischenablage kopieren. Die Clipboard-API gibt es nur in sicherem Kontext (HTTPS/localhost); über
 * http://IP im Heimnetz fehlt sie. Dann wird `execCommand("copy")` über ein unsichtbares Textfeld versucht.
 * Liefert, ob das Kopieren wirklich geklappt hat (nie Erfolg melden, wenn nichts kopiert wurde).
 */
export async function copyText(text: string): Promise<boolean> {
  if (typeof window === "undefined") return false;
  if (window.isSecureContext && navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      /* z. B. verweigert: Rückfall unten */
    }
  }
  const ta = document.createElement("textarea");
  ta.value = text;
  ta.setAttribute("readonly", "");
  ta.style.position = "fixed";
  ta.style.top = "0";
  ta.style.left = "0";
  ta.style.opacity = "0";
  document.body.appendChild(ta);
  const active = document.activeElement as HTMLElement | null;
  ta.select();
  ta.setSelectionRange(0, text.length);
  let ok = false;
  try {
    ok = document.execCommand("copy");
  } catch {
    ok = false;
  }
  ta.remove();
  active?.focus?.({ preventScroll: true });
  return ok;
}
