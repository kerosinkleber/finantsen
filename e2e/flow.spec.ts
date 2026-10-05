import { expect, test, type Page } from "@playwright/test";
import path from "node:path";
import { base32Decode, stepAt, totpAt } from "../src/server/totp";

const PASSWORD = "Correct-Horse-Battery-9!";

const form = (page: Page) => page.getByTestId("create-user");
const card = (page: Page, username: string) => page.locator(`[data-username="${username}"]`);

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

test("without any account the app leads to the setup page; API stays closed", async ({ page, request }) => {
  await page.goto("/");
  await expect(page).toHaveURL(/\/setup/);
  await page.goto("/login");
  await expect(page).toHaveURL(/\/setup/);
  expect((await request.get("/api/groups")).status()).toBe(401);
  expect((await (await request.get("/api/setup")).json()).needsSetup).toBe(true);
});

test("setup: password policy is shown live, admin account is created and signed in", async ({ page }) => {
  await page.goto("/setup");
  await page.getByLabel("Display name").fill("Anna");
  await page.getByLabel("Username", { exact: true }).fill("anna");
  await page.getByLabel("Email (optional)").fill("anna@example.com");
  const save = page.getByRole("button", { name: "Create admin account" });
  await page.getByLabel("Password", { exact: true }).fill("kurz");
  await expect(page.locator('[data-rule="too_short"]')).toHaveAttribute("data-ok", "false");
  await expect(save).toBeDisabled();
  await page.getByLabel("Password", { exact: true }).fill("Abcdefghijklmnopqrstuvwxyz"); // keine Ziffer, kein Sonderzeichen
  await expect(page.locator('[data-rule="too_short"]')).toHaveAttribute("data-ok", "true");
  await expect(page.locator('[data-rule="no_digit"]')).toHaveAttribute("data-ok", "false");
  await expect(page.locator('[data-rule="no_special"]')).toHaveAttribute("data-ok", "false");
  await page.getByLabel("Password", { exact: true }).fill("anna-" + PASSWORD); // enthält den Nutzernamen
  await expect(page.locator('[data-rule="contains_identity"]')).toHaveAttribute("data-ok", "false");
  await page.getByLabel("Password", { exact: true }).fill(PASSWORD);
  await expect(page.locator('[data-ok="false"]')).toHaveCount(0);
  await page.getByLabel("Repeat password").fill(PASSWORD + "x");
  await expect(save).toBeDisabled();
  await page.getByLabel("Repeat password").fill(PASSWORD);
  await save.click();
  await expect(page).toHaveURL("/");
  // danach ist die Einrichtung nicht mehr erreichbar
  await page.goto("/setup");
  await expect(page).not.toHaveURL(/\/setup/);
});

test("signed-in admin creates a group and an invite link", async ({ page }) => {
  await login(page, "anna");
  await page.getByRole("link", { name: "New group" }).click();
  await page.getByLabel("Group name").fill("Ski trip");
  await page.getByRole("button", { name: "Create group" }).click();
  await expect(page.getByRole("heading", { name: "Ski trip" })).toBeVisible();
  groupUrl = new URL(page.url()).pathname;

  await page.getByRole("tab", { name: "Members" }).click();
  await page.getByRole("button", { name: "Invite a member" }).click();
  inviteLink = await page.getByTestId("invite-link").inputValue();
  expect(inviteLink).toContain("/join/");
  await expect(page.getByTestId("qr")).toBeVisible(); // QR-Code zum Link
});

test("admin creates Ben with a one-time link; Ben sets his own password and joins the group", async ({ page, browser, baseURL }) => {
  // Selbstregistrierung ist standardmäßig aus (anonym geprüft)
  const anon = await browser.newContext({ baseURL, locale: "en-US" });
  const ap = await anon.newPage();
  await ap.goto("/register");
  await expect(ap.getByTestId("register-disabled")).toBeVisible();
  expect((await ap.request.post("/api/auth/register", { data: { name: "X", username: "xxx", password: PASSWORD } })).status()).toBe(403);
  await anon.close();

  await login(page, "anna");
  await page.goto("/admin/users");
  await form(page).getByLabel("Display name").fill("Ben");
  await form(page).getByLabel("Username", { exact: true }).fill("ben");
  await form(page).getByLabel("Email (optional)").fill("ben@example.com");
  await form(page).getByRole("button", { name: "Create account" }).click();
  const link = await page.getByTestId("activation-link").inputValue();
  expect(link).toContain("/activate/");
  await expect(page.locator('[data-username="ben"] [data-testid="status"]')).toHaveText("Invitation open");

  // Ben öffnet den Link (kein Konto, eigener Browserkontext), wählt sein Passwort und tritt per Einladung bei
  const ctx = await browser.newContext({ baseURL, locale: "en-US" });
  const bp = await ctx.newPage();
  await bp.goto(link);
  await expect(bp.getByText("Hello Ben!")).toBeVisible();
  await bp.getByLabel("Password", { exact: true }).fill("ben-" + PASSWORD);
  await expect(bp.getByRole("button", { name: "Save password and sign in" })).toBeDisabled(); // enthält Nutzernamen
  await bp.getByLabel("Password", { exact: true }).fill(PASSWORD);
  await bp.getByLabel("Repeat password").fill(PASSWORD);
  await bp.getByRole("button", { name: "Save password and sign in" }).click();
  await expect(bp).toHaveURL("/");
  // Der Link ist verbraucht
  await bp.context().clearCookies();
  await bp.goto(link);
  await expect(bp.getByTestId("link-invalid")).toBeVisible();
  await login(bp, "ben@example.com"); // Anmeldung auch per E-Mail
  await bp.goto(inviteLink);
  await bp.getByRole("button", { name: "Accept invitation" }).click();
  await expect(bp).toHaveURL(groupUrl);
  await expect(bp.getByRole("heading", { name: "Ski trip" })).toBeVisible();
  await ctx.close();
});

test("add expense, see balances, settle up", async ({ page, browser, baseURL }) => {
  await page.goto("/login");
  await page.getByLabel("Username or email").fill("anna@example.com");
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
  await expect(page.getByTestId("transfers-EUR")).toContainText("Ben owes you");
  await expect(page.getByTestId("transfers-EUR")).toContainText("15.00");

  await page.goto("/");
  await expect(page.getByTestId("total-EUR")).toContainText("15.00");

  // Ben settles
  const ben = await browser.newContext({ baseURL, locale: "en-US" });
  const bp = await ben.newPage();
  await bp.goto("/login");
  await bp.getByLabel("Username or email").fill("ben@example.com");
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
  await page.getByLabel("Username or email").fill("anna@example.com");
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
  // Bestätigung im Seitenfenster: Abbrechen löscht nichts, Bestätigen schon
  await page.getByRole("button", { name: "Delete" }).click();
  await page.getByTestId("confirm-no").click();
  await expect(page.getByTestId("confirm-dialog")).toHaveCount(0);
  await expect(page.getByTestId("history")).toBeVisible();
  await page.getByRole("button", { name: "Delete" }).click();
  await page.getByTestId("confirm-yes").click();
  await expect(page.getByTestId("expense-item").filter({ hasText: "Rent January" })).toHaveCount(0);

  // Papierkorb: gelöschte Ausgabe wiederherstellen
  await expect(page.getByTestId("trash")).toBeVisible();
  await page.getByTestId("trash").locator("summary").click();
  await expect(page.getByTestId("trash-item")).toContainText("Rent January");
  await page.getByTestId("trash-item").getByTestId("restore").click();
  await expect(page.getByTestId("expense-item").filter({ hasText: "Rent January" })).toHaveCount(1);
  await expect(page.getByTestId("trash")).toHaveCount(0);
  await page.getByTestId("expense-item").filter({ hasText: "Rent January" }).click();
  await expect(page.getByTestId("history")).toContainText("Restored");
  // wieder löschen, damit die folgenden Tests denselben Ausgangszustand sehen
  await page.getByRole("button", { name: "Delete" }).click();
  await page.getByTestId("confirm-yes").click();
  await expect(page.getByTestId("expense-item").filter({ hasText: "Rent January" })).toHaveCount(0);
});

