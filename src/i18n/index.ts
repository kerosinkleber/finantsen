import de, { type MessageKey } from "./de";
import en from "./en";

export type Locale = "de" | "en";
export const LOCALES: Locale[] = ["de", "en"];
export const LOCALE_COOKIE = "locale";
export type { MessageKey };

const dicts: Record<Locale, Record<string, string>> = { de, en };

export function messages(locale: Locale) {
  return dicts[locale];
}

export function translate(locale: Locale, key: MessageKey, params?: Record<string, string | number>): string {
  let s = dicts[locale][key] ?? dicts.de[key] ?? key;
  if (params) for (const [k, v] of Object.entries(params)) s = s.replaceAll(`{${k}}`, String(v));
  return s;
}

export function normalizeLocale(v: string | undefined | null): Locale | null {
  const s = v?.slice(0, 2).toLowerCase();
  return s === "de" || s === "en" ? s : null;
}
