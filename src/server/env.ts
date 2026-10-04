export const env = {
  get databaseUrl() {
    return process.env.DATABASE_URL ?? "postgres://finantsen:finantsen@localhost:5432/finantsen";
  },
  get appUrl() {
    return process.env.APP_URL ?? "http://localhost:3000";
  },
  get defaultLocale(): "de" | "en" {
    return process.env.DEFAULT_LOCALE === "en" ? "en" : "de";
  },
  /** Web Push ist nur aktiv, wenn beide VAPID-Schlüssel gesetzt sind (siehe `npm run vapid`). */
  get vapid() {
    const publicKey = process.env.VAPID_PUBLIC_KEY;
    const privateKey = process.env.VAPID_PRIVATE_KEY;
    if (!publicKey || !privateKey) return null;
    return { publicKey, privateKey, subject: process.env.VAPID_SUBJECT || this.appUrl };
  },
  /**
   * NUR ENTWICKLUNG/LOKALER TEST: legt bei leerer Datenbank den Admin "admin" ohne Passwort an und erlaubt die
   * Anmeldung per Knopf ohne Passwort. Im produktiven Stack wird die Variable nie gesetzt (siehe Release-Checkliste).
   */
  get devAdmin() {
    return process.env.DEV_ADMIN === "true";
  },
  /**
   * Geheimer Schlüssel der Instanz (mind. 16 Zeichen, z. B. `openssl rand -hex 32`). Daraus werden TOTP-Geheimnisse
   * verschlüsselt, Wiederherstellungscodes gehasht und Login-Zwischenschritte signiert. Ändert man ihn, funktionieren
   * vorhandene TOTP-Einrichtungen nicht mehr (Admin muss sie zurücksetzen).
   */
  get appSecret(): string {
    const v = process.env.APP_SECRET ?? "";
    if (v.length < 16) throw new Error("APP_SECRET fehlt oder ist zu kurz (mindestens 16 Zeichen, z. B. `openssl rand -hex 32`)");
    return v;
  },
  get secureCookies() {
    return this.appUrl.startsWith("https://");
  },
};
