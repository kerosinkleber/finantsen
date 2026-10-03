"use client";
import { createContext, useCallback, useContext, type ReactNode } from "react";
import { translate, type Locale, type MessageKey } from "./index";

const Ctx = createContext<Locale>("de");

export function I18nProvider({ locale, children }: { locale: Locale; children: ReactNode }) {
  return <Ctx.Provider value={locale}>{children}</Ctx.Provider>;
}

export function useI18n() {
  const locale = useContext(Ctx);
  const t = useCallback(
    (key: MessageKey, params?: Record<string, string | number>) => translate(locale, key, params),
    [locale],
  );
  return { locale, t };
}