test("language can be switched to German", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Username or email").fill("anna@example.com");
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
  await page.getByLabel("Username or email").fill(email);
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL("/");
}

test("notifications: new expense and comment reach the other member", async ({ page, browser, baseURL }) => {
  await login(page, "ben@example.com");
  await expect(page.getByTestId("unread")).toBeVisible();
  await page.getByTestId("bell").click();
  const notes = page.getByTestId("notification");
  await expect(notes.filter({ hasText: "Anna added" }).first()).toBeVisible();
  await expect(notes.filter({ hasText: "Anna restored “Rent January”" })).toHaveCount(1); // aus dem Papierkorb-Test
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

test("foreign currency: automatic rate, conversion preview, manual override", async ({ page }) => {
  await login(page, "anna@example.com");
  await page.goto(`${groupUrl}/expenses/new`);
  await page.getByLabel("Title").fill("Souvenirs");
  await page.getByLabel("Amount").fill("25");
  await page.getByLabel("Currency").selectOption("USD");
  await expect(page.getByTestId("rate-auto")).toContainText("1 USD = 0.8 EUR");
  await expect(page.getByTestId("rate-converted")).toContainText("€20.00");
  await page.getByLabel("Set rate manually").check();
  await page.getByLabel("Own rate: how many EUR is 1 USD?").fill("0,9");
  await expect(page.getByTestId("rate-converted")).toContainText("€22.50");
  await page.getByRole("button", { name: "Save" }).click();
  const item = page.getByTestId("expense-item").filter({ hasText: "Souvenirs" });
  await expect(item).toContainText("$25.00");
  await expect(item.getByTestId("converted")).toContainText("€22.50");

  // gespeicherter Kurs bleibt beim Öffnen erhalten (kein Neuabruf)
  await item.click();
  await expect(page.getByTestId("rate-auto")).toContainText("(manual)");
  await expect(page.getByTestId("rate-converted")).toContainText("€22.50");
});

test("itemized split with tax and tip persists and reloads", async ({ page }) => {
  await login(page, "anna@example.com");
  await page.goto(`${groupUrl}/expenses/new`);
  await page.getByLabel("Title").fill("Dinner out");
  await page.getByRole("radio", { name: "Itemized" }).click();
  await page.getByLabel("Description 1").fill("Pizza");
  await page.getByLabel("Price 1").fill("15");
  await page.getByRole("button", { name: "Ben 1" }).click(); // nur Anna
  await page.getByRole("button", { name: "Add item" }).click();
  await page.getByLabel("Description 2").fill("Wine");
  await page.getByLabel("Price 2").fill("5");
  await page.getByRole("textbox", { name: "Tax" }).fill("2");
  await page.getByRole("textbox", { name: "Tip" }).fill("1");
  await expect(page.getByTestId("items-total")).toContainText("€23.00");
  await expect(page.getByLabel("Amount")).toHaveValue("23.00");
  await page.getByRole("button", { name: "Save" }).click();
  const item = page.getByTestId("expense-item").filter({ hasText: "Dinner out" });
  await expect(item).toContainText("€23.00");
  await item.click();
  await expect(page.getByTestId("item-row")).toHaveCount(2);
  await expect(page.getByLabel("Description 1")).toHaveValue("Pizza");
  await expect(page.getByTestId("items-total")).toContainText("€23.00");
});

test("itemized split: item without a person is rejected client-side", async ({ page }) => {
  await login(page, "anna@example.com");
  await page.goto(`${groupUrl}/expenses/new`);
  await page.getByLabel("Title").fill("Broken");
  await page.getByRole("radio", { name: "Itemized" }).click();
  await page.getByLabel("Price 1").fill("5");
  await page.getByLabel("Description 1").fill("x");
  await page.getByRole("button", { name: "Anna 1" }).click();
  await page.getByRole("button", { name: "Ben 1" }).click();
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByTestId("error")).toContainText("At least one person");
});

test("receipt scan is hidden without an API key; endpoint reports disabled", async ({ page }) => {
  await login(page, "anna@example.com");
  await page.goto(`${groupUrl}/expenses/new`);
  await expect(page.getByLabel("Title")).toBeVisible();
  await expect(page.getByTestId("scan")).toHaveCount(0);
  expect(await (await page.request.get("/api/receipts/scan")).json()).toEqual({ enabled: false });
  const res = await page.request.post("/api/receipts/scan", { data: { image: "AAAA" } });
  expect(res.status()).toBe(503);
});

test("currency list offers more than the common currencies and rejects unknown codes", async ({ page }) => {
  await login(page, "anna@example.com");
  const list = await (await page.request.get("/api/currencies")).json();
  expect(list.currencies).toEqual(expect.arrayContaining(["EUR", "USD", "JPY"]));
  const bad = await page.request.post(`/api${groupUrl}/expenses`, {
    data: { title: "x", amountMinor: 100, currency: "XXZ", date: "2026-01-01", category: "other", payers: [{ userId: crypto.randomUUID(), amountMinor: 100 }], split: { type: "full", owner: crypto.randomUUID() } },
  });
  expect(bad.status()).toBe(400);
});

test("receipt scan (mocked API): photo is uploaded downscaled and pre-fills an editable itemized form", async ({ page }) => {
  let uploaded: { image: string; fallbackCurrency: string } | null = null;
  await page.route("**/api/receipts/scan", async (route) => {
    if (route.request().method() === "GET") return route.fulfill({ json: { enabled: true } });
    uploaded = route.request().postDataJSON();
    return route.fulfill({
      json: {
        receipt: {
          merchant: "Trattoria Roma",
          date: "2026-02-03",
          currency: "EUR",
          items: [{ name: "Pasta", amountMinor: 1200 }, { name: "Vino", amountMinor: 800 }],
          taxMinor: 0,
          tipMinor: 200,
          totalMinor: 2300, // absichtlich falsch: erzeugt den Abweichungshinweis
          mismatch: true,
          dropped: 0,
        },
      },
    });
  });
  await login(page, "anna@example.com");
  await page.goto(`${groupUrl}/expenses/new`);
  await expect(page.getByTestId("scan")).toBeVisible();
  await page.getByTestId("scan-input").setInputFiles("public/icons/icon-512.png");
  await expect(page.getByTestId("scan-info")).toContainText("Trattoria Roma");
  await expect(page.getByTestId("scan-info")).toContainText("do not add up");
  expect(uploaded!.image.startsWith("/9j/")).toBe(true); // JPEG nach dem Verkleinern
  expect(uploaded!.fallbackCurrency).toBe("EUR");
  // Formular ist vorbelegt, aber noch nichts gespeichert und alles editierbar
  await expect(page.getByLabel("Title")).toHaveValue("Trattoria Roma");
  await expect(page.getByLabel("Date")).toHaveValue("2026-02-03");
  await expect(page.getByRole("radio", { name: "Itemized" })).toHaveAttribute("aria-checked", "true");
  await expect(page.getByTestId("item-row")).toHaveCount(2);
  await expect(page.getByTestId("items-total")).toContainText("€22.00");
  await page.getByLabel("Price 2").fill("9");
  await expect(page.getByTestId("items-total")).toContainText("€23.00");
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByTestId("expense-item").filter({ hasText: "Trattoria Roma" })).toContainText("€23.00");
});


