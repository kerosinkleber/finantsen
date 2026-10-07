"use client";
import { LogoutButton } from "./LogoutButton";
import { useRouter } from "next/navigation";
import { api } from "@/lib/client-api";
import { useI18n } from "@/i18n/client";

export function SettingsPanel() {
  const { t, locale } = useI18n();
  const router = useRouter();

  async function setLocale(l: "de" | "en") {
    document.cookie = `locale=${l}; path=/; max-age=31536000; samesite=lax`;
    await api("PATCH", "/api/auth/me", { locale: l }).catch(() => {});
    router.refresh();
  }
  return (
    <div className="flex flex-col gap-4">
      <div className="card">
        <label className="label" htmlFor="lang">{t("settings.language")}</label>
        <select id="lang" className="input" value={locale} onChange={(e) => setLocale(e.target.value as "de" | "en")}>
          <option value="de">Deutsch</option>
          <option value="en">English</option>
        </select>
      </div>
      <LogoutButton />
    </div>
  );
}
