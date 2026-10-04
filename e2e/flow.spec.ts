import { expect, test, type Page } from "@playwright/test";

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
  await expect(page.getByTestId("transfers-EUR")).toContainText("Ben owes You");
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
  page.once("dialog", (d) => d.accept());
  await page.getByRole("button", { name: "Delete" }).click();
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

test("foreign currency: automatic rate, conversion preview, manual override", async ({ page }) => {
  await login(page, "anna@example.com");
  await page.goto(`${groupUrl}/expenses/new`);
  await page.getByLabel("Title").fill("Souvenirs");
  await page.getByLabel("Amount").fill("25");
  await page.getByLabel("Currency").selectOption("USD");
  await expect(page.getByTestId("rate-auto")).toContainText("1 USD = 0.8 EUR");
  await expect(page.getByTestId("rate-converted")).toContainText("€20.00");
  await page.getByLabel("Set rate manually").check();
  await page.getByLabel("1 USD = ? EUR").fill("0,9");
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

  page.once("dialog", (d) => d.accept());
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