test("admin sets a password with forced change: user must change it before anything else", async ({ page, browser, baseURL }) => {
  await login(page, "anna");
  await page.goto("/admin/users");
  await form(page).getByLabel("Display name").fill("Cleo");
  await form(page).getByLabel("Username", { exact: true }).fill("cleo");
  await form(page).getByLabel("I set the password").check();
  await form(page).getByLabel("Password", { exact: true }).fill("Initial-Start-Passphrase-1!");
  await form(page).getByRole("button", { name: "Create account" }).click();
  await expect(card(page, "cleo").getByTestId("status")).toHaveText("Active");
  await expect(card(page, "cleo")).toContainText("Password change required");

  const ctx = await browser.newContext({ baseURL, locale: "en-US" });
  const cp = await ctx.newPage();
  await cp.goto("/login");
  await cp.getByLabel("Username or email").fill("CLEO"); // Groß-/Kleinschreibung egal
  await cp.getByLabel("Password").fill("Initial-Start-Passphrase-1!");
  await cp.getByRole("button", { name: "Sign in" }).click();
  await expect(cp).toHaveURL(/\/change-password/);
  await expect(cp.getByTestId("must-change")).toBeVisible();
  // bis zur Änderung ist alles andere gesperrt (Seiten und API)
  await cp.goto("/");
  await expect(cp).toHaveURL(/\/change-password/);
  expect((await cp.request.get("/api/groups")).status()).toBe(403);
  // Änderung: aktuelles Passwort nötig, neues muss sich unterscheiden
  await cp.getByLabel("Current password").fill("Initial-Start-Passphrase-1!");
  await cp.getByLabel("New password").fill("Initial-Start-Passphrase-1!");
  await cp.getByLabel("Repeat password").fill("Initial-Start-Passphrase-1!");
  await cp.getByRole("button", { name: "Change password" }).click();
  await expect(cp.getByTestId("error")).toContainText("must differ");
  await cp.getByLabel("New password").fill("My-Own-Fresh-Passphrase-2?");
  await cp.getByLabel("Repeat password").fill("My-Own-Fresh-Passphrase-2?");
  await cp.getByRole("button", { name: "Change password" }).click();
  await expect(cp).toHaveURL("/");
  expect((await cp.request.get("/api/groups")).status()).toBe(200);
  await ctx.close();
});

test("self-registration: off by default; when enabled accounts wait for approval", async ({ page, browser, baseURL }) => {
  await login(page, "anna");
  await page.goto("/admin/users");
  const settings = page.getByTestId("admin-settings");
  await expect(settings.getByLabel("Allow self-registration")).not.toBeChecked();
  await settings.getByLabel("Allow self-registration").check();
  await expect(settings.getByRole("status")).toBeVisible();

  const ctx = await browser.newContext({ baseURL, locale: "en-US" });
  const gp = await ctx.newPage();
  await gp.goto("/login");
  await gp.getByRole("link", { name: "Sign up" }).click();
  await gp.getByLabel("Display name").fill("Gast");
  await gp.getByLabel("Username", { exact: true }).fill("gast");
  await gp.getByLabel("Password", { exact: true }).fill(PASSWORD);
  await gp.getByLabel("Repeat password").fill(PASSWORD);
  await gp.getByRole("button", { name: "Sign up" }).click();
  await expect(gp.getByTestId("register-pending")).toBeVisible();
  const tryLogin = async () => {
    await gp.goto("/login");
    await gp.getByLabel("Username or email").fill("gast");
    await gp.getByLabel("Password").fill(PASSWORD);
    await gp.getByRole("button", { name: "Sign in" }).click();
  };
  await tryLogin();
  await expect(gp.getByTestId("error")).toContainText("waiting for approval");

  await page.reload();
  await expect(card(page, "gast").getByTestId("status")).toHaveText("Awaiting approval");
  await card(page, "gast").getByRole("button", { name: "Approve" }).click();
  await expect(card(page, "gast").getByTestId("status")).toHaveText("Active");
  await tryLogin();
  await expect(gp).toHaveURL("/");

  // wieder ausschalten: Seite zeigt Hinweis
  await settings.getByLabel("Allow self-registration").uncheck();
  await expect(settings.getByRole("status")).toBeVisible();
  const anon = await browser.newContext({ baseURL, locale: "en-US" });
  const ap = await anon.newPage();
  await ap.goto("/register");
  await expect(ap.getByTestId("register-disabled")).toBeVisible();
  await ctx.close();
  await anon.close();
});

test("disable ends sessions and blocks login; last admin cannot be removed", async ({ page, browser, baseURL }) => {
  await login(page, "anna");
  await page.goto("/admin/users");
  // Gast ist eingeloggt (eigener Kontext), dann deaktivieren
  const ctx = await browser.newContext({ baseURL, locale: "en-US" });
  const gp = await ctx.newPage();
  await gp.goto("/login");
  await gp.getByLabel("Username or email").fill("gast");
  await gp.getByLabel("Password").fill(PASSWORD);
  await gp.getByRole("button", { name: "Sign in" }).click();
  await expect(gp).toHaveURL("/");

  await page.addLocatorHandler(page.getByTestId("confirm-yes"), (l) => l.click()); // Bestätigungsfenster annehmen
  await card(page, "gast").getByRole("button", { name: "Disable" }).click();
  await expect(card(page, "gast").getByTestId("status")).toHaveText("Disabled");
  expect((await gp.request.get("/api/groups")).status()).toBe(401); // Sitzung sofort beendet
  await gp.goto("/login");
  await gp.getByLabel("Username or email").fill("gast");
  await gp.getByLabel("Password").fill(PASSWORD);
  await gp.getByRole("button", { name: "Sign in" }).click();
  await expect(gp.getByTestId("error")).toContainText("disabled");
  await card(page, "gast").getByRole("button", { name: "Enable" }).click();
  await expect(card(page, "gast").getByTestId("status")).toHaveText("Active");
  await ctx.close();

  // eigenes Konto hat keinen "Disable"-Knopf; der letzte Admin kann sich nicht degradieren
  await expect(card(page, "anna").getByRole("button", { name: "Disable" })).toHaveCount(0);
  await card(page, "anna").getByRole("button", { name: "Remove admin rights" }).click();
  await expect(card(page, "anna").getByTestId("error")).toContainText("At least one active administrator");
});

test("duplicate emails: refused by default; when allowed, login asks which account", async ({ page, browser, baseURL }) => {
  await login(page, "anna");
  await page.goto("/admin/users");
  const create = async (username: string) => {
    await form(page).getByLabel("Display name").fill(username);
    await form(page).getByLabel("Username", { exact: true }).fill(username);
    await form(page).getByLabel("Email (optional)").fill("ben@example.com");
    await form(page).getByLabel("I set the password").check();
    await form(page).getByLabel("Password", { exact: true }).fill(PASSWORD);
    await form(page).getByLabel("Require a password change at first sign-in").uncheck();
    await form(page).getByRole("button", { name: "Create account" }).click();
  };
  await create("ben2");
  await expect(form(page).getByTestId("error")).toContainText("already registered");

  const settings = page.getByTestId("admin-settings");
  await settings.getByLabel("Allow multiple accounts per email address").check();
  await expect(settings.getByRole("status")).toBeVisible();
  await create("ben2");
  await expect(card(page, "ben2")).toBeVisible();

  const ctx = await browser.newContext({ baseURL, locale: "en-US" });
  const lp = await ctx.newPage();
  await lp.goto("/login");
  await lp.getByLabel("Username or email").fill("ben@example.com");
  await lp.getByLabel("Password").fill(PASSWORD);
  await lp.getByRole("button", { name: "Sign in" }).click();
  const picker = lp.getByTestId("account-picker");
  await expect(picker).toContainText("@ben2");
  await expect(picker).toContainText("@ben");
  await picker.getByText("@ben2").click();
  await lp.getByRole("button", { name: "Sign in" }).click();
  await expect(lp).toHaveURL("/");
  await lp.goto("/settings");
  await expect(lp.getByText("@ben2")).toBeVisible();
  await expect(lp.getByTestId("admin-link")).toHaveCount(0); // kein Admin
  expect((await lp.request.get("/api/admin/settings")).status()).toBe(403);
  expect((await lp.request.get("/api/admin/users")).status()).toBe(403);
  await ctx.close();
});

