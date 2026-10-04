import { defineConfig, devices } from "@playwright/test";

const PORT = 3100;
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
      // Feste Kurse statt Netzwerk (Kurse pro 1 EUR); ohne ANTHROPIC_API_KEY ist der Belegscan ausgeblendet
      EXCHANGE_RATE_PROVIDER: "static",
      EXCHANGE_RATES_STATIC: '{"USD":1.25,"JPY":160}',
      ANTHROPIC_API_KEY: "",
    },
  },
});
