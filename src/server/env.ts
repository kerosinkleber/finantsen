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
  get secureCookies() {
    return this.appUrl.startsWith("https://");
  },
};