test("one-time reset link for an active user sets a new password and ends his sessions", async ({ page, browser, baseURL }) => {
  await login(page, "anna");
  await page.goto("/admin/users");
  await card(page, "cleo").getByRole("button", { name: "Create new one-time link" }).click();
  const link = await page.getByTestId("activation-link").inputValue();

  const ctx = await browser.newContext({ baseURL, locale: "en-US" });
  const cp = await ctx.newPage();
  await cp.goto("/login");
  await cp.getByLabel("Username or email").fill("cleo");
  await cp.getByLabel("Password").fill("My-Own-Fresh-Passphrase-2?");
  await cp.getByRole("button", { name: "Sign in" }).click();
  await expect(cp).toHaveURL("/");
  const other = await browser.newContext({ baseURL });
  const op = await other.newPage();
  await op.goto(link);
  await expect(op.getByRole("heading", { name: "Set a new password" })).toBeVisible();
  await op.getByLabel("Password", { exact: true }).fill("Reset-By-Link-Passphrase-3#");
  await op.getByLabel("Repeat password").fill("Reset-By-Link-Passphrase-3#");
  await op.getByRole("button", { name: "Save password and sign in" }).click();
  await expect(op).toHaveURL("/");
  expect((await cp.request.get("/api/groups")).status()).toBe(401); // alte Sitzung beendet
  await ctx.close();
  await other.close();
});

// ---------------------------------------------------------------- Admin-Testfunktionen

test("test users: create, edit memberships on one page, act as them, banner and audit trail", async ({ page }) => {
  await page.addLocatorHandler(page.getByTestId("confirm-yes"), (l) => l.click()); // Warnungen („echte Mitglieder“) bestätigen
  await login(page, "anna");
  await page.goto("/admin/users");
  await page.getByTestId("test-users-link").click();
  await expect(page.getByRole("heading", { name: "Test users", exact: true })).toBeVisible();
  await page.getByLabel("Number").fill("2");
  await page.getByTestId("test-create").getByRole("button", { name: "Create", exact: true }).click();
  await expect(page.getByTestId("test-user")).toHaveCount(2);
  await expect(page.locator('[data-username="test-1"]')).toContainText("Test");

  // Bearbeiten: eine Seite für Profil, Gruppen, Rolle, Freundschaft
  await page.locator('[data-username="test-1"]').getByRole("link", { name: "Edit" }).click();
  await page.getByLabel("Display name").fill("Tessa");
  await page.getByLabel("Language").selectOption("en");
  await page.getByTestId("test-profile").getByRole("button", { name: "Save" }).click();
  await expect(page.getByTestId("test-profile").getByRole("status")).toBeVisible();
  await page.getByLabel("Choose a group").selectOption({ label: "Ski trip ⚠" }); // ⚠ = echte Mitglieder
  await page.getByRole("button", { name: "Add", exact: true }).click();
  const m = page.locator('[data-testid="membership"][data-group="Ski trip"]');
  await expect(m).toBeVisible();
  await expect(m).toContainText("Real members");
  await page.getByLabel("Role Ski trip").selectOption("owner");
  await expect(page.getByLabel("Role Ski trip")).toHaveValue("owner");
  await page.getByLabel("Choose an account").selectOption({ label: "Test 2 (Test)" });
  await page.getByRole("button", { name: "Connect" }).click();
  await expect(page.locator('[data-testid="membership"][data-group="Test 2 (Test)"]')).toContainText("Friendship");

  // Handeln als: Banner, App aus Sicht des Testnutzers, Admin-Bereich gesperrt
  await page.getByRole("button", { name: "Act as", exact: true }).click();
  await expect(page.getByTestId("acting-banner")).toContainText("Tessa");
  await page.goto(groupUrl);
  await expect(page.getByRole("heading", { name: "Ski trip" })).toBeVisible();
  await page.getByRole("tab", { name: "Members" }).click();
  await expect(page.getByText("Tessa (Test) (You)")).toBeVisible(); // Kennzeichnung für alle
  await page.goto(`${groupUrl}/expenses/new`);
  await page.getByLabel("Title").fill("Taxi by Tessa");
  await page.getByLabel("Amount").fill("10");
  await page.getByRole("button", { name: "Save" }).click();
  const item = page.getByTestId("expense-item").filter({ hasText: "Taxi by Tessa" });
  await expect(item).toContainText("You paid €10.00"); // Sicht des Testnutzers
  await item.click();
  await expect(page.getByTestId("history")).toContainText("Tessa (Test)");
  await expect(page.getByTestId("acted-by")).toContainText("by Anna as admin");
  await page.getByLabel("Write a comment …").fill("Kommentar als Testnutzer");
  await page.getByRole("button", { name: "Send" }).click();
  await expect(page.getByTestId("comment")).toContainText("by Anna as admin");
  expect((await page.request.get("/api/admin/settings")).status()).toBe(403); // als Testnutzer kein Admin
  expect((await page.request.post("/api/admin/test-users", { data: { count: 1 } })).status()).toBe(403);
  await page.goto("/admin/users");
  await expect(page).toHaveURL("/"); // Admin-Seiten sind gesperrt

  // zurück zum Admin
  await page.getByTestId("acting-banner").getByRole("button", { name: "Back to admin" }).click();
  await expect(page).toHaveURL(/\/admin\/test-users\/[0-9a-f-]+$/);
  await expect(page.getByTestId("acting-banner")).toHaveCount(0);
  expect((await page.request.get("/api/admin/settings")).status()).toBe(200);
});

test("test users: cannot sign in, never reachable as real accounts, only real admins can use the tools", async ({ page, browser, baseURL }) => {
  const anon = await browser.newContext({ baseURL, locale: "en-US" });
  const ap = await anon.newPage();
  for (const identifier of ["test-1", "test-2"]) {
    const r = await ap.request.post("/api/auth/login", { data: { identifier, password: PASSWORD } });
    expect(r.status()).toBe(401);
  }
  await anon.close();

  await login(page, "anna");
  const users = (await (await page.request.get("/api/admin/users")).json()).users as { id: string; username: string }[];
  expect(users.some((u) => u.username.startsWith("test-"))).toBe(false); // nicht in der echten Nutzerliste
  const ben = users.find((u) => u.username === "ben")!;
  // „Handeln als“ nie für echte Konten
  expect((await page.request.post("/api/admin/act", { data: { userId: ben.id } })).status()).toBe(404);
  expect((await page.request.post(`/api/admin/test-users/${ben.id}/membership`, { data: { action: "removeGroup", groupId: crypto.randomUUID() } })).status()).toBe(404);
  expect((await page.request.patch(`/api/admin/test-users/${ben.id}`, { data: { name: "Hack" } })).status()).toBe(404);
  expect((await page.request.delete(`/api/admin/test-users/${ben.id}`)).status()).toBe(404);
  // kein Einmal-Link, kein Passwort für Testnutzer
  const tests = (await (await page.request.get("/api/admin/test-users")).json()).users as { id: string; username: string }[];
  const t1 = tests.find((u) => u.username === "test-1")!;
  expect((await page.request.post(`/api/admin/users/${t1.id}`, { data: { action: "link" } })).status()).toBe(404);
  expect((await page.request.post(`/api/admin/users/${t1.id}`, { data: { action: "setPassword", password: PASSWORD, mustChange: false } })).status()).toBe(404);

  // Ben (kein Admin) kommt an nichts heran
  const bctx = await browser.newContext({ baseURL, locale: "en-US" });
  const bp = await bctx.newPage();
  await login(bp, "ben"); // per Nutzername (die E-Mail ist durch den Dubletten-Test mehrfach vergeben)
  expect((await bp.request.get("/api/admin/test-users")).status()).toBe(403);
  expect((await bp.request.post("/api/admin/act", { data: { userId: t1.id } })).status()).toBe(403);
  await bp.goto("/admin/test-users");
  await expect(bp).toHaveURL("/");
  // Ben sieht den Testnutzer in der Gruppe gekennzeichnet
  await bp.goto(`${groupUrl}?tab=members`);
  await expect(bp.getByText("Tessa (Test)").first()).toBeVisible();
  await bctx.close();
});

