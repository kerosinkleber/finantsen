/**
 * Ziel nach der Anmeldung: nur interne Pfade. "//evil.com" oder "/\evil.com" sehen wie Pfade aus, führen im Browser
 * aber auf fremde Seiten (offene Weiterleitung); deshalb muss nach dem ersten "/" ein anderes Zeichen folgen.
 */
export function safeNext(next: string | null | undefined): string {
  if (!next || !/^\/(?![\/\\])/.test(next) || /[\r\n\t]/.test(next)) return "/";
  return next;
}

/**
 * Web-Push-Endpunkte dürfen nur bei den bekannten Push-Diensten liegen (HTTPS). Sonst könnte ein Nutzer einen
 * internen Server als „Endpunkt“ eintragen, den der Server dann bei jeder Benachrichtigung anspricht (SSRF).
 */
const PUSH_HOSTS = [/\.googleapis\.com$/, /\.push\.services\.mozilla\.com$/, /\.notify\.windows\.com$/, /\.push\.apple\.com$/];
export function isAllowedPushEndpoint(endpoint: string): boolean {
  try {
    const u = new URL(endpoint);
    return u.protocol === "https:" && !u.port && PUSH_HOSTS.some((re) => re.test(u.hostname));
  } catch {
    return false;
  }
}
