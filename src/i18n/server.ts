import { cookies, headers } from "next/headers";
import { env } from "@/server/env";
import { LOCALE_COOKIE, normalizeLocale, translate, type Locale, type MessageKey } from "./index";

export async function getLocale(): Promise<Locale> {
  const c = normalizeLocale((await cookies()).get(LOCALE_COOKIE)?.value);
  if (c) return c;
  const al = (await headers()).get("accept-language") ?? "";
  for (const part of al.split(",")) {
    const l = normalizeLocale(part.trim());
    if (l) return l;
  }
  return env.defaultLocale;
}

export async function getT() {
  const locale = await getLocale();
  return { locale, t: (key: MessageKey, params?: Record<string, string | number>) => translate(locale, key, params) };
}