test("test users: delete is blocked while data sits in groups with real users, otherwise cleans up", async ({ page }) => {
  await page.addLocatorHandler(page.getByTestId("confirm-yes"), (l) => l.click()); // Bestätigungsfenster annehmen
  await login(page, "anna");
  await page.goto("/admin/test-users");
  // test-2 hat nur eine Freundschaft mit test-1 (keine Daten): löschbar
  await page.locator('[data-username="test-2"]').getByRole("link", { name: "Edit" }).click();
  await page.getByRole("button", { name: "Delete test user" }).click();
  await expect(page).toHaveURL(/\/admin\/test-users$/);
  await expect(page.locator('[data-username="test-2"]')).toHaveCount(0);
  // test-1 hat Ausgabe und Kommentar in „Ski trip“ (mit echten Nutzern): blockiert
  await page.locator('[data-username="test-1"]').getByRole("link", { name: "Edit" }).click();
  await page.getByRole("button", { name: "Delete test user" }).click();
  const blocked = page.getByTestId("delete-blocked");
  await expect(blocked).toContainText("Ski trip");
  await expect(blocked).toContainText("Anna");
  await page.goto("/admin/test-users");
  await expect(page.locator('[data-username="test-1"]')).toBeVisible(); // nichts wurde gelöscht
  // Aus der Gruppe entfernen (mit offenem Saldo nach Bestätigung); die Ausgabe bleibt, daher bleibt das Löschen blockiert
  await page.locator('[data-username="test-1"]').getByRole("link", { name: "Edit" }).click();
  await page.locator('[data-testid="membership"][data-group="Ski trip"]').getByRole("button", { name: "Remove" }).click();
  await expect(page.locator('[data-testid="membership"][data-group="Ski trip"]')).toHaveCount(0);
  await page.goto(groupUrl);
  await expect(page.getByTestId("expense-item").filter({ hasText: "Taxi by Tessa" })).toBeVisible();
});

test("test features switch: off locks everything, on restores it", async ({ page }) => {
  await login(page, "anna");
  await page.goto("/admin/users");
  const settings = page.getByTestId("admin-settings");
  await expect(settings.getByLabel("Test features")).toBeChecked(); // lokal/E2E: Standard an
  await settings.getByLabel("Test features").uncheck();
  await expect(settings.getByRole("status")).toBeVisible();
  await expect(page.getByTestId("test-users-link")).toHaveCount(1); // Seite noch alt; neu laden
  await page.reload();
  await expect(page.getByTestId("test-users-link")).toHaveCount(0);
  await page.goto("/admin/test-users");
  await expect(page.getByTestId("test-disabled")).toBeVisible();
  expect((await page.request.get("/api/admin/test-users")).status()).toBe(403);
  expect((await page.request.post("/api/admin/test-users", { data: { count: 1 } })).status()).toBe(403);
  await page.goto("/admin/users");
  await page.getByTestId("admin-settings").getByLabel("Test features").check();
  await expect(page.getByTestId("admin-settings").getByRole("status")).toBeVisible();
  expect((await page.request.get("/api/admin/test-users")).status()).toBe(200);
});

test("display name is optional (defaults to the username); dev admin sign-in does not exist in normal mode", async ({ page, browser, baseURL }) => {
  await login(page, "anna");
  await page.goto("/admin/users");
  await form(page).getByLabel("Username", { exact: true }).fill("kai");
  await form(page).getByRole("button", { name: "Create account" }).click();
  await expect(card(page, "kai")).toContainText("kai"); // Anzeigename = Nutzername
  await expect(card(page, "kai").locator("span.font-medium")).toHaveText("kai");
  await form(page).getByLabel("Username", { exact: true }).fill("kim");
  await form(page).getByLabel("Display name").fill("Kim Meier");
  await form(page).getByRole("button", { name: "Create account" }).click();
  await expect(card(page, "kim").locator("span.font-medium")).toHaveText("Kim Meier");

  // ohne DEV_ADMIN gibt es die passwortlose Anmeldung nicht: Route 404, kein Knopf
  const anon = await browser.newContext({ baseURL, locale: "en-US" });
  const ap = await anon.newPage();
  expect((await ap.request.post("/api/dev/login")).status()).toBe(404);
  await ap.goto("/login");
  await expect(ap.getByLabel("Username or email")).toBeVisible();
  await expect(ap.getByTestId("dev-admin")).toHaveCount(0);
  await anon.close();
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Your total balance" })).toBeVisible();
  await expect(page.getByTestId("dev-banner")).toHaveCount(0); // kein Entwicklungsbanner im Normalbetrieb
});

test("two-factor: admin requires it, user must set it up, signs in with code and recovery code, admin resets", async ({ page, browser, baseURL }) => {
  await login(page, "anna");
  await page.goto("/admin/users");
  await form(page).getByLabel("Username", { exact: true }).fill("tom");
  await form(page).getByLabel("I set the password").check();
  await form(page).getByLabel("Password", { exact: true }).fill(PASSWORD);
  await form(page).getByLabel("Require a password change at first sign-in").uncheck();
  await form(page).getByRole("button", { name: "Create account" }).click();
  await expect(card(page, "tom")).toBeVisible();
  await card(page, "tom").getByTestId("toggle-totp-required").click();
  await expect(card(page, "tom").getByTestId("badge-totp-required")).toBeVisible();

  // Tom: nach dem Passwort geht erst einmal nur die Einrichtung
  const ctx = await browser.newContext({ baseURL, locale: "en-US" });
  const tp = await ctx.newPage();
  await tp.goto("/login");
  await tp.getByLabel("Username or email").fill("tom");
  await tp.getByLabel("Password").fill(PASSWORD);
  await tp.getByRole("button", { name: "Sign in" }).click();
  await expect(tp).toHaveURL(/two-factor/);
  await expect(tp.getByTestId("totp-forced")).toBeVisible();
  await expect(tp.getByTestId("logout")).toBeVisible(); // wer kein Gerät hat, kann sich wenigstens abmelden
  expect((await tp.request.get("/api/groups")).status()).toBe(403);
  await tp.goto("/");
  await expect(tp).toHaveURL(/two-factor/);

  await tp.getByTestId("totp-start").click();
  await expect(tp.getByTestId("totp-qr")).toBeVisible();
  const secret = base32Decode((await tp.getByTestId("totp-secret").innerText()).trim());
  await tp.getByLabel("Current 6-digit code").fill("000000");
  await tp.getByRole("button", { name: "Confirm and enable" }).click();
  await expect(tp.getByTestId("error")).toContainText("invalid or already used");
  await tp.getByLabel("Current 6-digit code").fill(totpAt(secret, stepAt() - 1));
  await tp.getByRole("button", { name: "Confirm and enable" }).click();
  await expect(tp.getByTestId("recovery-codes")).toBeVisible();
  const recovery = (await tp.getByTestId("recovery-code").innerText()).trim();
  expect(recovery).toMatch(/^[A-Z2-9]{5}-[A-Z2-9]{5}$/);
  await tp.getByTestId("totp-done").click();
  await expect(tp).toHaveURL("/");

  // Anmeldung: zweiter Schritt, falscher Code, richtiger Code (anderer Zeitschritt als bei der Einrichtung)
  await tp.request.post("/api/auth/logout");
  const signIn = async () => {
    await tp.goto("/login");
    await tp.getByLabel("Username or email").fill("tom");
    await tp.getByLabel("Password").fill(PASSWORD);
    await tp.getByRole("button", { name: "Sign in" }).click();
    await expect(tp.getByTestId("totp-step")).toBeVisible();
  };
  await signIn();
  await tp.getByLabel("Code", { exact: true }).fill("000000");
  await tp.getByRole("button", { name: "Sign in" }).click();
  await expect(tp.getByTestId("error")).toContainText("invalid or already used");
  await tp.getByLabel("Code", { exact: true }).fill(totpAt(secret, stepAt()));
  await tp.getByRole("button", { name: "Sign in" }).click();
  await expect(tp).toHaveURL("/");

  // Verlangt: ausschalten nicht möglich
  await tp.goto("/two-factor");
  await expect(tp.getByTestId("totp-on")).toBeVisible();
  await expect(tp.getByTestId("totp-cannot-disable")).toBeVisible();
  await expect(tp.getByTestId("recovery-remaining")).toContainText("1");

  // Wiederherstellungscode funktioniert einmal
  await tp.request.post("/api/auth/logout");
  await signIn();
  await tp.getByLabel("Code", { exact: true }).fill(recovery);
  await tp.getByRole("button", { name: "Sign in" }).click();
  await expect(tp).toHaveURL("/");
  await tp.request.post("/api/auth/logout");
  await signIn();
  await tp.getByLabel("Code", { exact: true }).fill(recovery);
  await tp.getByRole("button", { name: "Sign in" }).click();
  await expect(tp.getByTestId("error")).toContainText("invalid or already used");

  // Admin setzt zurück: Badge weg, Sitzung beendet, Tom muss neu einrichten
  await tp.getByLabel("Code", { exact: true }).fill(totpAt(secret, stepAt() + 1));
  await tp.getByRole("button", { name: "Sign in" }).click();
  await expect(tp).toHaveURL("/");
  await page.reload();
  await expect(card(page, "tom").getByTestId("badge-totp")).toBeVisible();
  await page.addLocatorHandler(page.getByTestId("confirm-yes"), (l) => l.click()); // Bestätigungsfenster annehmen
  await card(page, "tom").getByTestId("reset-totp").click();
  await expect(card(page, "tom").getByTestId("badge-totp")).toHaveCount(0);
  expect((await tp.request.get("/api/groups")).status()).toBe(401);
  await signInNoTotp(tp);
  await expect(tp).toHaveURL(/two-factor/);
  await ctx.close();
});

