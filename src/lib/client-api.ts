export class ApiClientError extends Error {
  constructor(
    public status: number,
    public code: string,
    public detail?: string,
    /** Vollständiger JSON-Body der Fehlerantwort (z. B. Kontoliste bei choose_account) */
    public data?: Record<string, unknown>,
  ) {
    super(code);
  }
}

/**
 * Verbindungszustand aus Sicht der Anfragen. `navigator.onLine` reicht nicht: Mit dauerhaft „verbundenem“ VPN oder
 * einem App-eigenen Tunnel bleibt es im Flugmodus `true`. Gescheiterte Anfragen melden deshalb selbst „offline“.
 */
let unreachable = false;
const listeners = new Set<() => void>();
function setUnreachable(v: boolean) {
  if (unreachable === v) return;
  unreachable = v;
  listeners.forEach((l) => l());
}
export const connection = {
  unreachable: () => unreachable,
  subscribe(cb: () => void) {
    listeners.add(cb);
    return () => void listeners.delete(cb);
  },
};

/** JSON-Request an die eigene API. Wirft ApiClientError mit dem Fehlercode des Servers. */
export async function api<T = unknown>(method: string, url: string, body?: unknown): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, {
      method,
      headers: body === undefined ? undefined : { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    setUnreachable(true);
    throw new ApiClientError(0, "offline");
  }
  const data = await res.json().catch(() => ({}));
  // Kein Fehlercode von uns und Gateway-/Serverfehler: die Antwort kam nicht von Finantsen, sondern von einem Proxy,
  // Tunnel o. Ä. auf dem Weg (Server nicht erreichbar). Für den Nutzer ist das „keine Verbindung“.
  if (!res.ok && data.error === undefined && res.status >= 500) {
    setUnreachable(true);
    throw new ApiClientError(res.status, "offline");
  }
  setUnreachable(false);
  if (!res.ok) throw new ApiClientError(res.status, data.error ?? "internal", data.message, data);
  return data as T;
}
