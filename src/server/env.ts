export const env = {
  get databaseUrl() {
    return process.env.DATABASE_URL ?? "postgres://finantsen:finantsen@localhost:5432/finantsen";
  },
  get appUrl() {
    return process.env.APP_URL ?? "http://localhost:3000";
  },
  get registrationEnabled() {
    return (process.env.REGISTRATION_ENABLED ?? "true").toLowerCase() !== "false";
  },
  get defaultLocale(): "de" | "en" {
    return process.env.DEFAULT_LOCALE === "en" ? "en" : "de";
  },
  get secureCookies() {
    return this.appUrl.startsWith("https://");
  },
};