async function signInNoTotp(p: Page) {
  await p.goto("/login");
  await p.getByLabel("Username or email").fill("tom");
  await p.getByLabel("Password").fill(PASSWORD);
  await p.getByRole("button", { name: "Sign in" }).click();
}

test("passkeys: add with password, sign in without password or code, mandatory 2FA forces passkey sign-in, admin resets", async ({ page, browser, baseURL }) => {
  await login(page, "anna");
  await page.goto("/admin/users");
  await form(page).getByLabel("Username", { exact: true }).fill("pia");
  await form(page).getByLabel("I set the password").check();
  await form(page).getByLabel("Password", { exact: true }).fill(PASSWORD);
  await form(page).getByLabel("Require a password change at first sign-in").uncheck();
  await form(page).getByRole("button", { name: "Create account" }).click();
  await expect(card(page, "pia")).toBeVisible();

  const ctx = await browser.newContext({ baseURL, locale: "en-US" });
  const pp = await ctx.newPage();
  // virtueller Authenticator (Gerät mit Fingerabdruck/PIN)
  const cdp = await ctx.newCDPSession(pp);
  await cdp.send("WebAuthn.enable");
  await cdp.send("WebAuthn.addVirtualAuthenticator", {
    options: { protocol: "ctap2", transport: "internal", hasResidentKey: true, hasUserVerification: true, isUserVerified: true, automaticPresenceSimulation: true },
  });
  const signInPassword = async () => {
    await pp.goto("/login");
    await pp.getByLabel("Username or email").fill("pia");
    await pp.getByLabel("Password").fill(PASSWORD);
    await pp.getByRole("button", { name: "Sign in", exact: true }).click();
  };
  await signInPassword();
  await expect(pp).toHaveURL("/");

  // hinzufügen: erst Passwort, dann Passkey
  await pp.goto("/two-factor");
  await pp.getByTestId("passkey-add").click();
  await pp.getByLabel("Name (e.g.").fill("Laptop");
  await pp.getByLabel("For safety: current password").fill("Falsches-Passwort-1234!");
  await pp.getByTestId("passkey-create").click();
  await expect(pp.getByTestId("passkeys").getByTestId("error")).toBeVisible();
  await pp.getByLabel("For safety: current password").fill(PASSWORD);
  await pp.getByTestId("passkey-create").click();
  await expect(pp.getByTestId("passkey-item")).toContainText("Laptop");

  // Anmeldung nur mit Passkey (Nutzername genügt)
  await pp.request.post("/api/auth/logout");
  await pp.goto("/login");
  await pp.getByLabel("Username or email").fill("pia");
  await pp.getByTestId("passkey-login").click();
  await expect(pp).toHaveURL("/");

  // Admin verlangt 2FA: Passkey erfüllt es, Passwort-Anmeldung allein ist dann nicht mehr möglich
  await page.reload();
  await expect(card(page, "pia").getByTestId("badge-passkey")).toBeVisible();
  await card(page, "pia").getByTestId("toggle-totp-required").click();
  await expect(card(page, "pia").getByTestId("badge-totp-required")).toBeVisible();
  await pp.request.post("/api/auth/logout");
  await signInPassword();
  await expect(pp.getByTestId("error")).toContainText("sign in with your passkey");
  await pp.goto("/login");
  await pp.getByLabel("Username or email").fill("pia");
  await pp.getByTestId("passkey-login").click();
  await expect(pp).toHaveURL("/"); // kein Zwang zur TOTP-Einrichtung, der Passkey zählt

  // Admin setzt zurück: Passkey weg, Sitzung beendet; bei Zwang muss Pia nun TOTP einrichten
  await page.addLocatorHandler(page.getByTestId("confirm-yes"), (l) => l.click());
  await card(page, "pia").getByTestId("reset-totp").click();
  await expect(card(page, "pia").getByTestId("badge-passkey")).toHaveCount(0);
  expect((await pp.request.get("/api/groups")).status()).toBe(401);
  await signInPassword();
  await expect(pp).toHaveURL(/two-factor/);
  await ctx.close();
});

test("recurring expenses: create with past start books missed dates, shown as automatic; pause; owner-only policy", async ({ page, browser, baseURL }) => {
  await login(page, "anna");
  await page.goto(`${groupUrl}?tab=recurring`);
  await expect(page.getByTestId("recurring-empty")).toBeVisible();
  await page.getByTestId("recurring-new").click();
  await page.getByLabel("Title").fill("Gym");
  await page.getByLabel("Amount").fill("30");
  const d = new Date();
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() - 2);
  await page.getByLabel("First date").fill(d.toISOString().slice(0, 10));
  await expect(page.getByTestId("schedule")).toBeVisible();
  await page.getByRole("button", { name: "Save" }).click();
  // verpasste Termine: erst bestätigen
  await expect(page.getByTestId("confirm-dialog")).toContainText("3 bookings");
  await page.getByTestId("confirm-yes").click();
  await expect(page).toHaveURL(/tab=recurring/);
  await expect(page.getByTestId("recurring-item")).toContainText("Gym");
  await expect(page.getByTestId("recurring-item")).toContainText("monthly");

  await page.goto(`${groupUrl}?tab=expenses`);
  const gym = page.getByTestId("expense-item").filter({ hasText: "Gym" });
  await expect(gym).toHaveCount(3);
  await expect(gym.first().getByTestId("auto-badge")).toBeVisible();
  await gym.first().click();
  await expect(page.getByTestId("auto-note")).toBeVisible();

  // Pausieren und Fortsetzen
  await page.goto(`${groupUrl}?tab=recurring`);
  await page.getByTestId("recurring-toggle").click();
  await expect(page.getByTestId("recurring-paused")).toBeVisible();
  await page.getByTestId("recurring-toggle").click();
  await expect(page.getByTestId("recurring-paused")).toHaveCount(0);

  // Nur Besitzer: Ben sieht die Liste, aber keinen Knopf zum Anlegen
  await page.goto(`${groupUrl}?tab=members`);
  await page.getByTestId("recurring-policy").check();
  await expect(page.getByTestId("recurring-policy")).toBeChecked();
  const ctx = await browser.newContext({ baseURL, locale: "en-US" });
  const bp = await ctx.newPage();
  await login(bp, "ben");
  await bp.goto(`${groupUrl}?tab=recurring`);
  await expect(bp.getByTestId("recurring-item")).toContainText("Gym");
  await expect(bp.getByTestId("recurring-new")).toHaveCount(0);
  await page.getByTestId("recurring-policy").uncheck();
  await ctx.close();
});

