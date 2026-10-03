import { expect, test, type Page } from "@playwright/test";

const PASSWORD = "supersecret1";

async function register(page: Page, name: string, email: string, url = "/register") {
  await page.goto(url);
  await page.getByLabel("Name").fill(name);
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("button", { name: "Sign up" }).click();
}

test.describe.configure({ mode: "serial" });

let inviteLink = "";
let groupUrl = "";

test("health endpoint and PWA assets", async ({ request }) => {
  const h = await request.get("/api/health");
  expect(h.ok()).toBeTruthy();
  expect(await h.json()).toMatchObject({ status: "ok" });
  const m = await request.get("/manifest.webmanifest");
  expect((await m.json()).display).toBe("standalone");
  expect((await request.get("/sw.js")).ok()).toBeTruthy();
  expect((await request.get("/icons/icon-512.png")).ok()).toBeTruthy();
});

test("unauthenticated users are redirected to login", async ({ page, request }) => {
  await page.goto("/");
  await expect(page).toHaveURL(/\/login/);
  expect((await request.get("/api/groups")).status()).toBe(401);
});

test("first user becomes admin, creates group and invite", async ({ page }) => {
  await register(page, "Anna", "anna@example.com");
  await expect(page).toHaveURL("/");
  await page.getByRole("link", { name: "New group" }).click();
  await page.getByLabel("Group name").fill("Ski trip");
  await page.getByRole("button", { name: "Create group" }).click();
  await expect(page.getByRole("heading", { name: "Ski trip" })).toBeVisible();
  groupUrl = new URL(page.url()).pathname;

  await page.getByRole("tab", { name: "Members" }).click();
  await page.getByRole("button", { name: "Invite a member" }).click();
  inviteLink = await page.getByTestId("invite-link").inputValue();
  expect(inviteLink).toContain("/join/");
});

test("second user registers via invite (registration is disabled otherwise)", async ({ page }) => {
  await page.goto("/register");
  await expect(page.getByText("Registration is disabled")).toBeVisible();
  await page.goto(inviteLink);
  await page.getByRole("link", { name: "Sign up" }).click();
  await page.getByLabel("Name").fill("Ben");
  await page.getByLabel("Email").fill("ben@example.com");
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("button", { name: "Sign up" }).click();
  await expect(page).toHaveURL(groupUrl);
  await expect(page.getByRole("heading", { name: "Ski trip" })).toBeVisible();
});

test("add expense, see balances, settle up", async ({ page, browser, baseURL }) => {
  await page.goto("/login");
  await page.getByLabel("Email").fill("anna@example.com");
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL("/");
  await page.goto(groupUrl);
  await page.getByRole("link", { name: "Add expense" }).click();
  await page.getByLabel("Title").fill("Dinner");
  await page.getByLabel("Amount").fill("30");
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByTestId("expense-item")).toContainText("Dinner");

  await page.getByRole("tab", { name: "Balances" }).click();
  await expect(page.getByTestId("transfers-EUR")).toContainText("Ben owes You");
  await expect(page.getByTestId("transfers-EUR")).toContainText("15.00");

  await page.goto("/");
  await expect(page.getByTestId("total-EUR")).toContainText("15.00");

  // Ben settles
  const ben = await browser.newContext({ baseURL, locale: "en-US" });
  const bp = await ben.newPage();
  await bp.goto("/login");
  await bp.getByLabel("Email").fill("ben@example.com");
  await bp.getByLabel("Password").fill(PASSWORD);
  await bp.getByRole("button", { name: "Sign in" }).click();
  await expect(bp).toHaveURL("/");
  await bp.goto(`${groupUrl}?tab=balances`);
  await bp.getByRole("link", { name: "Settle up" }).click();
  await bp.getByRole("button", { name: "Save payment" }).click();
  await expect(bp.getByTestId("settled")).toBeVisible();
  await ben.close();
});

test("percent split validates sum; edit shows history; delete is soft", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Email").fill("anna@example.com");
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL("/");
  await page.goto(`${groupUrl}/expenses/new`);
  await page.getByLabel("Title").fill("Rent");
  await page.getByLabel("Amount").fill("100");
  await page.getByRole("radio", { name: "Percent" }).click();
  await page.getByLabel("Percent Anna").fill("60");
  await page.getByLabel("Percent Ben").fill("30");
  await expect(page.getByTestId("split-hint")).toContainText("Remaining");
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByTestId("error")).toContainText("100 %");
  await page.getByLabel("Percent Ben").fill("40");
  await page.getByRole("button", { name: "Save" }).click();
  await page.getByTestId("expense-item").filter({ hasText: "Rent" }).click();
  await page.getByLabel("Title").fill("Rent January");
  await page.getByRole("button", { name: "Save" }).click();
  await page.getByTestId("expense-item").filter({ hasText: "Rent January" }).click();
  await expect(page.getByTestId("history")).toContainText("Created");
  await expect(page.getByTestId("history")).toContainText("Changed");
  page.once("dialog", (d) => d.accept());
  await page.getByRole("button", { name: "Delete" }).click();
  await expect(page.getByTestId("expense-item").filter({ hasText: "Rent January" })).toHaveCount(0);
});

test("language can be switched to German", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Email").fill("anna@example.com");
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL("/");
  await page.goto("/settings");
  await page.getByLabel("Language").selectOption("de");
  await expect(page.getByRole("heading", { name: "Konto" })).toBeVisible();
});

test("non-members cannot access a group via API", async ({ browser, baseURL }) => {
  const ctx = await browser.newContext({ baseURL });
  const p = await ctx.newPage();
  const res = await p.request.get(`/api${groupUrl}`);
  expect(res.status()).toBe(401);
  await ctx.close();
});
