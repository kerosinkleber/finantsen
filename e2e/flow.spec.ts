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

async function login(page: Page, email: string) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL("/");
}

test("notifications: new expense and comment reach the other member", async ({ page, browser, baseURL }) => {
  await login(page, "ben@example.com");
  await expect(page.getByTestId("unread")).toBeVisible();
  await page.getByTestId("bell").click();
  await expect(page.getByTestId("notification").first()).toContainText("Anna added");
  await page.getByRole("button", { name: "Mark all as read" }).click();
  await expect(page.getByTestId("unread")).toHaveCount(0);

  await page.goto(groupUrl);
  await page.getByTestId("expense-item").filter({ hasText: "Dinner" }).click();
  await page.getByLabel("Write a comment …").fill("Tasty!");
  await page.getByRole("button", { name: "Send" }).click();
  await expect(page.getByTestId("comment")).toContainText("Tasty!");

  const anna = await browser.newContext({ baseURL, locale: "en-US" });
  const ap = await anna.newPage();
  await login(ap, "anna@example.com");
  await expect(ap.getByTestId("unread")).toHaveText("1");
  await ap.getByTestId("bell").click();
  await expect(ap.getByTestId("notification").first()).toContainText("commented on “Dinner”: Tasty!");
  await anna.close();
});

test("search and filter expenses", async ({ page }) => {
  await login(page, "anna@example.com");
  await page.goto(`${groupUrl}/expenses/new`);
  await page.getByLabel("Title").fill("Taxi home");
  await page.getByLabel("Amount").fill("12,50");
  await page.getByLabel("Category").selectOption("transport");
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByTestId("expense-item")).toHaveCount(2);

  await page.goto(`${groupUrl}?tab=expenses&q=taxi`);
  await expect(page.getByTestId("expense-item")).toHaveCount(1);
  await expect(page.getByTestId("expense-item")).toContainText("Taxi home");
  await page.goto(`${groupUrl}?tab=expenses&min=20`);
  await expect(page.getByTestId("expense-item")).toHaveCount(1);
  await expect(page.getByTestId("expense-item")).toContainText("Dinner");
  await page.goto(`${groupUrl}?tab=expenses&category=transport&q=nothing`);
  await expect(page.getByTestId("no-results")).toBeVisible();
});

test("default split pre-fills new expenses", async ({ page }) => {
  await login(page, "anna@example.com");
  await page.goto(`${groupUrl}?tab=members`);
  const box = page.getByTestId("default-split");
  await box.getByLabel("Default split").selectOption("percent");
  await box.getByLabel("Percent Anna").fill("70");
  await box.getByLabel("Percent Ben").fill("30");
  await box.getByRole("button", { name: "Save default" }).click();
  await expect(box.getByRole("button", { name: "Saved" })).toBeVisible();
  await page.goto(`${groupUrl}/expenses/new`);
  await expect(page.getByRole("radio", { name: "Percent" })).toHaveAttribute("aria-checked", "true");
  await expect(page.getByLabel("Percent Anna")).toHaveValue("70");
  await expect(page.getByLabel("Percent Ben")).toHaveValue("30");
});

test("statistics page and push is cleanly disabled without VAPID keys", async ({ page }) => {
  await login(page, "anna@example.com");
  await page.goto(`${groupUrl}?tab=stats`);
  await expect(page.getByTestId("stats-total")).toContainText("42.50");
  await expect(page.getByTestId("stats-category")).toContainText("Transport");
  await expect(page.getByTestId("stats-month")).toBeVisible();
  await expect(page.getByTestId("stats-person")).toContainText("Ben");

  await page.goto("/settings");
  await expect(page.getByTestId("push")).toContainText("not set up");
  const cfg = await page.request.get("/api/push");
  expect(await cfg.json()).toEqual({ enabled: false, publicKey: null });
});