test("members without an account: add guest, use in expense, link to an account; archive; CSV and JSON export", async ({ page, browser, baseURL }) => {
  await login(page, "anna");
  await page.goto(`${groupUrl}?tab=members`);
  await page.getByTestId("guests").getByLabel("Name").fill("Grandma");
  await page.getByTestId("guest-add").click();
  await expect(page.getByTestId("guest-item")).toContainText("Grandma");

  // Gast zahlt eine Ausgabe
  await page.goto(`${groupUrl}/expenses/new`);
  await page.getByLabel("Title").fill("Cake");
  await page.getByLabel("Amount").fill("20");
  await page.getByLabel("Paid by").selectOption({ label: "Grandma (guest)" });
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByTestId("expense-item").filter({ hasText: "Cake" })).toContainText("Grandma (guest) paid");

  // Löschen geht nicht, solange Daten da sind
  await page.goto(`${groupUrl}?tab=members`);
  await page.getByTestId("guest-delete").click();
  await page.getByTestId("confirm-yes").click();
  await expect(page.getByTestId("guests").getByTestId("error")).toContainText("still has expenses");

  // Verknüpfungs-Link: ein neues Konto übernimmt den Gast
  await page.getByTestId("guest-link").click();
  const linkUrl = await page.getByTestId("guest-link-url").inputValue();
  await expect(page.getByTestId("guests").getByTestId("qr")).toBeVisible();
  await page.goto("/admin/users");
  await form(page).getByLabel("Username", { exact: true }).fill("gina");
  await form(page).getByLabel("I set the password").check();
  await form(page).getByLabel("Password", { exact: true }).fill(PASSWORD);
  await form(page).getByLabel("Require a password change at first sign-in").uncheck();
  await form(page).getByRole("button", { name: "Create account" }).click();
  await expect(card(page, "gina")).toBeVisible();
  const ctx = await browser.newContext({ baseURL, locale: "en-US" });
  const gp = await ctx.newPage();
  await login(gp, "gina");
  await gp.goto(new URL(linkUrl).pathname);
  await expect(gp.getByText("take over the role of Grandma")).toBeVisible();
  await gp.getByRole("button", { name: "Accept invitation" }).click();
  await expect(gp).toHaveURL(new RegExp(groupUrl));
  await expect(gp.getByTestId("expense-item").filter({ hasText: "Cake" })).toContainText("You paid");
  await ctx.close();
  await page.goto(`${groupUrl}?tab=members`);
  await expect(page.getByTestId("guest-item")).toHaveCount(0);

  // CSV-Export
  const csv = await page.request.get(`/api${groupUrl}/export`, { headers: { "accept-language": "en-US" } }); // wie der Browser beim Download
  expect(csv.status()).toBe(200);
  expect(csv.headers()["content-type"]).toContain("text/csv");
  const text = await csv.text();
  expect(text).toContain("Type,Date,Title");
  expect(text).toContain("Cake");
  expect(text).toContain("gina paid");
  await expect(page.getByTestId("export-csv")).toBeVisible();
  // JSON-Export
  const json = await page.request.get("/api/account/export");
  expect(json.status()).toBe(200);
  const data = await json.json();
  expect(data.format).toBe("finantsen-export/1");
  expect(JSON.stringify(data)).not.toMatch(/passwordHash|totpSecret/);

  // Archiv: nur für mich
  await page.getByTestId("archive-toggle").click();
  // erst navigieren, wenn die Änderung gespeichert ist (sonst bricht die Navigation die Anfrage ab)
  await expect(page.getByTestId("archive-toggle")).toHaveText("Restore from archive");
  await page.goto("/");
  await expect(page.getByTestId("archive")).toBeVisible();
  await expect(page.getByTestId("archive")).toContainText("Ski trip");
  await page.getByTestId("archive").locator("summary").click();
  await page.getByTestId("archive").getByText("Ski trip").click();
  await page.goto(`${groupUrl}?tab=members`);
  await page.getByTestId("archive-toggle").click();
  await expect(page.getByTestId("archive-toggle")).toHaveText("Archive group (just for me)");
  await page.goto("/");
  await expect(page.getByTestId("archive")).toHaveCount(0);
});

test("times are shown in the viewer's time zone everywhere; the service worker registers", async ({ browser, baseURL }) => {
  // Server läuft in UTC, Browser in Tokio (UTC+9): Kommentar und Benachrichtigung müssen dieselbe Ortszeit zeigen
  const ben = await browser.newContext({ baseURL, locale: "en-US", timezoneId: "Asia/Tokyo" });
  const bp = await ben.newPage();
  await login(bp, "ben");
  await bp.goto(groupUrl);
  await bp.getByTestId("expense-item").filter({ hasText: "Dinner" }).first().click();
  await bp.getByLabel("Write a comment …").fill("Time check");
  await bp.getByRole("button", { name: "Send" }).click();
  await expect(bp.getByTestId("comment").filter({ hasText: "Time check" })).toBeVisible();
  await ben.close();

  const anna = await browser.newContext({ baseURL, locale: "en-US", timezoneId: "Asia/Tokyo" });
  const ap = await anna.newPage();
  await login(ap, "anna");
  await ap.goto("/notifications");
  const note = ap.getByTestId("notification").filter({ hasText: "Time check" });
  const noteTime = await note.getByTestId("local-time").innerText();
  await note.click();
  const commentTime = await ap.getByTestId("comment").filter({ hasText: "Time check" }).getByTestId("local-time").innerText();
  const hhmm = (s: string) => s.match(/\d{1,2}:\d{2}/)?.[0];
  expect(hhmm(noteTime)).toBeTruthy();
  expect(hhmm(noteTime)).toBe(hhmm(commentTime));
  // …und zwar Tokio-Zeit, nicht UTC (Stunde wie jetzt oder vor zwei Minuten in Tokio)
  const tokyoHour = (ms: number) => new Date(ms).toLocaleString("en-US", { timeZone: "Asia/Tokyo" }).match(/, (\d{1,2}):/)?.[1];
  expect([tokyoHour(Date.now()), tokyoHour(Date.now() - 120_000)]).toContain(noteTime.match(/, (\d{1,2}):/)?.[1]);
  // Service Worker (Offline-Lesen) ist registriert
  const registered = await ap.evaluate(async () => {
    await Promise.race([navigator.serviceWorker.ready, new Promise((r) => setTimeout(r, 5000))]);
    return !!(await navigator.serviceWorker.getRegistration());
  });
  expect(registered).toBe(true);
  await anna.close();
});

