export class ApiClientError extends Error {
  constructor(
    public status: number,
    public code: string,
    public detail?: string,
  ) {
    super(code);
  }
}

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
    throw new ApiClientError(0, "offline");
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiClientError(res.status, data.error ?? "internal", data.message);
  return data as T;
}
