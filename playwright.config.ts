import { defineConfig, devices } from "@playwright/test";
import path from "node:path";
import { pathToFileURL } from "node:url";

const PORT = 3100;
/** Mails landen als JSON-Dateien hier (Test-Transport `file://`), siehe e2e „e-mail“. */
export const MAIL_DIR = path.resolve(import.meta.dirname, ".e2e-mails");
const DATABASE_URL = process.env.TEST_DATABASE_URL ?? "postgres://finantsen:finantsen@localhost:5432/finantsen_test";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: [["list"]],
  globalSetup: "./e2e/global-setup.ts",
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "retain-on-failure",
    locale: "en-US",
    launchOptions: process.env.PLAYWRIGHT_CHROMIUM_PATH ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH } : {},
  },
  projects: [{ name: "mobile-chrome", use: { ...devices["Pixel 7"] } }],
  webServer: {
    command: `npx next start -p ${PORT}`,
    url: `http://localhost:${PORT}/api/health`,
    reuseExistingServer: false,
    timeout: 60_000,
    env: {
      DATABASE_URL,
      APP_URL: `http://localhost:${PORT}`,
      APP_SECRET: "playwright-test-secret-not-for-production",
      // Feste Kurse statt Netzwerk (Kurse pro 1 EUR); ohne ANTHROPIC_API_KEY ist der Belegscan ausgeblendet
      TEST_FEATURES_DEFAULT: "true",
      EXCHANGE_RATE_PROVIDER: "static",
      EXCHANGE_RATES_STATIC: '{"USD":1.25,"JPY":160}',
      ANTHROPIC_API_KEY: "",
      SMTP_URL: pathToFileURL(MAIL_DIR).href,
      MAIL_FROM: "Finantsen <noreply@example.test>",
    },
  },
});