test("QR scanner on the overview: opens, accepts a pasted invitation link, refuses foreign links", async ({ page }) => {
  await login(page, "ben");
  await page.getByTestId("qr-scan-open").click();
  await expect(page.getByTestId("qr-scanner")).toBeVisible();
  await page.getByLabel("Or paste an invitation link").fill("https://evil.example/login");
  await page.getByRole("button", { name: "Open", exact: true }).click();
  await expect(page.getByTestId("qr-scanner").getByRole("alert")).toContainText("not an invitation link");
  const r = await page.request.post(`/api${groupUrl}/invites`);
  const { url } = await r.json();
  await page.getByLabel("Or paste an invitation link").fill(url);
  await page.getByRole("button", { name: "Open", exact: true }).click();
  await expect(page).toHaveURL(/\/join\//);
});

type SentMail = { to: string; subject: string; text: string };
async function mailsTo(to: string): Promise<SentMail[]> {
  const { readdir, readFile } = await import("node:fs/promises");
  const dir = path.resolve(import.meta.dirname, "..", ".e2e-mails");
  const files = (await readdir(dir).catch(() => [] as string[])).sort();
  const all = await Promise.all(files.map(async (f) => JSON.parse(await readFile(path.join(dir, f), "utf8")) as SentMail));
  return all.filter((m) => m.to.toLowerCase() === to.toLowerCase());
}

test("e-mail: admin test mail, forgot password via mailed link, e-mail settings", async ({ page, browser, baseURL }) => {
  await login(page, "anna@example.com");
  await page.goto("/admin/users");
  await expect(page.getByTestId("mail-status")).toContainText("server configuration");
  await expect(page.locator("#smtp-host")).toBeDisabled(); // .env hat Vorrang
  await page.getByTestId("mail-test").click();
  await expect(page.getByTestId("admin-mail").getByRole("status")).toContainText("Test e-mail sent to anna@example.com");
  await expect.poll(async () => (await mailsTo("anna@example.com")).map((m) => m.subject)).toContain("Finantsen: Test-E-Mail"); // Mails in der Kontosprache (Anna hat auf Deutsch umgestellt)

  const created = await page.request.post("/api/admin/users", {
    data: { name: "Mia", username: "mia", email: "mia@example.com", mode: "password", password: PASSWORD, mustChange: false, isAdmin: false },
  });
  expect(created.ok()).toBeTruthy();

  const ctx = await browser.newContext({ baseURL });
  const p = await ctx.newPage();
  await p.goto("/login");
  await p.getByTestId("forgot-link").click();
  await expect(p).toHaveURL(/\/forgot-password/);
  // Unbekannte Konten bekommen dieselbe Antwort
  await p.getByLabel("Username or email").fill("nobody-here");
  await p.getByRole("button", { name: "Request link" }).click();
  await expect(p.getByTestId("forgot-sent")).toBeVisible();
  const sameText = await p.getByTestId("forgot-sent").getByRole("status").textContent();
  await p.goto("/forgot-password");
  await p.getByLabel("Username or email").fill("mia");
  await p.getByRole("button", { name: "Request link" }).click();
  await expect(p.getByTestId("forgot-sent").getByRole("status")).toHaveText(sameText!);
  await expect.poll(async () => (await mailsTo("mia@example.com")).length).toBe(1);
  const [mail] = await mailsTo("mia@example.com");
  expect(mail.subject).toBe("Finantsen: Passwort neu festlegen"); // Kontosprache (Standard Deutsch), nicht Browsersprache
  const link = /https?:\/\/\S+\/activate\/[A-Za-z0-9_-]+/.exec(mail.text)![0];
  await p.goto(new URL(link).pathname);
  const NEW = "New-Horse-Battery-Staple-4!"; // darf den Nutzernamen nicht enthalten
  await p.getByLabel("Password", { exact: true }).fill(NEW);
  await p.getByLabel("Repeat password").fill(NEW);
  await p.getByRole("button", { name: /Save|Activate|Set/ }).click();
  await expect(p).toHaveURL("/");

  // E-Mail-Einstellungen: Benachrichtigungen und Zusammenfassung einschaltbar (Standard aus)
  await p.goto("/settings");
  const box = p.getByTestId("email-settings");
  await expect(box.locator("#own-email")).toHaveValue("mia@example.com");
  await expect(p.getByTestId("email-notifications")).not.toBeChecked();
  await expect(p.getByTestId("weekly-digest")).not.toBeChecked();
  await p.getByTestId("email-notifications").check();
  await expect(box.getByRole("status")).toBeVisible();
  await p.reload();
  await expect(p.getByTestId("email-notifications")).toBeChecked();
  // Adresse ändern verlangt das Passwort
  await box.locator("#own-email").fill("mia2@example.com");
  await box.getByLabel("Current password").fill("wrong-password");
  await box.getByRole("button", { name: "Save e-mail address" }).click();
  await expect(box.getByRole("alert")).toContainText("wrong");
  await box.getByLabel("Current password").fill(NEW);
  await box.getByRole("button", { name: "Save e-mail address" }).click();
  await expect(box.getByRole("status")).toBeVisible();
  await ctx.close();
});

/** Neue Gruppe nur mit Anna (page) und einem weiteren Konto (other); liefert die Gruppen-ID. */
async function twoPersonGroup(page: Page, other: Page, name: string): Promise<string> {
  const g = await (await page.request.post("/api/groups", { data: { name, defaultCurrency: "EUR" } })).json();
  const { url } = await (await page.request.post(`/api/groups/${g.group.id}/invites`)).json();
  const code = String(url).split("/join/")[1];
  expect((await other.request.post(`/api/invites/${code}/accept`)).ok()).toBeTruthy();
  return g.group.id;
}

test("pay when settling up: payment details with password, GiroCode and PayPal link only for debtors", async ({ page, browser, baseURL }) => {
  await login(page, "anna@example.com");
  await page.goto("/settings");
  const box = page.getByTestId("payment-settings");
  await box.getByLabel("Account holder").fill("Anna Example");
  await box.getByLabel("IBAN").fill("DE89 3704 0044 0532 0130 01"); // falsche Prüfziffer
  await box.getByLabel("PayPal.me name").fill("annaexample");
  await box.getByLabel("Current password").fill(PASSWORD);
  await box.getByRole("button", { name: "Save payment details" }).click();
  await expect(box.getByRole("alert")).toContainText("IBAN is invalid");
  await box.getByLabel("IBAN").fill("DE89 3704 0044 0532 0130 00");
  await box.getByLabel("Current password").fill(PASSWORD);
  await box.getByRole("button", { name: "Save payment details" }).click();
  await expect(box.getByRole("status")).toBeVisible();

  const ctx = await browser.newContext({ baseURL });
  const ben = await ctx.newPage();
  await login(ben, "ben");
  const gid = await twoPersonGroup(page, ben, "Pay test");
  const anna = (await (await page.request.get("/api/auth/me")).json()).user.id;
  const benId = (await (await ben.request.get("/api/auth/me")).json()).user.id;
  const r = await page.request.post(`/api/groups/${gid}/expenses`, {
    data: { title: "Tickets", amountMinor: 4700, currency: "EUR", date: "2026-02-01", category: "other", payers: [{ userId: anna, amountMinor: 4700 }], split: { type: "equal", participants: [anna, benId] } },
  });
  expect(r.ok()).toBeTruthy();

  // Ben schuldet Anna 23,50 €: Bezahlbox mit GiroCode, IBAN und PayPal-Link
  await ben.goto(`/groups/${gid}?tab=balances`);
  await ben.getByTestId("pay-box").locator("summary").click();
  await expect(ben.getByTestId("pay-iban")).toHaveText("DE89 3704 0044 0532 0130 00");
  await expect(ben.getByTestId("pay-paypal")).toHaveAttribute("href", "https://paypal.me/annaexample/23.50EUR");
  await expect(ben.getByTestId("pay-box").getByTestId("qr")).toBeVisible();
  // Anna (Gläubigerin) sieht keine Bezahlbox
  await page.goto(`/groups/${gid}?tab=balances`);
  await expect(page.getByTestId("transfers-EUR")).toBeVisible();
  await expect(page.getByTestId("pay-box")).toHaveCount(0);
  await ctx.close();
});
