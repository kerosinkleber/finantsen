// Integrationstests gegen eine echte PostgreSQL-DB. Werden nur ausgeführt, wenn TEST_DATABASE_URL gesetzt ist.
import type { ExpenseBody } from "@/lib/schemas";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";

const url = process.env.TEST_DATABASE_URL;
const d = url ? describe : describe.skip;

d("services (PostgreSQL)", () => {
  let svc: Awaited<ReturnType<typeof load>>;

  async function load() {
    process.env.DATABASE_URL = url;
    process.env.APP_SECRET ??= "test-app-secret-for-integration-tests";
    const [{ getDb, closeDb }, { runMigrations }, users, auth, testUsers, groups, expenses, balances, payments, { sql }, comments, notifications, stats, rates, settings, totp, totpLib, passkeys, recurring, recurrence, guests, exporter] = await Promise.all([
      import("../db"),
      import("../migrate"),
      import("./accounts"),
      import("../auth"),
      import("./testUsers"),
      import("./groups"),
      import("./expenses"),
      import("./balances"),
      import("./payments"),
      import("drizzle-orm"),
      import("./comments"),
      import("./notifications"),
      import("./stats"),
      import("../rates"),
      import("./settings"),
      import("./totp"),
      import("../totp"),
      import("./passkeys"),
      import("./recurring"),
      import("@/lib/recurrence"),
      import("./guests"),
      import("./export"),
    ]);
    return { getDb, closeDb, runMigrations, users, auth, testUsers, groups, expenses, balances, payments, sql, comments, notifications, stats, rates, settings, totp, totpLib, passkeys, recurring, recurrence, guests, exporter };
  }

  beforeAll(async () => {
    svc = await load();
    await svc.runMigrations(2);
  });
  afterAll(async () => svc?.closeDb());
  beforeEach(async () => {
    await svc.getDb().execute(svc.sql`truncate users, groups, settings, exchange_rates, user_tokens cascade`);
  });

  const PW = "Correct-Horse-Battery-9!";
  type U = { id: string; username: string; isAdmin: boolean };
  const actor = (u: U) => ({
    id: u.id,
    username: u.username,
    email: null,
    name: u.username,
    isAdmin: u.isAdmin,
    locale: "de",
    kind: "user" as const,
    mustChangePassword: false,
    real: { id: u.id, name: u.username, isAdmin: u.isAdmin },
    impersonating: false,
    totpEnabled: false,
    totpSetupRequired: false,
  });

  /** Legt über den Admin ein Konto mit Passwort an (ohne Passwortwechsel-Pflicht). */
  async function mkUser(admin: U, username: string, extra: { email?: string; isAdmin?: boolean; name?: string } = {}) {
    const r = await svc.users.createUserByAdmin(actor(admin), {
      name: extra.name ?? username,
      username,
      email: extra.email,
      mode: "password",
      password: PW,
      mustChange: false,
      isAdmin: extra.isAdmin ?? false,
    });
    return { ...r.user };
  }
  const join = async (g: { id: string }, owner: U, member: U) => {
    const inv = await svc.groups.createInvite(owner.id, g.id);
    await svc.groups.acceptInvite(member.id, inv.code);
  };

  async function setup() {
    const a = await svc.users.setupAdmin({ username: "anna", name: "Anna", password: PW, email: "a@x.de" });
    const g = await svc.groups.createGroup(a.id, { name: "WG", defaultCurrency: "EUR" });
    const b = await mkUser(a, "ben", { name: "Ben" });
    const c = await mkUser(a, "cleo", { name: "Cleo" });
    await join(g, a, b);
    await join(g, a, c);
    return { a, b, c, g };
  }
  const base = (over: Pick<ExpenseBody, "payers" | "split"> & Partial<ExpenseBody>): ExpenseBody => ({
    title: "Pizza",
    amountMinor: 3000,
    currency: "EUR",
    date: "2026-01-02",
    category: "restaurant" as const,
    ...over,
  });

  it("Nicht-Mitglieder sehen und ändern nichts (404)", async () => {
    const { a, g } = await setup();
    const inv = await svc.groups.createGroup(a.id, { name: "Privat", defaultCurrency: "EUR" });
    const d = await mkUser(a, "dora", { name: "Dora" });
    await join(g, a, d);
    // Dora ist in WG, aber nicht in "Privat"
    const e = await svc.expenses.createExpense(a.id, inv.id, base({ payers: [{ userId: a.id, amountMinor: 3000 }], split: { type: "full", owner: a.id } }));
    await expect(svc.expenses.listExpenses(d.id, inv.id)).rejects.toMatchObject({ status: 404 });
    await expect(svc.expenses.getExpense(d.id, inv.id, e.id)).rejects.toMatchObject({ status: 404 });
    await expect(svc.expenses.deleteExpense(d.id, inv.id, e.id)).rejects.toMatchObject({ status: 404 });
    await expect(svc.balances.getGroupBalances(d.id, inv.id)).rejects.toMatchObject({ status: 404 });
    await expect(svc.groups.createInvite(d.id, inv.id)).rejects.toMatchObject({ status: 404 });
    // Expense-ID aus anderer Gruppe via eigener Gruppe
    await expect(svc.expenses.getExpense(d.id, g.id, e.id)).rejects.toMatchObject({ status: 404 });
  });

  it("gleichmäßige Aufteilung, Salden, Vereinfachung, Zahlung", async () => {
    const { a, b, c, g } = await setup();
    await svc.expenses.createExpense(a.id, g.id, base({ payers: [{ userId: a.id, amountMinor: 3000 }], split: { type: "equal", participants: [a.id, b.id, c.id] } }));
    let bal = await svc.balances.getGroupBalances(b.id, g.id);
    expect(bal.net.EUR).toEqual({ [a.id]: 2000, [b.id]: -1000, [c.id]: -1000 });
    expect(bal.transfers.EUR).toHaveLength(2);
    await svc.payments.createPayment(b.id, g.id, { fromUser: b.id, toUser: a.id, amountMinor: 1000, currency: "EUR", date: "2026-01-03" });
    bal = await svc.balances.getGroupBalances(b.id, g.id);
    expect(bal.net.EUR).toEqual({ [a.id]: 1000, [c.id]: -1000 });
    const overall = await svc.balances.overallBalances(a.id);
    expect(overall.totals).toEqual({ EUR: 1000 });
    expect(overall.people).toEqual([{ userId: c.id, name: "Cleo", currency: "EUR", amount: 1000 }]);
  });

  it("Rundung: 10,00 € auf 3 Personen ergibt exakt 10,00 €", async () => {
    const { a, b, c, g } = await setup();
    const e = await svc.expenses.createExpense(a.id, g.id, base({ amountMinor: 1000, payers: [{ userId: a.id, amountMinor: 1000 }], split: { type: "equal", participants: [a.id, b.id, c.id] } }));
    expect(e.shares.reduce((s, x) => s + x.amountMinor, 0)).toBe(1000);
  });

  it("mehrere Zahler und Validierung", async () => {
    const { a, b, c, g } = await setup();
    await svc.expenses.createExpense(a.id, g.id, base({ payers: [{ userId: a.id, amountMinor: 2000 }, { userId: b.id, amountMinor: 1000 }], split: { type: "shares", entries: [{ userId: a.id, shares: 1 }, { userId: b.id, shares: 1 }, { userId: c.id, shares: 1 }] } }));
    const bal = await svc.balances.getGroupBalances(a.id, g.id);
    expect(bal.net.EUR).toEqual({ [a.id]: 1000, [c.id]: -1000 });
    await expect(svc.expenses.createExpense(a.id, g.id, base({ payers: [{ userId: a.id, amountMinor: 2999 }], split: { type: "equal", participants: [a.id] } }))).rejects.toMatchObject({ code: "payer_sum" });
    await expect(svc.expenses.createExpense(a.id, g.id, base({ payers: [{ userId: a.id, amountMinor: 3000 }], split: { type: "percent", entries: [{ userId: a.id, bp: 5000 }, { userId: b.id, bp: 4000 }] } }))).rejects.toMatchObject({ code: "percent_sum" });
    await expect(svc.expenses.createExpense(a.id, g.id, base({ payers: [{ userId: a.id, amountMinor: 3000 }], split: { type: "exact", entries: [{ userId: a.id, amountMinor: 1 }] } }))).rejects.toMatchObject({ code: "exact_sum" });
    await expect(svc.expenses.createExpense(a.id, g.id, base({ payers: [{ userId: crypto.randomUUID(), amountMinor: 3000 }], split: { type: "equal", participants: [a.id] } }))).rejects.toMatchObject({ code: "not_a_member" });
  });

  it("Bearbeiten, Soft Delete, Verlauf", async () => {
    const { a, b, g } = await setup();
    const e = await svc.expenses.createExpense(a.id, g.id, base({ payers: [{ userId: a.id, amountMinor: 3000 }], split: { type: "exact", entries: [{ userId: a.id, amountMinor: 1000 }, { userId: b.id, amountMinor: 2000 }] } }));
    await svc.expenses.updateExpense(b.id, g.id, e.id, base({ title: "Pizza+", amountMinor: 4000, payers: [{ userId: a.id, amountMinor: 4000 }], split: { type: "full", owner: b.id } }));
    let bal = await svc.balances.getGroupBalances(a.id, g.id);
    expect(bal.net.EUR).toEqual({ [a.id]: 4000, [b.id]: -4000 });
    await svc.expenses.deleteExpense(a.id, g.id, e.id);
    bal = await svc.balances.getGroupBalances(a.id, g.id);
    expect(bal.net).toEqual({});
    expect((await svc.expenses.listExpenses(a.id, g.id)).length).toBe(0);
    expect((await svc.expenses.listExpenses(a.id, g.id, { includeDeleted: true })).length).toBe(1);
    const h = await svc.expenses.expenseHistoryFor(a.id, g.id, e.id);
    expect(h.map((x) => x.action).sort()).toEqual(["create", "delete", "update"]);
    await expect(svc.expenses.updateExpense(a.id, g.id, e.id, base({ payers: [{ userId: a.id, amountMinor: 3000 }], split: { type: "equal", participants: [a.id] } }))).rejects.toMatchObject({ code: "expense_deleted" });
  });

  it("Freunde: Direktgruppe mit genau 2 Personen", async () => {
    const { a, b, c } = await setup();
    const dg = await svc.groups.createGroup(a.id, { name: "direct", defaultCurrency: "EUR", kind: "direct" });
    const inv = await svc.groups.createInvite(a.id, dg.id);
    await svc.groups.acceptInvite(b.id, inv.code);
    await expect(svc.groups.acceptInvite(c.id, inv.code)).rejects.toMatchObject({ code: "invite_invalid" });
    const list = await svc.groups.listGroups(a.id);
    expect(list.find((x) => x.id === dg.id)?.displayName).toBe("Ben");
  });

  it("Austreten nur bei Saldo 0", async () => {
    const { a, b, g } = await setup();
    await svc.expenses.createExpense(a.id, g.id, base({ payers: [{ userId: a.id, amountMinor: 3000 }], split: { type: "equal", participants: [a.id, b.id] } }));
    await expect(svc.groups.removeMember(b.id, g.id, b.id)).rejects.toMatchObject({ code: "balance_not_zero" });
    await expect(svc.groups.removeMember(b.id, g.id, a.id)).rejects.toMatchObject({ status: 403 });
    await svc.payments.createPayment(b.id, g.id, { fromUser: b.id, toUser: a.id, amountMinor: 1500, currency: "EUR", date: "2026-01-03" });
    await svc.groups.removeMember(b.id, g.id, b.id);
  });

  describe("Phase 2", () => {
    it("Benachrichtigungen bei neuer Ausgabe und Kommentar (nicht für den Autor)", async () => {
      const { a, b, g } = await setup();
      const e = await svc.expenses.createExpense(a.id, g.id, base({ payers: [{ userId: a.id, amountMinor: 3000 }], split: { type: "equal", participants: [a.id, b.id] } }));
      expect(await svc.notifications.unreadCount(a.id)).toBe(0);
      expect(await svc.notifications.unreadCount(b.id)).toBe(1);
      await svc.comments.addComment(b.id, g.id, e.id, "Lecker!");
      expect(await svc.notifications.unreadCount(a.id)).toBe(1);
      const list = await svc.notifications.listNotifications(b.id);
      expect(list[0].type).toBe("expense_created");
      expect(svc.notifications.renderNotification("en", list[0].type, list[0].data as never)).toContain("Anna added “Pizza”");
      await svc.notifications.markRead(b.id);
      expect(await svc.notifications.unreadCount(b.id)).toBe(0);
      expect(await svc.notifications.unreadCount(a.id)).toBe(1); // fremde bleiben unberührt
    });

    it("Kommentare: nur Mitglieder, nur eigene löschen", async () => {
      const { a, b, g } = await setup();
      const other = await svc.groups.createGroup(a.id, { name: "X", defaultCurrency: "EUR" });
      const e = await svc.expenses.createExpense(a.id, g.id, base({ payers: [{ userId: a.id, amountMinor: 3000 }], split: { type: "equal", participants: [a.id, b.id] } }));
      const c = await svc.comments.addComment(a.id, g.id, e.id, "Hi");
      await expect(svc.comments.listComments(b.id, other.id, e.id)).rejects.toMatchObject({ status: 404 });
      await expect(svc.comments.deleteComment(b.id, g.id, e.id, c.id)).rejects.toMatchObject({ status: 403 });
      await svc.comments.deleteComment(a.id, g.id, e.id, c.id);
      expect(await svc.comments.listComments(a.id, g.id, e.id)).toHaveLength(0);
    });

    it("Filter: Text, Betrag, Datum, Kategorie, Person", async () => {
      const { a, b, c, g } = await setup();
      const mk = (title: string, amountMinor: number, date: string, category: ExpenseBody["category"], payer: string, parts: string[]) =>
        svc.expenses.createExpense(a.id, g.id, base({ title, amountMinor, date, category, payers: [{ userId: payer, amountMinor }], split: { type: "equal", participants: parts } }));
      await mk("Pizza 100%", 2000, "2026-01-05", "restaurant", a.id, [a.id, b.id]);
      await mk("Taxi", 1500, "2026-02-10", "transport", b.id, [a.id, b.id]);
      await mk("Kino", 5000, "2026-03-01", "entertainment", a.id, [a.id, c.id]);
      const f = async (filter: object) => (await svc.expenses.listExpenses(a.id, g.id, { filter })).map((e) => e.title).sort();
      expect(await f({})).toEqual(["Kino", "Pizza 100%", "Taxi"]);
      expect(await f({ q: "pizza" })).toEqual(["Pizza 100%"]);
      expect(await f({ q: "100%" })).toEqual(["Pizza 100%"]);
      expect(await f({ q: "%" })).toEqual(["Pizza 100%"]); // % wird nicht als Wildcard interpretiert
      expect(await f({ minMinor: 2000 })).toEqual(["Kino", "Pizza 100%"]);
      expect(await f({ maxMinor: 1999 })).toEqual(["Taxi"]);
      expect(await f({ from: "2026-02-01", to: "2026-02-28" })).toEqual(["Taxi"]);
      expect(await f({ category: "entertainment" })).toEqual(["Kino"]);
      expect(await f({ person: c.id })).toEqual(["Kino"]);
      expect(await f({ person: b.id })).toEqual(["Pizza 100%", "Taxi"]);
      expect(await f({ person: b.id, minMinor: 1800 })).toEqual(["Pizza 100%"]);
    });

    it("Standard-Aufteilung speichern und validieren", async () => {
      const { a, b, g } = await setup();
      await svc.groups.updateGroup(a.id, g.id, { defaultSplit: { type: "percent", entries: [{ userId: a.id, value: 7000 }, { userId: b.id, value: 3000 }] } });
      expect((await svc.groups.getGroup(b.id, g.id)).defaultSplit?.type).toBe("percent");
      await expect(svc.groups.updateGroup(a.id, g.id, { defaultSplit: { type: "percent", entries: [{ userId: a.id, value: 5000 }] } })).rejects.toMatchObject({ code: "percent_sum" });
      await expect(svc.groups.updateGroup(a.id, g.id, { defaultSplit: { type: "equal", entries: [{ userId: crypto.randomUUID(), value: 0 }] } })).rejects.toMatchObject({ code: "not_a_member" });
      await svc.groups.updateGroup(a.id, g.id, { defaultSplit: null });
      expect((await svc.groups.getGroup(a.id, g.id)).defaultSplit).toBeNull();
    });

    it("Auswertung nach Kategorie, Monat, Person (gelöschte zählen nicht)", async () => {
      const { a, b, g } = await setup();
      const e1 = await svc.expenses.createExpense(a.id, g.id, base({ amountMinor: 3000, date: "2026-01-05", payers: [{ userId: a.id, amountMinor: 3000 }], split: { type: "equal", participants: [a.id, b.id] } }));
      await svc.expenses.createExpense(a.id, g.id, base({ amountMinor: 1000, category: "transport", date: "2026-02-05", payers: [{ userId: b.id, amountMinor: 1000 }], split: { type: "full", owner: a.id } }));
      let st = await svc.stats.getGroupStats(b.id, g.id);
      expect(st.EUR.total).toBe(4000);
      expect(st.EUR.byMonth.map((m) => m.month)).toEqual(["2026-01", "2026-02"]);
      expect(st.EUR.byPerson.find((p) => p.userId === a.id)).toMatchObject({ paid: 3000, share: 2500 });
      await svc.expenses.deleteExpense(a.id, g.id, e1.id);
      st = await svc.stats.getGroupStats(b.id, g.id, { from: "2026-01-01" });
      expect(st.EUR.total).toBe(1000);
    });
  });

  describe("Phase 3: Währungen und Itemisierung", () => {
    const calls: string[] = [];
    const table: Record<string, number> = { EUR: 1, JPY: 160, USD: 1.1, KWD: 0.33 };
    const fake = {
      name: "fake",
      historical: true,
      async fetchRates(base: string, date: string) {
        calls.push(`${base}@${date}`);
        const out: Record<string, number> = {};
        for (const [k, v] of Object.entries(table)) if (k !== base) out[k] = v / table[base];
        return out;
      },
    };
    beforeEach(() => {
      calls.length = 0;
      svc.rates.setRateProvider(fake);
    });
    afterAll(() => svc.rates.setRateProvider(null));

    it("rechnet Fremdwährung um, speichert Kurs und Basiswerte; Salden in Gruppenwährung", async () => {
      const { a, b, g } = await setup();
      const e1 = await svc.expenses.createExpense(a.id, g.id, base({ currency: "JPY", amountMinor: 1001, payers: [{ userId: a.id, amountMinor: 1001 }], split: { type: "equal", participants: [a.id, b.id] } }));
      expect(e1.baseCurrency).toBe("EUR");
      expect(e1.rateSource).toBe("provider");
      expect(Number(e1.rate)).toBeCloseTo(1 / 160, 12);
      expect(e1.baseAmountMinor).toBe(626); // 1001 ¥ × 0,00625 = 6,25625 € -> 6,26 €
      expect(e1.payers.reduce((x, y) => x + y.baseAmountMinor, 0)).toBe(626);
      expect(e1.shares.reduce((x, y) => x + y.baseAmountMinor, 0)).toBe(626);
      await svc.expenses.createExpense(b.id, g.id, base({ amountMinor: 500, payers: [{ userId: b.id, amountMinor: 500 }], split: { type: "equal", participants: [a.id, b.id] } }));
      const bal = await svc.balances.getGroupBalances(a.id, g.id);
      expect(Object.keys(bal.net)).toEqual(["EUR"]);
      expect(bal.net.EUR).toEqual({ [a.id]: 63, [b.id]: -63 });
      const st = await svc.stats.getGroupStats(a.id, g.id);
      expect(Object.keys(st)).toEqual(["EUR"]);
      expect(st.EUR.total).toBe(1126);
    });

    it("gleiche Währung: Kurs 1, kein Anbieteraufruf; Kurse werden gecacht", async () => {
      const { a, b, g } = await setup();
      const mk = (cur: string) => svc.expenses.createExpense(a.id, g.id, base({ currency: cur, date: "2026-01-02", payers: [{ userId: a.id, amountMinor: 3000 }], split: { type: "equal", participants: [a.id, b.id] } }));
      const same = await mk("EUR");
      expect(same.rateSource).toBe("same");
      expect(calls).toEqual([]);
      await mk("USD");
      await mk("USD");
      await mk("JPY"); // gleicher Tag, gleiche Basis? nein: Basis USD vs JPY -> je eine Anfrage
      expect(calls).toEqual(["USD@2026-01-02", "JPY@2026-01-02"]);
    });

    it("manueller Kurs hat Vorrang; Bearbeiten behält den gespeicherten Kurs, solange Währung/Datum gleich bleiben", async () => {
      const { a, b, g } = await setup();
      const e = await svc.expenses.createExpense(a.id, g.id, base({ currency: "USD", amountMinor: 1000, rate: "0,9", payers: [{ userId: a.id, amountMinor: 1000 }], split: { type: "equal", participants: [a.id, b.id] } }));
      expect(e.rateSource).toBe("manual");
      expect(e.baseAmountMinor).toBe(900);
      expect(calls).toEqual([]);
      const u = await svc.expenses.updateExpense(a.id, g.id, e.id, base({ currency: "USD", amountMinor: 2000, payers: [{ userId: a.id, amountMinor: 2000 }], split: { type: "equal", participants: [a.id, b.id] } }));
      expect(u.rateSource).toBe("manual");
      expect(u.baseAmountMinor).toBe(1800);
      expect(calls).toEqual([]);
      const changed = await svc.expenses.updateExpense(a.id, g.id, e.id, base({ currency: "USD", date: "2026-02-02", amountMinor: 2000, payers: [{ userId: a.id, amountMinor: 2000 }], split: { type: "equal", participants: [a.id, b.id] } }));
      expect(changed.rateSource).toBe("provider"); // Datum geändert -> neuer Kurs
      expect(calls).toEqual(["USD@2026-02-02"]);
      await expect(svc.expenses.createExpense(a.id, g.id, base({ currency: "USD", rate: "abc", payers: [{ userId: a.id, amountMinor: 3000 }], split: { type: "equal", participants: [a.id] } }))).rejects.toMatchObject({ code: "invalid_rate" });
    });

    it("Anbieter nicht erreichbar -> 503 rate_unavailable (nichts wird gespeichert); manueller Kurs geht trotzdem", async () => {
      const { a, g } = await setup();
      svc.rates.setRateProvider({ name: "down", historical: true, fetchRates: async () => { throw new Error("offline"); } });
      await expect(svc.expenses.createExpense(a.id, g.id, base({ currency: "USD", payers: [{ userId: a.id, amountMinor: 3000 }], split: { type: "equal", participants: [a.id] } }))).rejects.toMatchObject({ status: 503, code: "rate_unavailable" });
      expect(await svc.expenses.listExpenses(a.id, g.id)).toHaveLength(0);
      const ok = await svc.expenses.createExpense(a.id, g.id, base({ currency: "USD", rate: "1", payers: [{ userId: a.id, amountMinor: 3000 }], split: { type: "equal", participants: [a.id] } }));
      expect(ok.baseAmountMinor).toBe(3000);
    });

    it("nicht unterstützte Währung -> 422", async () => {
      const { a, g } = await setup();
      await expect(svc.expenses.createExpense(a.id, g.id, base({ currency: "CHF", payers: [{ userId: a.id, amountMinor: 3000 }], split: { type: "equal", participants: [a.id] } }))).rejects.toMatchObject({ status: 422, code: "currency_unsupported" });
    });

    it("Itemisierung: Positionen, Steuer, Trinkgeld; Verlauf enthält Positionen", async () => {
      const { a, b, c, g } = await setup();
      const e = await svc.expenses.createExpense(a.id, g.id, base({
        amountMinor: 1500 + 500 + 200 + 100,
        payers: [{ userId: a.id, amountMinor: 2300 }],
        split: { type: "items", items: [{ name: "Pizza", amountMinor: 1500, participants: [b.id] }, { name: "Wein", amountMinor: 500, participants: [b.id, c.id] }], taxMinor: 200, tipMinor: 100 },
      }));
      expect(e.splitType).toBe("items");
      expect(e.items?.items).toHaveLength(2);
      expect(e.shares.map((x) => x.userId).sort()).toEqual([b.id, c.id].sort());
      expect(e.shares.reduce((x, y) => x + y.amountMinor, 0)).toBe(2300);
      const bal = await svc.balances.getGroupBalances(a.id, g.id);
      expect(bal.net.EUR[a.id]).toBe(2300);
      const h = await svc.expenses.expenseHistoryFor(a.id, g.id, e.id);
      expect((h[0].snapshot as { items: unknown }).items).not.toBeNull();
      await expect(svc.expenses.createExpense(a.id, g.id, base({ amountMinor: 999, payers: [{ userId: a.id, amountMinor: 999 }], split: { type: "items", items: [{ name: "x", amountMinor: 1000, participants: [a.id] }], taxMinor: 0, tipMinor: 0 } }))).rejects.toMatchObject({ code: "items_sum" });
    });

    it("Itemisierung in Fremdwährung wird umgerechnet", async () => {
      const { a, b, g } = await setup();
      const e = await svc.expenses.createExpense(a.id, g.id, base({
        currency: "USD",
        amountMinor: 1100,
        payers: [{ userId: a.id, amountMinor: 1100 }],
        split: { type: "items", items: [{ name: "A", amountMinor: 600, participants: [a.id] }, { name: "B", amountMinor: 500, participants: [b.id] }], taxMinor: 0, tipMinor: 0 },
      }));
      expect(e.baseAmountMinor).toBe(1000);
      expect(e.shares.reduce((x, y) => x + y.baseAmountMinor, 0)).toBe(1000);
    });
  });

  describe("Konten, Einrichtung, Anmeldung", () => {
    it("Einrichtung: nur einmal, erster Nutzer wird Admin, Passwortrichtlinie gilt", async () => {
      expect(await svc.users.needsSetup()).toBe(true);
      await expect(svc.users.setupAdmin({ username: "root", name: "Root", password: "zu-kurz" })).rejects.toMatchObject({ code: "password_policy" });
      const a = await svc.users.setupAdmin({ username: "Root", name: "Root", password: PW });
      expect(a.isAdmin).toBe(true);
      expect(a.username).toBe("root");
      expect(await svc.users.needsSetup()).toBe(false);
      await expect(svc.users.setupAdmin({ username: "zweiter", name: "Z", password: PW })).rejects.toMatchObject({ code: "setup_done" });
    });

    it("Einrichtung: gleichzeitige Aufrufe erzeugen genau einen Admin", async () => {
      const results = await Promise.allSettled(
        ["a1", "a2", "a3"].map((u) => svc.users.setupAdmin({ username: u, name: u, password: PW })),
      );
      expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
      expect(await svc.users.listUsers({ ...actor({ id: "x", username: "x", isAdmin: true }) })).toHaveLength(1);
    });

    it("Passwortrichtlinie: Admin-Anlage, Nutzer in der Passwort enthalten verboten", async () => {
      const { a } = await setup();
      const mk = (password: string, username = "neu") =>
        svc.users.createUserByAdmin(actor(a), { name: "N", username, mode: "password", password, mustChange: false, isAdmin: false });
      await expect(mk("Kurz1!")).rejects.toMatchObject({ code: "password_policy", extra: { issues: expect.arrayContaining(["too_short"]) } });
      await expect(mk("Xx-NeueNutzerin-Xx-Xx-9!xx", "neuenutzerin")).rejects.toMatchObject({ code: "password_policy" });
      await expect(mk(PW)).resolves.toBeTruthy();
    });

    it("Nutzername: eindeutig (ohne Groß-/Kleinschreibung), E-Mail optional und eindeutig solange Duplikate aus sind", async () => {
      const { a } = await setup();
      await expect(mkUser(a, "ANNA")).rejects.toMatchObject({ code: "username_taken" });
      await mkUser(a, "ohne-mail");
      await expect(mkUser(a, "dup1", { email: "A@X.de" })).rejects.toMatchObject({ code: "email_taken" }); // anna hat a@x.de
      await svc.settings.updateAdminSettings({ allowDuplicateEmails: true });
      await mkUser(a, "dup1", { email: "A@X.de" });
    });

    it("Login per Nutzername oder E-Mail; falsche Daten und unbekannte Konten sind nicht unterscheidbar", async () => {
      await setup();
      const ok1 = await svc.users.authenticate("ANNA", PW);
      expect(ok1.kind === "ok" && ok1.matches.map((m) => m.username)).toEqual(["anna"]);
      const ok2 = await svc.users.authenticate("a@x.de", PW);
      expect(ok2.kind === "ok" && ok2.matches[0].username).toBe("anna");
      expect(await svc.users.authenticate("anna", "falsch")).toEqual({ kind: "invalid" });
      expect(await svc.users.authenticate("niemand", PW)).toEqual({ kind: "invalid" });
    });

    it("Duplikate erlaubt: Login über gleiche E-Mail liefert alle Konten mit passendem Passwort", async () => {
      const { a } = await setup();
      await svc.settings.updateAdminSettings({ allowDuplicateEmails: true });
      await mkUser(a, "zwilling1", { email: "z@x.de" });
      await mkUser(a, "zwilling2", { email: "Z@x.de" });
      const r = await svc.users.authenticate("z@x.de", PW);
      expect(r.kind === "ok" && r.matches.map((m) => m.username)).toEqual(["zwilling1", "zwilling2"]);
      expect(await svc.users.authenticate("zwilling1", PW)).toMatchObject({ kind: "ok" });
    });

    it("Wartezeit nach Fehlversuchen steigt und wird bei Erfolg zurückgesetzt", async () => {
      await setup();
      expect(svc.users.lockSeconds(4)).toBe(0);
      expect(svc.users.lockSeconds(5)).toBe(30);
      expect(svc.users.lockSeconds(6)).toBe(60);
      expect(svc.users.lockSeconds(50)).toBe(900);
      for (let i = 0; i < 4; i++) expect(await svc.users.authenticate("ben", "falsch")).toEqual({ kind: "invalid" });
      expect(await svc.users.authenticate("ben", "falsch")).toEqual({ kind: "invalid" }); // 5. Fehlversuch sperrt ab jetzt
      const locked = await svc.users.authenticate("ben", PW); // auch das richtige Passwort wird während der Sperre abgewiesen
      expect(locked).toMatchObject({ kind: "locked" });
      expect(locked.kind === "locked" && locked.retryAfter).toBeGreaterThan(0);
      await svc.getDb().execute(svc.sql`update users set locked_until = now() - interval '1 second' where username = 'ben'`);
      expect(await svc.users.authenticate("ben", PW)).toMatchObject({ kind: "ok" });
      const [row] = await svc.getDb().execute(svc.sql`select failed_attempts from users where username = 'ben'`);
      expect(row.failed_attempts).toBe(0);
    });

    it("Einmal-Link: Konto aktivieren, nur einmal, abgelaufen, neuer Link macht alten ungültig", async () => {
      const { a } = await setup();
      const r = await svc.users.createUserByAdmin(actor(a), { name: "Neu", username: "neu", mode: "link", mustChange: true, isAdmin: false });
      expect(r.user.status).toBe("invited");
      expect(await svc.users.authenticate("neu", PW)).toEqual({ kind: "invalid" }); // noch kein Passwort
      const token1 = r.link!.url.split("/activate/")[1];
      expect(await svc.users.peekLink(token1)).toMatchObject({ purpose: "activation", username: "neu" });
      // neuer Link ersetzt den alten
      const l2 = await svc.users.adminAction(actor(a), r.user.id, { action: "link" });
      const token2 = (l2 as { link: { url: string } }).link.url.split("/activate/")[1];
      expect(await svc.users.peekLink(token1)).toBeNull();
      await expect(svc.users.redeemLink(token2, "kurz")).rejects.toMatchObject({ code: "password_policy" });
      const u = await svc.users.redeemLink(token2, PW);
      expect(u.status).toBe("active");
      await expect(svc.users.redeemLink(token2, PW)).rejects.toMatchObject({ code: "link_invalid" }); // nur einmal
      expect(await svc.users.authenticate("neu", PW)).toMatchObject({ kind: "ok" });
      // abgelaufener Link
      const l3 = await svc.users.adminAction(actor(a), r.user.id, { action: "link" });
      const token3 = (l3 as { link: { url: string } }).link.url.split("/activate/")[1];
      expect((await svc.users.peekLink(token3))?.purpose).toBe("reset");
      await svc.getDb().execute(svc.sql`update user_tokens set expires_at = now() - interval '1 minute'`);
      expect(await svc.users.peekLink(token3)).toBeNull();
    });

    it("Gültigkeit der Links ist einstellbar", async () => {
      const { a } = await setup();
      await svc.settings.updateAdminSettings({ linkValidityHours: 1 });
      const r = await svc.users.createUserByAdmin(actor(a), { name: "N", username: "nn", mode: "link", mustChange: true, isAdmin: false });
      const ms = new Date(r.link!.expiresAt).getTime() - Date.now();
      expect(ms).toBeGreaterThan(55 * 60_000);
      expect(ms).toBeLessThanOrEqual(60 * 60_000);
    });

    it("Passwort setzen durch Admin erzwingt Wechsel, beendet Sitzungen; Einmal-Link-Passwort-Reset beendet Sitzungen", async () => {
      const { a, b } = await setup();
      await svc.auth.createSessionFor(b.id);
      expect(await svc.users.sessionCount(b.id)).toBe(1);
      await svc.users.adminAction(actor(a), b.id, { action: "setPassword", password: "Another-Strong-Pass-77#", mustChange: true });
      expect(await svc.users.sessionCount(b.id)).toBe(0);
      const r = await svc.users.authenticate("ben", "Another-Strong-Pass-77#");
      expect(r.kind === "ok" && r.matches[0].mustChangePassword).toBe(true);
      await expect(svc.users.adminAction(actor(a), b.id, { action: "setPassword", password: "kurz", mustChange: false })).rejects.toMatchObject({ code: "password_policy" });
    });

    it("Passwort ändern: aktuelles Passwort nötig, nicht gleich, Richtlinie, beendet andere Sitzungen", async () => {
      const { b } = await setup();
      await svc.auth.createSessionFor(b.id);
      await svc.auth.createSessionFor(b.id);
      expect(await svc.users.sessionCount(b.id)).toBe(2);
      const NEW = "Brand-New-Passphrase-42?";
      await expect(svc.users.changePassword(b.id, "falsch", NEW, null)).rejects.toMatchObject({ code: "invalid_credentials" });
      await expect(svc.users.changePassword(b.id, PW, PW, null)).rejects.toMatchObject({ code: "password_same" });
      await expect(svc.users.changePassword(b.id, PW, "zu-kurz", null)).rejects.toMatchObject({ code: "password_policy" });
      await svc.users.changePassword(b.id, PW, NEW, null);
      expect(await svc.users.sessionCount(b.id)).toBe(0);
      expect(await svc.users.authenticate("ben", NEW)).toMatchObject({ kind: "ok" });
      expect(await svc.users.authenticate("ben", PW)).toMatchObject({ kind: "invalid" });
    });

    it("Selbstregistrierung: aus (Standard); an -> Konto wartet auf Freigabe, kann sich erst danach anmelden", async () => {
      const { a } = await setup();
      const input = { username: "gast", name: "Gast", password: PW };
      await expect(svc.users.registerSelf(input)).rejects.toMatchObject({ code: "registration_disabled" });
      await svc.settings.updateAdminSettings({ registrationEnabled: true });
      await svc.users.registerSelf(input);
      await expect(svc.users.registerSelf(input)).rejects.toMatchObject({ code: "username_taken" });
      expect(await svc.users.authenticate("gast", PW)).toEqual({ kind: "blocked", reason: "pending" });
      expect(await svc.users.authenticate("gast", "falsch")).toEqual({ kind: "invalid" }); // Status nur nach richtigem Passwort sichtbar
      const gast = (await svc.users.listUsers(actor(a))).find((u) => u.username === "gast")!;
      await svc.users.adminAction(actor(a), gast.id, { action: "approve" });
      expect(await svc.users.authenticate("gast", PW)).toMatchObject({ kind: "ok" });
      await expect(svc.users.adminAction(actor(a), gast.id, { action: "approve" })).rejects.toMatchObject({ code: "invalid_state" });
    });

    it("Selbstregistrierung ist vor der Einrichtung nicht möglich", async () => {
      await svc.settings.updateAdminSettings({ registrationEnabled: true });
      await expect(svc.users.registerSelf({ username: "x1", name: "X", password: PW })).rejects.toMatchObject({ code: "setup_required" });
    });

    it("Deaktivieren: Login gesperrt, Sitzungen beendet, Daten bleiben; wieder aktivieren", async () => {
      const { a, b, g } = await setup();
      await svc.expenses.createExpense(b.id, g.id, base({ payers: [{ userId: b.id, amountMinor: 3000 }], split: { type: "equal", participants: [a.id, b.id] } }));
      await svc.auth.createSessionFor(b.id);
      await svc.users.adminAction(actor(a), b.id, { action: "disable" });
      expect(await svc.users.sessionCount(b.id)).toBe(0);
      expect(await svc.users.authenticate("ben", PW)).toEqual({ kind: "blocked", reason: "disabled" });
      expect(await svc.expenses.listExpenses(a.id, g.id)).toHaveLength(1);
      await svc.users.adminAction(actor(a), b.id, { action: "enable" });
      expect(await svc.users.authenticate("ben", PW)).toMatchObject({ kind: "ok" });
    });

    it("Letzter Admin ist geschützt; mehrere Admins möglich; Selbst-Deaktivierung verboten; Nicht-Admins dürfen nichts", async () => {
      const { a, b } = await setup();
      await expect(svc.users.adminAction(actor(a), a.id, { action: "removeAdmin" })).rejects.toMatchObject({ code: "last_admin" });
      await expect(svc.users.adminAction(actor(a), a.id, { action: "disable" })).rejects.toMatchObject({ code: "cannot_disable_self" });
      await svc.users.adminAction(actor(a), b.id, { action: "makeAdmin" });
      await svc.users.adminAction(actor(a), a.id, { action: "removeAdmin" }); // jetzt möglich: ben bleibt Admin
      await expect(svc.users.adminAction(actor({ ...b, isAdmin: true }), b.id, { action: "removeAdmin" })).rejects.toMatchObject({ code: "last_admin" });
      await expect(svc.users.adminAction(actor({ ...a, isAdmin: false }), b.id, { action: "disable" })).rejects.toMatchObject({ status: 403 });
      await expect(svc.users.listUsers(actor({ ...a, isAdmin: false }))).rejects.toMatchObject({ status: 403 });
    });

    it("Einmal-Link für deaktiviertes oder wartendes Konto nicht möglich/einlösbar", async () => {
      const { a, b } = await setup();
      const l = (await svc.users.adminAction(actor(a), b.id, { action: "link" })) as { link: { url: string } };
      const token = l.link.url.split("/activate/")[1];
      await svc.users.adminAction(actor(a), b.id, { action: "disable" });
      expect(await svc.users.peekLink(token)).toBeNull();
      await expect(svc.users.adminAction(actor(a), b.id, { action: "link" })).rejects.toMatchObject({ code: "invalid_state" });
    });
  });

  describe("Admin-Testfunktionen (Testnutzer)", () => {
    const tid = (t: { id: string }) => t.id;
    const mkTest = async (admin: U, count = 1) => (await svc.testUsers.createTestUsers(actor(admin), { count })).map(tid);
    /** Admin handelt als Testnutzer (ohne Cookie): Sitzung anlegen, „Handeln als“ setzen, Identität auflösen. */
    async function actAs(admin: U, testId: string) {
      const token = await svc.auth.createSessionFor(admin.id);
      const sid = svc.auth.sha256(token);
      await svc.testUsers.startActingAs(actor(admin), testId, sid);
      return { token, sid, me: (await svc.auth.resolveSession(token))! };
    }
    beforeEach(async () => {
      await svc.settings.updateAdminSettings({ testFeaturesEnabled: true });
    });

    it("Schalter: Standard kommt aus TEST_FEATURES_DEFAULT (ohne Variable aus); Wahl in der Datenbank hat Vorrang", async () => {
      await svc.getDb().execute(svc.sql`truncate settings`);
      const old = process.env.TEST_FEATURES_DEFAULT;
      try {
        delete process.env.TEST_FEATURES_DEFAULT;
        expect(await svc.settings.testFeaturesEnabled()).toBe(false);
        process.env.TEST_FEATURES_DEFAULT = "true";
        expect(await svc.settings.testFeaturesEnabled()).toBe(true);
        await svc.settings.updateAdminSettings({ testFeaturesEnabled: false });
        expect(await svc.settings.testFeaturesEnabled()).toBe(false); // explizit aus schlägt Variable
        process.env.TEST_FEATURES_DEFAULT = "yes";
        await svc.getDb().execute(svc.sql`truncate settings`);
        expect(await svc.settings.testFeaturesEnabled()).toBe(false); // nur "true" schaltet ein
      } finally {
        if (old === undefined) delete process.env.TEST_FEATURES_DEFAULT;
        else process.env.TEST_FEATURES_DEFAULT = old;
      }
    });

    it("bei ausgeschalteten Testfunktionen ist alles gesperrt", async () => {
      const { a } = await setup();
      const [t] = await mkTest(a);
      await svc.settings.updateAdminSettings({ testFeaturesEnabled: false });
      await expect(svc.testUsers.listTestUsers(actor(a))).rejects.toMatchObject({ code: "test_features_disabled" });
      await expect(svc.testUsers.createTestUsers(actor(a), { count: 1 })).rejects.toMatchObject({ code: "test_features_disabled" });
      await expect(svc.testUsers.startActingAs(actor(a), t)).rejects.toMatchObject({ code: "test_features_disabled" });
    });

    it("nur echte Admins: Nicht-Admins und „Handeln als“-Identität werden abgewiesen", async () => {
      const { a, b } = await setup();
      const [t] = await mkTest(a);
      await expect(svc.testUsers.listTestUsers(actor(b))).rejects.toMatchObject({ status: 403 });
      await expect(svc.testUsers.createTestUsers(actor(b), { count: 1 })).rejects.toMatchObject({ status: 403 });
      const { me } = await actAs(a, t);
      expect(me.impersonating).toBe(true);
      await expect(svc.testUsers.listTestUsers(me)).rejects.toMatchObject({ status: 403 }); // auch als Testnutzer kein Admin
      await expect(svc.users.listUsers(me)).rejects.toMatchObject({ status: 403 });
    });

    it("Anlegen: fortlaufend test-1…, einzeln mit eigenem Namen, Nutzername eindeutig, Testnutzer nicht in der echten Nutzerliste", async () => {
      const { a } = await setup();
      const first = await svc.testUsers.createTestUsers(actor(a), { count: 3 });
      expect(first.map((u) => u.username)).toEqual(["test-1", "test-2", "test-3"]);
      expect(first.map((u) => u.name)).toEqual(["Test 1", "Test 2", "Test 3"]);
      expect((await svc.testUsers.createTestUsers(actor(a), { count: 2 })).map((u) => u.username)).toEqual(["test-4", "test-5"]);
      const [custom] = await svc.testUsers.createTestUsers(actor(a), { name: "Hilde", username: "hilde" });
      expect(custom.username).toBe("hilde");
      await expect(svc.testUsers.createTestUsers(actor(a), { name: "X", username: "HILDE" })).rejects.toMatchObject({ code: "username_taken" });
      await expect(svc.testUsers.createTestUsers(actor(a), { name: "X", username: "anna" })).rejects.toMatchObject({ code: "username_taken" });
      expect((await svc.users.listUsers(actor(a))).some((u) => u.username.startsWith("test-"))).toBe(false);
      expect(await svc.testUsers.listTestUsers(actor(a))).toHaveLength(6);
    });

    it("Sicherheit: Testnutzer können sich nie anmelden, keinen Link bekommen, nicht Admin werden, kein Passwort ändern", async () => {
      const { a } = await setup();
      const [t] = await mkTest(a);
      expect(await svc.users.authenticate("test-1", PW)).toEqual({ kind: "invalid" });
      // selbst wenn ein Passwort-Hash in die Datenbank geraten würde, bleibt der Login gesperrt
      const hash = await svc.auth.hashPassword(PW);
      await svc.getDb().execute(svc.sql`update users set password_hash = ${hash} where id = ${t}`);
      expect(await svc.users.authenticate("test-1", PW)).toEqual({ kind: "invalid" });
      await expect(svc.users.adminAction(actor(a), t, { action: "link" })).rejects.toMatchObject({ status: 404 });
      await expect(svc.users.adminAction(actor(a), t, { action: "makeAdmin" })).rejects.toMatchObject({ status: 404 });
      await expect(svc.users.adminAction(actor(a), t, { action: "setPassword", password: PW, mustChange: false })).rejects.toMatchObject({ status: 404 });
      await expect(svc.users.changePassword(t, PW, "Another-Strong-Pass-77#", null)).rejects.toMatchObject({ status: 401 });
      // eine Sitzung eines Testnutzers wird nie aufgelöst
      const token = await svc.auth.createSessionFor(t);
      expect(await svc.auth.resolveSession(token)).toBeNull();
    });

    it("„Handeln als“: nur Testnutzer, nie echte Konten; Identität wechselt, echter Admin bleibt erhalten; Beenden und Abschalten", async () => {
      const { a, b } = await setup();
      const [t] = await mkTest(a);
      await expect(svc.testUsers.startActingAs(actor(a), b.id)).rejects.toMatchObject({ status: 404 }); // echtes Konto
      await expect(svc.testUsers.startActingAs(actor(a), a.id)).rejects.toMatchObject({ status: 404 });
      const { token, sid, me } = await actAs(a, t);
      expect(me).toMatchObject({ id: t, kind: "test", isAdmin: false, impersonating: true, real: { id: a.id, isAdmin: true } });
      await svc.testUsers.stopActingAs(me, sid);
      expect(await svc.auth.resolveSession(token)).toMatchObject({ id: a.id, impersonating: false, isAdmin: true });
      // Testfunktionen ausschalten beendet die Wirkung sofort
      await svc.testUsers.startActingAs(actor(a), t, sid);
      await svc.settings.updateAdminSettings({ testFeaturesEnabled: false });
      expect(await svc.auth.resolveSession(token)).toMatchObject({ id: a.id, impersonating: false });
      // ein Nicht-Admin-Konto kann „Handeln als“ auch per manipulierter Sitzung nicht nutzen
      await svc.settings.updateAdminSettings({ testFeaturesEnabled: true });
      const tokB = await svc.auth.createSessionFor(b.id);
      await svc.getDb().execute(svc.sql`update sessions set acting_as_user_id = ${t} where id = ${svc.auth.sha256(tokB)}`);
      expect(await svc.auth.resolveSession(tokB)).toMatchObject({ id: b.id, impersonating: false });
    });

    it("als Testnutzer handeln: Ausgabe, Kommentar und Zahlung erscheinen von ihm, im Verlauf „durch Admin“; Benachrichtigung in der App, kein Push", async () => {
      const { a, b, g } = await setup();
      const [t] = await mkTest(a);
      await svc.testUsers.addToGroup(actor(a), t, g.id, { role: "member", confirmed: true });
      const { me } = await actAs(a, t);
      const e = await svc.expenses.createExpense(me.id, g.id, base({ payers: [{ userId: t, amountMinor: 3000 }], split: { type: "equal", participants: [t, b.id] } }), me.real.id);
      expect(e.createdBy).toBe(t);
      await svc.comments.addComment(me.id, g.id, e.id, "Hallo", me.real.id);
      await svc.payments.createPayment(me.id, g.id, { fromUser: b.id, toUser: t, amountMinor: 500, currency: "EUR", date: "2026-01-03" }, me.real.id);
      const hist = await svc.expenses.expenseHistoryFor(a.id, g.id, e.id);
      expect(hist[0]).toMatchObject({ userName: "Test 1 (Test)", actedByName: "Anna" });
      const comments = await svc.comments.listComments(a.id, g.id, e.id);
      expect(comments[0]).toMatchObject({ userName: "Test 1 (Test)", actedByName: "Anna" });
      // ohne „Handeln als“ bleibt actedBy leer
      const own = await svc.expenses.createExpense(b.id, g.id, base({ payers: [{ userId: b.id, amountMinor: 3000 }], split: { type: "equal", participants: [b.id] } }));
      expect((await svc.expenses.expenseHistoryFor(b.id, g.id, own.id))[0].actedByName).toBeNull();
      // Testnutzer sieht seine Benachrichtigung (Ausgabe von Ben), Push gibt es nie
      expect(await svc.notifications.unreadCount(t)).toBe(1);
    });

    it("Testnutzer sind in Gruppenlisten mit „(Test)“ gekennzeichnet", async () => {
      const { a, g } = await setup();
      const [t] = await mkTest(a);
      await svc.testUsers.addToGroup(actor(a), t, g.id, { role: "member", confirmed: true });
      const group = (await svc.groups.listGroups(a.id)).find((x) => x.id === g.id)!;
      expect(group.members.find((m) => m.id === t)).toMatchObject({ name: "Test 1 (Test)", isTest: true });
      expect(group.members.find((m) => m.id === a.id)).toMatchObject({ isTest: false });
    });

    it("Gruppen hinzufügen: Warnung bei echten Mitgliedern, Datenschutz-Auswahl, Rolle, Doppelte", async () => {
      const { a, b, g } = await setup(); // g: anna (admin), ben, cleo
      const [t] = await mkTest(a);
      await expect(svc.testUsers.addToGroup(actor(a), t, g.id, { role: "member" })).rejects.toMatchObject({ code: "needs_confirmation", extra: { realMembers: ["Ben", "Cleo"] } });
      await svc.testUsers.addToGroup(actor(a), t, g.id, { role: "member", confirmed: true });
      await expect(svc.testUsers.addToGroup(actor(a), t, g.id, { role: "member", confirmed: true })).rejects.toMatchObject({ code: "already_member" });
      // Gruppe echter Nutzer ohne den Admin: nicht auswählbar und nicht hinzufügbar
      const fremd = await svc.groups.createGroup(b.id, { name: "Fremd", defaultCurrency: "EUR" });
      const d = await svc.testUsers.getTestUserDetail(actor(a), t);
      expect(d.addableGroups.map((x) => x.name)).not.toContain("Fremd");
      await expect(svc.testUsers.addToGroup(actor(a), t, fremd.id, { role: "member", confirmed: true })).rejects.toMatchObject({ status: 404 });
      // reine Testnutzer-Gruppe ist ohne Warnung hinzufügbar
      const [t2] = await mkTest(a);
      const tg = await svc.groups.createGroup(t2, { name: "Nur Tests", defaultCurrency: "EUR" });
      expect((await svc.testUsers.getTestUserDetail(actor(a), t)).addableGroups.map((x) => x.name)).toContain("Nur Tests");
      await svc.testUsers.addToGroup(actor(a), t, tg.id, { role: "owner" });
      const detail = await svc.testUsers.getTestUserDetail(actor(a), t);
      expect(detail.memberships.find((m) => m.groupId === tg.id)).toMatchObject({ role: "owner", hasRealMembers: false });
      expect(detail.memberships.find((m) => m.groupId === g.id)).toMatchObject({ role: "member", hasRealMembers: true });
    });

    it("Rolle ändern: letzter Besitzer ist geschützt; entfernen mit offenem Saldo nur nach Bestätigung; letztes Mitglied bleibt", async () => {
      const { a, b, g } = await setup();
      const [t] = await mkTest(a);
      await svc.testUsers.addToGroup(actor(a), t, g.id, { role: "member", confirmed: true });
      await svc.testUsers.setGroupRole(actor(a), t, g.id, "owner");
      await svc.testUsers.setGroupRole(actor(a), t, g.id, "member"); // anna ist weiterhin Besitzerin
      const tg = await svc.groups.createGroup(t, { name: "Solo", defaultCurrency: "EUR" });
      await expect(svc.testUsers.setGroupRole(actor(a), t, tg.id, "member")).rejects.toMatchObject({ code: "last_owner" });
      await expect(svc.testUsers.removeFromGroup(actor(a), t, tg.id, { confirmed: true })).rejects.toMatchObject({ code: "last_member" });
      // offener Saldo
      await svc.expenses.createExpense(a.id, g.id, base({ payers: [{ userId: a.id, amountMinor: 3000 }], split: { type: "equal", participants: [a.id, t] } }));
      await expect(svc.testUsers.removeFromGroup(actor(a), t, g.id)).rejects.toMatchObject({ code: "balance_not_zero" });
      await svc.testUsers.removeFromGroup(actor(a), t, g.id, { confirmed: true });
      expect((await svc.expenses.listExpenses(a.id, g.id)).length).toBe(1); // Ausgabe bleibt erhalten
      expect(b.id).toBeTruthy();
    });

    it("Besitzer wird beim Entfernen weitergereicht", async () => {
      const { a, g } = await setup();
      const [t] = await mkTest(a);
      const tg = await svc.groups.createGroup(t, { name: "T-Gruppe", defaultCurrency: "EUR" });
      await svc.testUsers.addToGroup(actor(a), t, g.id, { role: "member", confirmed: true });
      const [t2] = await mkTest(a);
      await svc.testUsers.addToGroup(actor(a), t2, tg.id, { role: "member" });
      await svc.testUsers.removeFromGroup(actor(a), t, tg.id, { confirmed: true });
      const rows = await svc.getDb().execute(svc.sql`select role from group_members where group_id = ${tg.id} and user_id = ${t2}`);
      expect(rows[0].role).toBe("owner");
    });

    it("Freundschaften: Testnutzer ↔ Testnutzer, Admin; echte Konten nur nach Bestätigung; keine Doppelten; Beenden entfernt nur den Testnutzer", async () => {
      const { a, b } = await setup();
      const [t1, t2] = await mkTest(a, 2);
      await svc.testUsers.addFriend(actor(a), t1, t2);
      await expect(svc.testUsers.addFriend(actor(a), t2, t1)).rejects.toMatchObject({ code: "already_friends" });
      await svc.testUsers.addFriend(actor(a), t1, a.id); // Admin ohne Warnung
      await expect(svc.testUsers.addFriend(actor(a), t1, b.id)).rejects.toMatchObject({ code: "needs_confirmation" });
      await svc.testUsers.addFriend(actor(a), t1, b.id, { confirmed: true });
      const d = await svc.testUsers.getTestUserDetail(actor(a), t1);
      expect(d.memberships.filter((m) => m.kind === "direct").map((m) => m.name).sort()).toEqual(["Test 2 (Test)", "Anna", "Ben"].sort());
      expect(d.friendCandidates.some((c) => c.id === t2)).toBe(false); // schon befreundet
      // Beenden: Direktgruppe bleibt für den anderen bestehen
      const direct = d.memberships.find((m) => m.name === "Ben")!;
      await svc.testUsers.removeFromGroup(actor(a), t1, direct.groupId, { confirmed: true });
      expect((await svc.groups.listGroups(b.id)).find((x) => x.id === direct.groupId)?.members).toHaveLength(1);
      await expect(svc.testUsers.addFriend(actor(a), t1, t1)).rejects.toMatchObject({ status: 404 });
    });

    it("Bearbeiten: Name, Nutzername, Sprache; echte Konten sind hier nie erreichbar", async () => {
      const { a, b } = await setup();
      const [t] = await mkTest(a);
      const u = await svc.testUsers.updateTestUser(actor(a), t, { name: "Neu", username: "NEU-1", locale: "en" });
      expect(u).toMatchObject({ name: "Neu", username: "neu-1", locale: "en" });
      await expect(svc.testUsers.updateTestUser(actor(a), t, { username: "anna" })).rejects.toMatchObject({ code: "username_taken" });
      for (const fn of [
        () => svc.testUsers.updateTestUser(actor(a), b.id, { name: "Hack" }),
        () => svc.testUsers.getTestUserDetail(actor(a), b.id),
        () => svc.testUsers.deleteTestUser(actor(a), b.id),
        () => svc.testUsers.addToGroup(actor(a), b.id, "00000000-0000-0000-0000-000000000000", { role: "member" }),
        () => svc.testUsers.removeFromGroup(actor(a), b.id, "00000000-0000-0000-0000-000000000000"),
        () => svc.testUsers.addFriend(actor(a), b.id, a.id),
      ])
        await expect(fn()).rejects.toMatchObject({ status: 404 });
      expect((await svc.users.listUsers(actor(a))).find((x) => x.id === b.id)?.name).toBe("Ben"); // unverändert
    });

    it("Löschen: reine Testnutzer-Gruppen samt Daten, bloße Mitgliedschaften werden gelöst", async () => {
      const { a, g } = await setup();
      const [t1, t2] = await mkTest(a, 2);
      const tg = await svc.groups.createGroup(t1, { name: "Testgruppe", defaultCurrency: "EUR" });
      await svc.testUsers.addToGroup(actor(a), t2, tg.id, { role: "member" });
      await svc.expenses.createExpense(t1, tg.id, base({ payers: [{ userId: t1, amountMinor: 3000 }], split: { type: "equal", participants: [t1, t2] } }));
      await svc.payments.createPayment(t2, tg.id, { fromUser: t2, toUser: t1, amountMinor: 100, currency: "EUR", date: "2026-01-03" });
      await svc.testUsers.addToGroup(actor(a), t1, g.id, { role: "member", confirmed: true }); // nur Mitglied, keine Daten
      await svc.testUsers.deleteTestUser(actor(a), t1);
      expect(await svc.getDb().execute(svc.sql`select 1 from groups where id = ${tg.id}`)).toHaveLength(0);
      expect(await svc.getDb().execute(svc.sql`select 1 from expenses where group_id = ${tg.id}`)).toHaveLength(0);
      expect(await svc.getDb().execute(svc.sql`select 1 from users where id = ${t1}`)).toHaveLength(0);
      expect(await svc.getDb().execute(svc.sql`select 1 from users where id = ${t2}`)).toHaveLength(1); // anderer Testnutzer bleibt
      expect((await svc.groups.listGroups(a.id)).find((x) => x.id === g.id)!.members.some((m) => m.id === t1)).toBe(false);
      expect(await svc.getDb().execute(svc.sql`select 1 from groups where id = ${g.id}`)).toHaveLength(1);
    });

    it("Löschen blockiert (nichts wird gelöscht), wenn Daten in einer Gruppe mit echten Nutzern hängen", async () => {
      const { a, g } = await setup();
      const [t] = await mkTest(a);
      await svc.testUsers.addToGroup(actor(a), t, g.id, { role: "member", confirmed: true });
      await svc.expenses.createExpense(a.id, g.id, base({ payers: [{ userId: a.id, amountMinor: 3000 }], split: { type: "equal", participants: [a.id, t] } }));
      await expect(svc.testUsers.deleteTestUser(actor(a), t)).rejects.toMatchObject({
        code: "test_user_in_real_group",
        extra: { groups: [{ id: g.id, name: "WG", users: expect.arrayContaining(["Anna"]) }] },
      });
      expect(await svc.getDb().execute(svc.sql`select 1 from users where id = ${t}`)).toHaveLength(1);
      expect((await svc.expenses.listExpenses(a.id, g.id)).length).toBe(1);
      // eine vom Testnutzer nur angelegte Gruppe (ohne seine Daten) blockiert nicht: Verweis geht auf ein anderes Mitglied über
      const [t2] = await mkTest(a);
      const tg = await svc.groups.createGroup(t2, { name: "Mit Admin", defaultCurrency: "EUR" });
      await svc.getDb().execute(svc.sql`insert into group_members(group_id, user_id) values (${tg.id}, ${a.id})`);
      await svc.testUsers.deleteTestUser(actor(a), t2);
      const [row] = await svc.getDb().execute(svc.sql`select created_by from groups where id = ${tg.id}`);
      expect(row.created_by).toBe(a.id);
      const [mem] = await svc.getDb().execute(svc.sql`select role from group_members where group_id = ${tg.id} and user_id = ${a.id}`);
      expect(mem.role).toBe("owner"); // Besitzer wurde weitergereicht
      // Direktgruppe ohne Daten: Mitgliedschaft wird gelöst
      const [t3] = await mkTest(a);
      await svc.testUsers.addFriend(actor(a), t3, a.id);
      await svc.testUsers.deleteTestUser(actor(a), t3);
      expect(await svc.getDb().execute(svc.sql`select 1 from users where id = ${t3}`)).toHaveLength(0);
    });

    it("Löschen beendet „Handeln als“-Sitzungen sauber", async () => {
      const { a } = await setup();
      const [t] = await mkTest(a);
      const { token, sid } = await actAs(a, t);
      await svc.testUsers.deleteTestUser(actor(a), t);
      expect(await svc.auth.resolveSession(token)).toMatchObject({ id: a.id, impersonating: false });
      expect(sid).toBeTruthy();
    });
  });

  describe("Anzeigename optional", () => {
    it("ohne Anzeigename gilt der Nutzername, überall", async () => {
      const a = await svc.users.setupAdmin({ username: "Chef", password: PW });
      expect(a.name).toBe("chef");
      const mk = async (input: object) =>
        (await svc.users.createUserByAdmin(actor(a), { mode: "password", password: PW, mustChange: false, isAdmin: false, ...(input as { username: string }) })).user;
      expect((await mk({ username: "lena" })).name).toBe("lena");
      expect((await mk({ username: "paul", name: "   " })).name).toBe("paul"); // nur Leerzeichen = leer
      expect((await mk({ username: "uwe", name: "Uwe Meier" })).name).toBe("Uwe Meier"); // Angabe bleibt
      await svc.settings.updateAdminSettings({ registrationEnabled: true });
      await svc.users.registerSelf({ username: "gast", password: PW });
      expect((await svc.users.listUsers(actor(a))).find((u) => u.username === "gast")?.name).toBe("gast");
      const [t] = await svc.testUsers.createTestUsers(actor(a), { username: "tester" }).catch(async () => {
        await svc.settings.updateAdminSettings({ testFeaturesEnabled: true });
        return svc.testUsers.createTestUsers(actor(a), { username: "tester" });
      });
      expect(t.name).toBe("tester");
    });

    it("Schema: leerer oder fehlender Anzeigename ist erlaubt, zu lang nicht", async () => {
      const { adminCreateUserSchema, setupSchema } = await import("@/lib/schemas");
      expect(setupSchema.parse({ username: "abc", password: "x" }).name).toBeUndefined();
      expect(adminCreateUserSchema.parse({ name: "", username: "abc", mode: "link" }).name).toBeUndefined();
      expect(adminCreateUserSchema.parse({ name: "  Anna  ", username: "abc", mode: "link" }).name).toBe("Anna");
      expect(() => adminCreateUserSchema.parse({ name: "x".repeat(101), username: "abc", mode: "link" })).toThrow();
    });
  });

  describe("Entwicklungs-Admin (DEV_ADMIN)", () => {
    const old = process.env.DEV_ADMIN;
    afterEach(() => {
      if (old === undefined) delete process.env.DEV_ADMIN;
      else process.env.DEV_ADMIN = old;
    });

    it("ohne DEV_ADMIN passiert nichts: kein Konto, Dev-Anmeldung existiert nicht", async () => {
      delete process.env.DEV_ADMIN;
      expect(await svc.users.ensureDevAdmin()).toBe(false);
      expect(await svc.users.needsSetup()).toBe(true);
      expect(await svc.users.devAdminAvailable()).toBe(false);
      await expect(svc.users.devLogin()).rejects.toMatchObject({ status: 404 });
      process.env.DEV_ADMIN = "yes"; // nur "true" zählt
      expect(await svc.users.ensureDevAdmin()).toBe(false);
    });

    it("mit DEV_ADMIN=true: legt bei leerer Datenbank genau einmal den Admin ohne Passwort und ohne Anzeigenamen an", async () => {
      process.env.DEV_ADMIN = "true";
      expect(await svc.users.ensureDevAdmin()).toBe(true);
      expect(await svc.users.ensureDevAdmin()).toBe(false); // zweiter Start: nichts mehr
      expect(await svc.users.needsSetup()).toBe(false); // keine Ersteinrichtung nötig
      const [row] = await svc.getDb().execute(svc.sql`select username, name, password_hash, is_admin, status, kind, must_change_password from users`);
      expect(row).toMatchObject({ username: "admin", name: "admin", password_hash: null, is_admin: true, status: "active", kind: "user", must_change_password: false });
      const u = await svc.users.devLogin();
      expect(u.username).toBe("admin");
    });

    it("gleichzeitige Starts legen nur einen Admin an", async () => {
      process.env.DEV_ADMIN = "true";
      const r = await Promise.all([svc.users.ensureDevAdmin(), svc.users.ensureDevAdmin(), svc.users.ensureDevAdmin()]);
      expect(r.filter(Boolean)).toHaveLength(1);
    });

    it("legt keinen Admin an, wenn schon Konten existieren", async () => {
      await svc.users.setupAdmin({ username: "anna", password: PW });
      process.env.DEV_ADMIN = "true";
      expect(await svc.users.ensureDevAdmin()).toBe(false);
      expect(await svc.users.devAdminAvailable()).toBe(false); // kein Konto "admin"
    });

    it("normaler Login bleibt zu: mit keinem Passwort (auch leer) kommt man als admin hinein", async () => {
      process.env.DEV_ADMIN = "true";
      await svc.users.ensureDevAdmin();
      for (const pw of ["", " ", "admin", PW]) expect(await svc.users.authenticate("admin", pw)).toEqual({ kind: "invalid" });
    });

    it("Dev-Zugang schließt sich, sobald der Admin ein Passwort hat, deaktiviert wird oder die Variable fehlt", async () => {
      process.env.DEV_ADMIN = "true";
      await svc.users.ensureDevAdmin();
      const a = (await svc.users.devLogin()) as unknown as U;
      await svc.users.adminAction(actor({ ...a, isAdmin: true }), a.id, { action: "setPassword", password: PW, mustChange: false });
      await expect(svc.users.devLogin()).rejects.toMatchObject({ status: 404 }); // Passwort gesetzt => zu
      expect(await svc.users.authenticate("admin", PW)).toMatchObject({ kind: "ok" }); // normaler Login geht
      // Variable weg => zu
      await svc.getDb().execute(svc.sql`update users set password_hash = null where username = 'admin'`);
      expect(await svc.users.devAdminAvailable()).toBe(true);
      delete process.env.DEV_ADMIN;
      expect(await svc.users.devAdminAvailable()).toBe(false);
      await expect(svc.users.devLogin()).rejects.toMatchObject({ status: 404 });
      // deaktiviert => zu
      process.env.DEV_ADMIN = "true";
      await svc.getDb().execute(svc.sql`update users set status = 'disabled' where username = 'admin'`);
      await expect(svc.users.devLogin()).rejects.toMatchObject({ status: 404 });
    });

    it("ein anderer passwortloser Admin-Name oder Testnutzer \"admin\" öffnet den Zugang nicht", async () => {
      await svc.users.setupAdmin({ username: "anna", password: PW });
      process.env.DEV_ADMIN = "true";
      await svc.settings.updateAdminSettings({ testFeaturesEnabled: true });
      const annaRow = (await svc.users.listUsers({ ...actor({ id: "x", username: "x", isAdmin: true }) }))[0];
      await svc.testUsers.createTestUsers(actor({ id: annaRow.id, username: "anna", isAdmin: true }), { username: "admin" });
      expect(await svc.users.devAdminAvailable()).toBe(false); // Konto "admin" ist ein Testnutzer (kind=test)
      await expect(svc.users.devLogin()).rejects.toMatchObject({ status: 404 });
    });
  });
  describe("Etappe B: TOTP", () => {
    // Zeitschritt relativ zu jetzt; jeder Code gilt nur einmal, daher je Schritt ein eigener Offset (Fenster ±1)
    const codeAt = (secretB32: string, offset: number) =>
      svc.totpLib.totpAt(svc.totpLib.base32Decode(secretB32), svc.totpLib.stepAt() + offset);

    async function enrolled() {
      const a = await svc.users.setupAdmin({ username: "anna", password: PW });
      const b = await mkUser(a, "ben");
      const { secret } = await svc.totp.startEnrollment(b.id);
      const { recoveryCodes } = await svc.totp.confirmEnrollment(b.id, codeAt(secret, -1));
      return { a, b, secret, recoveryCodes };
    }

    it("Einrichtung: Code bestätigt, ein Wiederherstellungscode als Standard, Geheimnis nur verschlüsselt", async () => {
      const { b, secret, recoveryCodes } = await enrolled();
      expect(recoveryCodes).toHaveLength(1);
      expect(recoveryCodes[0]).toMatch(/^[A-Z2-9]{5}-[A-Z2-9]{5}$/);
      expect(await svc.totp.totpStatus(b.id)).toMatchObject({ enabled: true, required: false, recoveryRemaining: 1 });
      const [row] = await svc.getDb().execute(svc.sql`select totp_secret from users where id = ${b.id}`);
      expect(String((row as { totp_secret: string }).totp_secret)).not.toContain(secret);
      const [rc] = await svc.getDb().execute(svc.sql`select code_hash from recovery_codes where user_id = ${b.id}`);
      expect(String((rc as { code_hash: string }).code_hash)).not.toContain(recoveryCodes[0].replace("-", ""));
      await expect(svc.totp.startEnrollment(b.id)).rejects.toMatchObject({ code: "totp_already_enabled" });
    });

    it("falscher Code bestätigt die Einrichtung nicht", async () => {
      const a = await svc.users.setupAdmin({ username: "anna", password: PW });
      await expect(svc.totp.confirmEnrollment(a.id, "123456")).rejects.toMatchObject({ code: "totp_not_started" });
      const { secret } = await svc.totp.startEnrollment(a.id);
      const wrong = codeAt(secret, 0) === "000000" ? "000001" : "000000";
      await expect(svc.totp.confirmEnrollment(a.id, wrong)).rejects.toMatchObject({ code: "invalid_code" });
      expect((await svc.totp.totpStatus(a.id)).enabled).toBe(false);
    });

    it("Anmeldung: Challenge + Code, jeder Code nur einmal (Replay), Wiederherstellungscode nur einmal", async () => {
      const { b, secret, recoveryCodes } = await enrolled();
      const ch = svc.totp.issueChallenge(b.id);
      // Schritt -1 wurde bei der Einrichtung verbraucht
      await expect(svc.totp.completeLogin(ch, codeAt(secret, -1))).rejects.toMatchObject({ code: "invalid_code" });
      expect((await svc.totp.completeLogin(ch, codeAt(secret, 0))).id).toBe(b.id);
      await expect(svc.totp.completeLogin(ch, codeAt(secret, 0))).rejects.toMatchObject({ code: "invalid_code" });
      expect((await svc.totp.completeLogin(ch, codeAt(secret, 1))).id).toBe(b.id);
      // Wiederherstellungscode: Schreibweise egal, nur einmal
      const rc = recoveryCodes[0].toLowerCase().replace("-", " ");
      expect((await svc.totp.completeLogin(ch, rc)).id).toBe(b.id);
      await expect(svc.totp.completeLogin(ch, recoveryCodes[0])).rejects.toMatchObject({ code: "invalid_code" });
      expect((await svc.totp.totpStatus(b.id)).recoveryRemaining).toBe(0);
    });

    it("Challenge: gefälscht oder für ein anderes Konto nutzlos", async () => {
      const { b, secret } = await enrolled();
      await expect(svc.totp.completeLogin("x.y", codeAt(secret, 0))).rejects.toMatchObject({ code: "challenge_invalid" });
      await expect(svc.totp.completeLogin("", "123456")).rejects.toMatchObject({ code: "challenge_invalid" });
      expect(b.id).toBeTruthy();
    });

    it("Fehlversuche sperren zunehmend; ein richtiges Passwort löscht den TOTP-Zähler nicht", async () => {
      const { b, secret } = await enrolled();
      const ch = svc.totp.issueChallenge(b.id);
      for (let i = 0; i < 5; i++) await expect(svc.totp.completeLogin(ch, "000000")).rejects.toMatchObject({ code: "invalid_code" });
      await svc.users.authenticate("ben", PW); // richtiges Passwort
      await expect(svc.totp.completeLogin(ch, codeAt(secret, 0))).rejects.toMatchObject({ status: 429, code: "account_locked" });
    });

    it("Zwang: Konto-Flag oder globaler Schalter; Ausschalten dann nicht möglich, freiwillig schon", async () => {
      const { a, b, secret } = await enrolled();
      const admin = actor(a);
      // freiwillig ausschalten
      await expect(svc.totp.disableTotp(b.id, "falsch", codeAt(secret, 0))).rejects.toMatchObject({ code: "invalid_credentials" });
      await svc.totp.disableTotp(b.id, PW, codeAt(secret, 0));
      expect((await svc.totp.totpStatus(b.id)).enabled).toBe(false);
      // verlangt (Konto-Flag)
      await svc.users.adminAction(admin, b.id, { action: "requireTotp" });
      const token = await svc.auth.createSessionFor(b.id);
      expect(await svc.auth.resolveSession(token)).toMatchObject({ totpEnabled: false, totpSetupRequired: true });
      const { secret: s2 } = await svc.totp.startEnrollment(b.id);
      await svc.totp.confirmEnrollment(b.id, codeAt(s2, -1));
      expect(await svc.auth.resolveSession(token)).toMatchObject({ totpEnabled: true, totpSetupRequired: false });
      await expect(svc.totp.disableTotp(b.id, PW, codeAt(s2, 0))).rejects.toMatchObject({ code: "totp_required" });
      // global
      await svc.users.adminAction(admin, b.id, { action: "unrequireTotp" });
      const c = await mkUser(a, "cleo");
      const tc = await svc.auth.createSessionFor(c.id);
      expect((await svc.auth.resolveSession(tc))?.totpSetupRequired).toBe(false);
      await svc.settings.updateAdminSettings({ totpRequiredAll: true });
      expect((await svc.auth.resolveSession(tc))?.totpSetupRequired).toBe(true);
      expect(await svc.totp.totpStatus(b.id)).toMatchObject({ required: true });
    });

    it("Wiederherstellungscodes: Anzahl 0–20 einstellbar, Neuerzeugung macht alte ungültig", async () => {
      const a = await svc.users.setupAdmin({ username: "anna", password: PW });
      await svc.settings.updateAdminSettings({ recoveryCodeCount: 3 });
      const { secret } = await svc.totp.startEnrollment(a.id);
      const { recoveryCodes: first } = await svc.totp.confirmEnrollment(a.id, codeAt(secret, -1));
      expect(first).toHaveLength(3);
      await expect(svc.totp.regenerateRecoveryCodes(a.id, "falsch")).rejects.toMatchObject({ code: "invalid_credentials" });
      await svc.settings.updateAdminSettings({ recoveryCodeCount: 0 });
      const { recoveryCodes: second } = await svc.totp.regenerateRecoveryCodes(a.id, PW);
      expect(second).toHaveLength(0);
      const ch = svc.totp.issueChallenge(a.id);
      await expect(svc.totp.completeLogin(ch, first[0])).rejects.toMatchObject({ code: "invalid_code" });
      expect((await svc.settings.getAdminSettings()).recoveryCodeCount).toBe(0);
    });

    it("Admin-Reset: TOTP weg, Codes weg, Sitzungen beendet", async () => {
      const { a, b } = await enrolled();
      const token = await svc.auth.createSessionFor(b.id);
      const r = await svc.users.adminAction(actor(a), b.id, { action: "resetTotp" });
      expect(r).toMatchObject({ user: { totpEnabled: false } });
      expect(await svc.auth.resolveSession(token)).toBeNull();
      const [{ n }] = (await svc.getDb().execute(svc.sql`select count(*)::int as n from recovery_codes`)) as unknown as { n: number }[];
      expect(n).toBe(0);
      await expect(svc.users.adminAction(actor(b as unknown as U), a.id, { action: "resetTotp" })).rejects.toMatchObject({ status: 403 });
    });

    it("Dev-Admin ist vom Zwang ausgenommen", async () => {
      process.env.DEV_ADMIN = "true";
      try {
        await svc.users.ensureDevAdmin();
        await svc.settings.updateAdminSettings({ totpRequiredAll: true });
        const a = (await svc.users.devLogin()) as unknown as U;
        const token = await svc.auth.createSessionFor(a.id);
        expect((await svc.auth.resolveSession(token))?.totpSetupRequired).toBe(false);
      } finally {
        delete process.env.DEV_ADMIN;
      }
    });
  });
  describe("Gelöschte Ausgaben wiederherstellen", () => {
    it("Löschen und Wiederherstellen: Saldo, Papierkorb, Verlauf, Benachrichtigung, Rechte", async () => {
      const { a, b, c, g } = await setup();
      const e = await svc.expenses.createExpense(
        a.id,
        g.id,
        base({ title: "Miete", amountMinor: 1000, payers: [{ userId: a.id, amountMinor: 1000 }], split: { type: "equal", participants: [a.id, b.id] } }),
      );
      const open = async () => JSON.stringify(await svc.balances.getGroupBalances(a.id, g.id));
      expect(await open()).toContain("500");
      await svc.expenses.deleteExpense(b.id, g.id, e.id);
      expect(await open()).not.toContain("500");
      expect((await svc.expenses.listExpenses(a.id, g.id, { onlyDeleted: true })).map((x) => x.title)).toEqual(["Miete"]);
      // Nichtmitglied: 404
      const outsider = await mkUser(a, "dora");
      await expect(svc.expenses.restoreExpense(outsider.id, g.id, e.id)).rejects.toMatchObject({ status: 404 });
      await svc.expenses.restoreExpense(b.id, g.id, e.id);
      await svc.expenses.restoreExpense(b.id, g.id, e.id); // idempotent
      expect(await open()).toContain("500");
      expect(await svc.expenses.listExpenses(a.id, g.id, { onlyDeleted: true })).toHaveLength(0);
      const hist = await svc.expenses.expenseHistoryFor(a.id, g.id, e.id);
      expect(hist.map((h) => h.action)).toEqual(["restore", "delete", "create"]);
      const notes = await svc.notifications.listNotifications(c.id);
      expect(notes.some((n) => n.type === "expense_restored")).toBe(true);
    });
  });

  describe("Wiederkehrende Ausgaben", () => {
    const monthsAgo = (n: number) => {
      const d = new Date();
      d.setUTCDate(1);
      d.setUTCMonth(d.getUTCMonth() - n);
      return d.toISOString().slice(0, 10);
    };
    const tpl = (a: U, b: U, over: Record<string, unknown> = {}) => ({
      title: "Miete",
      amountMinor: 90000,
      currency: "EUR",
      category: "other" as const,
      payers: [{ userId: a.id, amountMinor: 90000 }],
      split: { type: "equal" as const, participants: [a.id, b.id] },
      unit: "month" as const,
      every: 1,
      startDate: monthsAgo(3),
      ...over,
    });
    const countExpenses = async (rid: string) =>
      Number(((await svc.getDb().execute(svc.sql`select count(*)::int as n from expenses where recurring_id = ${rid}`)) as unknown as { n: number }[])[0].n);

    it("Anlegen bucht verpasste Termine sofort, mit Vorlagen-Ersteller, Kennzeichnung und Benachrichtigung; zweiter Lauf bucht nichts doppelt", async () => {
      const { a, b, g } = await setup();
      const r = await svc.recurring.createRecurring(a.id, g.id, tpl(a, b));
      expect(r.booked).toBe(4); // vor 3 Monaten bis heute, monatlich
      expect(await countExpenses(r.id)).toBe(4);
      const list = await svc.expenses.listExpenses(a.id, g.id);
      expect(list.every((e) => e.recurringId === r.id && e.createdBy === a.id)).toBe(true);
      expect(new Set(list.map((e) => e.date)).size).toBe(4);
      expect(await svc.recurring.runDueRecurring()).toBe(0);
      const notes = await svc.notifications.listNotifications(b.id);
      expect(notes).toHaveLength(4);
      expect((notes[0].data as { auto?: boolean }).auto).toBe(true);
      expect(svc.notifications.renderNotification("de", notes[0].type, notes[0].data as never)).toContain("automatisch");
      // Zeit läuft weiter: ein Monat später ist ein weiterer Termin fällig
      const later = new Date();
      later.setUTCMonth(later.getUTCMonth() + 1);
      expect(await svc.recurring.runDueRecurring(later)).toBe(1);
    });

    it("parallele Läufe buchen jeden Termin genau einmal", async () => {
      const { a, b, g } = await setup();
      const created = await svc.recurring.createRecurring(a.id, g.id, tpl(a, b, { startDate: monthsAgo(-2), paused: true }));
      await svc.recurring.setRecurringPaused(a.id, g.id, created.id, false); // nichts fällig
      const later = new Date();
      later.setUTCMonth(later.getUTCMonth() + 5);
      const res = await Promise.all([svc.recurring.bookDue(created.id, later), svc.recurring.bookDue(created.id, later), svc.recurring.runDueRecurring(later)]);
      const total = res.reduce((x, y) => x + y, 0);
      expect(await countExpenses(created.id)).toBe(total);
      expect(total).toBe(4); // +2 bis +5 Monate
      const dates = (await svc.expenses.listExpenses(a.id, g.id)).map((e) => e.date);
      expect(new Set(dates).size).toBe(dates.length);
    });

    it("Enddatum begrenzt, Pause stoppt, Fortsetzen holt nach, Löschen lässt Buchungen stehen", async () => {
      const { a, b, g } = await setup();
      const r = await svc.recurring.createRecurring(a.id, g.id, tpl(a, b, { startDate: monthsAgo(5), endDate: monthsAgo(3) }));
      expect(r.booked).toBe(3); // -5, -4, -3
      const v = await svc.recurring.getRecurring(a.id, g.id, r.id);
      expect(v.finished).toBe(true);
      const p = await svc.recurring.createRecurring(a.id, g.id, tpl(a, b, { title: "Abo", startDate: monthsAgo(2), paused: true }));
      expect(p.booked).toBe(0);
      const resumed = await svc.recurring.setRecurringPaused(a.id, g.id, p.id, false);
      expect(resumed.booked).toBe(3);
      await svc.recurring.deleteRecurring(a.id, g.id, p.id);
      expect(await countExpenses(p.id)).toBe(3);
      expect((await svc.recurring.listRecurring(a.id, g.id)).items.map((i) => i.title)).toEqual(["Miete"]);
    });

    it("Rechte: Besitzer-Richtlinie, Nichtmitglieder (404), Leser dürfen nur lesen", async () => {
      const { a, b, g } = await setup();
      const outsider = await mkUser(a, "dora");
      await expect(svc.recurring.createRecurring(outsider.id, g.id, tpl(a, b))).rejects.toMatchObject({ status: 404 });
      await expect(svc.recurring.listRecurring(outsider.id, g.id)).rejects.toMatchObject({ status: 404 });
      await svc.recurring.setRecurringPolicy(a.id, g.id, "owner");
      await expect(svc.recurring.createRecurring(b.id, g.id, tpl(b, a))).rejects.toMatchObject({ status: 403 });
      expect((await svc.recurring.listRecurring(b.id, g.id)).policy).toBe("owner"); // lesen geht
      await expect(svc.recurring.setRecurringPolicy(b.id, g.id, "members")).rejects.toMatchObject({ status: 403 });
      const ok = await svc.recurring.createRecurring(a.id, g.id, tpl(a, b, { startDate: monthsAgo(-1) }));
      await expect(svc.recurring.setRecurringPaused(b.id, g.id, ok.id, true)).rejects.toMatchObject({ status: 403 });
      await expect(svc.recurring.deleteRecurring(b.id, g.id, ok.id)).rejects.toMatchObject({ status: 403 });
      await svc.recurring.setRecurringPolicy(a.id, g.id, "members");
      await svc.recurring.setRecurringPaused(b.id, g.id, ok.id, true);
    });

    it("Validierung beim Anlegen: Nichtmitglied in der Aufteilung, Summe der Zahler, Enddatum vor Start", async () => {
      const { a, b, g } = await setup();
      const outsider = await mkUser(a, "dora");
      await expect(svc.recurring.createRecurring(a.id, g.id, tpl(a, b, { split: { type: "equal", participants: [a.id, outsider.id] } }))).rejects.toMatchObject({ code: "not_a_member" });
      await expect(svc.recurring.createRecurring(a.id, g.id, tpl(a, b, { payers: [{ userId: a.id, amountMinor: 1 }] }))).rejects.toBeTruthy();
      await expect(svc.recurring.createRecurring(a.id, g.id, tpl(a, b, { endDate: monthsAgo(9) }))).rejects.toMatchObject({ code: "end_before_start" });
    });

    it("Ausgetretenes Mitglied: Vorlage pausiert mit Hinweis, nichts wird gebucht; nach Anpassung geht es weiter", async () => {
      const { a, b, g } = await setup();
      const r = await svc.recurring.createRecurring(a.id, g.id, tpl(a, b, { startDate: monthsAgo(-1) }));
      await svc.getDb().execute(svc.sql`delete from group_members where group_id = ${g.id} and user_id = ${b.id}`);
      const later = new Date();
      later.setUTCMonth(later.getUTCMonth() + 2);
      expect(await svc.recurring.runDueRecurring(later)).toBe(0);
      const v = await svc.recurring.getRecurring(a.id, g.id, r.id);
      expect(v).toMatchObject({ paused: true, lastError: "member_left" });
      expect(await countExpenses(r.id)).toBe(0);
      // anpassen (nur noch Anna) und fortsetzen
      const fixed = tpl(a, b, { startDate: monthsAgo(-1), split: { type: "equal", participants: [a.id] }, paused: false });
      await svc.recurring.updateRecurring(a.id, g.id, r.id, fixed);
      expect((await svc.recurring.getRecurring(a.id, g.id, r.id)).lastError).toBeNull();
    });

    it("Kursdienst nicht erreichbar: nicht pausiert, nicht fortgeschritten, später erneut; kein geratener Kurs", async () => {
      const { a, b, g } = await setup();
      svc.rates.setRateProvider({ name: "down", historical: true, fetchRates: async () => { throw new Error("offline"); } });
      try {
        const r = await svc.recurring.createRecurring(a.id, g.id, tpl(a, b, { currency: "USD", startDate: monthsAgo(1) }));
        expect(r.booked).toBe(0);
        const v = await svc.recurring.getRecurring(a.id, g.id, r.id);
        expect(v).toMatchObject({ paused: false, lastError: "rate_unavailable", startDate: monthsAgo(1), nextDate: monthsAgo(1) });
        svc.rates.setRateProvider({ name: "ok", historical: true, fetchRates: async () => ({ USD: 1.25, EUR: 1 }) });
        expect(await svc.recurring.runDueRecurring()).toBe(2);
        expect((await svc.recurring.getRecurring(a.id, g.id, r.id)).lastError).toBeNull();
        const e = (await svc.expenses.listExpenses(a.id, g.id))[0];
        expect(e.rateSource).toBe("provider");
      } finally {
        svc.rates.setRateProvider(null);
      }
    });

    it("Ändern: nur Betrag behält die Folge, neuer Rhythmus beginnt neu; Fehler beim Starten laufen nicht ins Leere", async () => {
      const { a, b, g } = await setup();
      const r = await svc.recurring.createRecurring(a.id, g.id, tpl(a, b, { startDate: monthsAgo(2) }));
      expect(r.booked).toBe(3);
      const before = (await svc.recurring.getRecurring(a.id, g.id, r.id)).nextDate;
      const res = await svc.recurring.updateRecurring(a.id, g.id, r.id, tpl(a, b, { startDate: monthsAgo(2), amountMinor: 100000, payers: [{ userId: a.id, amountMinor: 100000 }] }));
      expect(res.booked).toBe(0);
      expect((await svc.recurring.getRecurring(a.id, g.id, r.id)).nextDate).toBe(before);
      // neuer Start in der Zukunft: Folge beginnt neu, bereits gebuchte Termine bleiben
      const future = monthsAgo(-2);
      await svc.recurring.updateRecurring(a.id, g.id, r.id, tpl(a, b, { startDate: future }));
      expect((await svc.recurring.getRecurring(a.id, g.id, r.id)).nextDate).toBe(future);
      expect(await countExpenses(r.id)).toBe(3);
    });

    it("Testnutzer kann Vorlagen anlegen; Löschen des Testnutzers wird bei Vorlagen in gemischten Gruppen blockiert", async () => {
      const { a, b, g } = await setup();
      await svc.settings.updateAdminSettings({ testFeaturesEnabled: true });
      const [created] = await svc.testUsers.createTestUsers(actor(a), { name: "QA T", username: "qa-t" });
      const tid = (created as { id: string }).id;
      await svc.testUsers.addToGroup(actor(a), tid, g.id, { role: "member", confirmed: true });
      await svc.recurring.createRecurring(tid, g.id, tpl({ id: tid } as U, b, { startDate: monthsAgo(-1), split: { type: "equal", participants: [tid, b.id] }, payers: [{ userId: tid, amountMinor: 90000 }] }));
      await expect(svc.testUsers.deleteTestUser(actor(a), tid)).rejects.toMatchObject({ code: "test_user_in_real_group" });
    });

    it("Frei einstellbarer Rhythmus: alle 2 Wochen", async () => {
      const { a, b, g } = await setup();
      const start = new Date(Date.now() - 29 * 86400_000).toISOString().slice(0, 10);
      const r = await svc.recurring.createRecurring(a.id, g.id, tpl(a, b, { unit: "week", every: 2, startDate: start }));
      expect(r.booked).toBe(3); // Tag 0, 14, 28
      expect(svc.recurrence.occurrence(start, "week", 2, 1)).toBe(new Date(Date.parse(start) + 14 * 86400_000).toISOString().slice(0, 10));
    });
  });

  describe("Export, Archiv, Mitglieder ohne Konto", () => {
    it("CSV: Kopfzeile, Zeilen, Saldo, Trennzeichen je Sprache, Formel-Schutz, Rechte", async () => {
      const { a, b, c, g } = await setup();
      await svc.expenses.createExpense(a.id, g.id, base({ title: "=SUM(A1)", amountMinor: 3000, payers: [{ userId: a.id, amountMinor: 3000 }], split: { type: "equal", participants: [a.id, b.id, c.id] } }));
      await svc.payments.createPayment(b.id, g.id, { fromUser: b.id, toUser: a.id, amountMinor: 1000, currency: "EUR", date: "2026-01-03" });
      const de = await svc.exporter.groupCsv(a.id, g.id, "de");
      const lines = de.csv.replace("\uFEFF", "").trim().split("\r\n");
      expect(lines[0]).toContain("Art;Datum;Titel");
      expect(lines[0]).toContain("Anna bezahlt;Anna Anteil");
      expect(lines).toHaveLength(4); // Kopf, Ausgabe, Zahlung, Saldo EUR
      expect(lines[1]).toContain("'=SUM(A1)");
      expect(lines[1]).toContain("30,00");
      expect(lines[3].startsWith("Saldo;")).toBe(true);
      expect(lines[3]).toContain("10,00"); // Anna: +20 - 10 erhalten = +10
      const en = await svc.exporter.groupCsv(a.id, g.id, "en");
      expect(en.csv).toContain("Type,Date,Title");
      expect(en.csv).toContain("30.00");
      expect(de.filename).toMatch(/^finantsen-WG-\d{4}-\d{2}-\d{2}\.csv$/);
      const outsider = await mkUser(a, "dora");
      await expect(svc.exporter.groupCsv(outsider.id, g.id, "de")).rejects.toMatchObject({ status: 404 });
    });

    it("Konto-Export: eigene Gruppen mit Daten, keine Geheimnisse", async () => {
      const { a, b, g } = await setup();
      await svc.expenses.createExpense(a.id, g.id, base({ payers: [{ userId: a.id, amountMinor: 3000 }], split: { type: "equal", participants: [a.id, b.id] } }));
      const data = await svc.exporter.accountExport(b.id);
      expect(data.groups).toHaveLength(1);
      expect(data.groups[0].expenses).toHaveLength(1);
      expect(data.groups[0].balances.EUR[b.id]).toBe(-1500);
      const text = JSON.stringify(data);
      expect(text).not.toMatch(/password|totp_secret|totpSecret|argon2/i);
    });

    it("Archiv gilt nur für das eigene Konto, Salden zählen weiter", async () => {
      const { a, b, g } = await setup();
      await svc.expenses.createExpense(a.id, g.id, base({ payers: [{ userId: a.id, amountMinor: 3000 }], split: { type: "equal", participants: [a.id, b.id] } }));
      await svc.groups.setArchived(b.id, g.id, true);
      expect((await svc.groups.listGroups(b.id)).find((x) => x.id === g.id)?.archived).toBe(true);
      expect((await svc.groups.listGroups(a.id)).find((x) => x.id === g.id)?.archived).toBe(false);
      expect((await svc.balances.overallBalances(b.id)).totals.EUR).toBe(-1500);
      await svc.groups.setArchived(b.id, g.id, false);
      expect((await svc.groups.listGroups(b.id)).find((x) => x.id === g.id)?.archived).toBe(false);
      const outsider = await mkUser(a, "dora");
      await expect(svc.groups.setArchived(outsider.id, g.id, true)).rejects.toMatchObject({ status: 404 });
    });

    it("Gast: anlegen, mitrechnen, nie anmeldbar, keine Benachrichtigung, Löschen nur ohne Daten", async () => {
      const { a, b, g } = await setup();
      const oma = await svc.guests.addGuest(b.id, g.id, "Oma");
      const leer = await svc.guests.addGuest(a.id, g.id, "Leer");
      const members = (await svc.groups.getGroup(a.id, g.id)).members;
      expect(members.find((m) => m.id === oma.id)).toMatchObject({ isGuest: true, name: "Oma (Gast)" });
      await svc.expenses.createExpense(a.id, g.id, base({ payers: [{ userId: oma.id, amountMinor: 3000 }], split: { type: "equal", participants: [a.id, oma.id] } }));
      expect((await svc.balances.getGroupBalances(a.id, g.id)).net.EUR[oma.id]).toBe(1500);
      expect(await svc.notifications.listNotifications(oma.id)).toHaveLength(0);
      const [row] = (await svc.getDb().execute(svc.sql`select username from users where id = ${oma.id}`)) as unknown as { username: string }[];
      expect(await svc.users.authenticate(row.username, "irgendwas")).toMatchObject({ kind: "invalid" });
      expect((await svc.users.listUsers(actor(a))).some((u) => u.id === oma.id)).toBe(false);
      await expect(svc.guests.deleteGuest(a.id, g.id, oma.id)).rejects.toMatchObject({ code: "guest_has_data" });
      await svc.guests.deleteGuest(a.id, g.id, leer.id);
      await svc.guests.renameGuest(a.id, g.id, oma.id, "Oma Erna");
      expect((await svc.groups.getGroup(a.id, g.id)).members.find((m) => m.id === oma.id)?.name).toBe("Oma Erna (Gast)");
      const outsider = await mkUser(a, "dora");
      await expect(svc.guests.addGuest(outsider.id, g.id, "x")).rejects.toMatchObject({ status: 404 });
      await expect(svc.guests.createGuestLink(outsider.id, g.id, oma.id)).rejects.toMatchObject({ status: 404 });
      const friend = await svc.groups.createGroup(a.id, { name: "direct", defaultCurrency: "EUR", kind: "direct" });
      await expect(svc.guests.addGuest(a.id, friend.id, "x")).rejects.toMatchObject({ code: "direct_group" });
    });

    it("Gast übernehmen: neues Mitglied erbt alles, bestehendes Mitglied wird zusammengeführt, Link nur einmal", async () => {
      const { a, b, c, g } = await setup();
      const oma = await svc.guests.addGuest(a.id, g.id, "Oma");
      // Ausgabe 1: Oma und Ben zahlen gemeinsam, Anteile Oma 40 %, Ben 30 %, Anna 30 %
      await svc.expenses.createExpense(a.id, g.id, base({
        amountMinor: 1000,
        payers: [{ userId: oma.id, amountMinor: 600 }, { userId: b.id, amountMinor: 400 }],
        split: { type: "percent", entries: [{ userId: oma.id, bp: 4000 }, { userId: b.id, bp: 3000 }, { userId: a.id, bp: 3000 }] },
      }));
      // Ausgabe 2: Einzelposten mit Oma
      await svc.expenses.createExpense(a.id, g.id, base({
        amountMinor: 500, payers: [{ userId: a.id, amountMinor: 500 }],
        split: { type: "items", items: [{ name: "Kuchen", amountMinor: 500, participants: [oma.id, b.id] }], taxMinor: 0, tipMinor: 0 },
      }));
      await svc.payments.createPayment(a.id, g.id, { fromUser: b.id, toUser: oma.id, amountMinor: 100, currency: "EUR", date: "2026-01-05" });
      await svc.recurring.createRecurring(a.id, g.id, { title: "Abo", amountMinor: 900, currency: "EUR", category: "other", payers: [{ userId: oma.id, amountMinor: 900 }], split: { type: "equal", participants: [oma.id, b.id] }, unit: "month", every: 1, startDate: "2099-01-01" });
      const before = (await svc.balances.getGroupBalances(a.id, g.id)).net.EUR;
      const sum = (before[oma.id] ?? 0) + (before[b.id] ?? 0);

      const link = await svc.guests.createGuestLink(a.id, g.id, oma.id);
      expect((await svc.groups.previewInvite(link.code))?.guestName).toBe("Oma");
      await svc.groups.acceptInvite(b.id, link.code); // Ben (schon Mitglied) übernimmt
      await expect(svc.groups.acceptInvite(c.id, link.code)).rejects.toMatchObject({ code: "invite_invalid" });

      const after = (await svc.balances.getGroupBalances(a.id, g.id)).net.EUR;
      expect(after[oma.id] ?? 0).toBe(0);
      expect(after[b.id]).toBe(sum); // Salden zusammengeführt, Summe bleibt
      expect(Object.values(after).reduce((x, y) => x + y, 0)).toBe(0);
      const list = await svc.expenses.listExpenses(a.id, g.id);
      const e1 = list.find((e) => e.amountMinor === 1000)!;
      expect(e1.payers).toEqual([expect.objectContaining({ userId: b.id, amountMinor: 1000 })]);
      expect(e1.shares.find((s) => s.userId === b.id)).toMatchObject({ amountMinor: 700, input: 7000 });
      const e2 = list.find((e) => e.amountMinor === 500)!;
      expect(JSON.stringify(e2.items)).not.toContain(oma.id);
      expect((await svc.payments.listPayments(a.id, g.id)).length).toBe(0); // Ben→Oma wurde Ben→Ben: aufgehoben
      const tpl = (await svc.recurring.listRecurring(a.id, g.id)).items[0].template;
      expect(tpl.payers).toEqual([{ userId: b.id, amountMinor: 900 }]);
      expect(tpl.split).toEqual({ type: "equal", participants: [b.id] });
      expect((await svc.groups.getGroup(a.id, g.id)).members.some((m) => m.id === oma.id)).toBe(false);
      const hist = await svc.expenses.expenseHistoryFor(a.id, g.id, e1.id);
      expect(JSON.stringify(hist)).not.toContain(oma.id);
    });

    it("Gast übernehmen durch ein neues Konto macht es zum Mitglied; Gruppe löschen entfernt Gäste", async () => {
      const { a, g } = await setup();
      const opa = await svc.guests.addGuest(a.id, g.id, "Opa");
      await svc.expenses.createExpense(a.id, g.id, base({ payers: [{ userId: a.id, amountMinor: 3000 }], split: { type: "equal", participants: [a.id, opa.id] } }));
      const dora = await mkUser(a, "dora");
      const link = await svc.guests.createGuestLink(a.id, g.id, opa.id);
      const res = await svc.groups.acceptInvite(dora.id, link.code);
      expect(res.groupId).toBe(g.id);
      expect((await svc.balances.getGroupBalances(a.id, g.id)).net.EUR[dora.id]).toBe(-1500);
      const opa2 = await svc.guests.addGuest(a.id, g.id, "Opa 2");
      await svc.expenses.createExpense(a.id, g.id, base({ payers: [{ userId: opa2.id, amountMinor: 3000 }], split: { type: "equal", participants: [a.id, opa2.id] } }));
      await svc.groups.deleteGroup(a.id, g.id);
      const [{ n }] = (await svc.getDb().execute(svc.sql`select count(*)::int as n from users where kind = 'guest'`)) as unknown as { n: number }[];
      expect(n).toBe(0);
    });
  });

  describe("Passkeys", () => {
    const rp = { id: "localhost", origin: "http://localhost:3000" };
    const addRow = (userId: string, cred: string) =>
      svc.getDb().execute(svc.sql`insert into passkeys (user_id, credential_id, public_key, name) values (${userId}, ${cred}, 'AA', 'Handy')`);

    it("Einrichten und Löschen verlangen das Passwort; fremde Passkeys sind unerreichbar", async () => {
      const a = await svc.users.setupAdmin({ username: "anna", password: PW });
      const b = await mkUser(a, "ben");
      await expect(svc.passkeys.registrationOptions(b.id, "falsch", rp)).rejects.toMatchObject({ code: "invalid_credentials" });
      const { options, token } = await svc.passkeys.registrationOptions(b.id, PW, rp);
      expect(options.rp.id).toBe("localhost");
      expect(options.authenticatorSelection?.userVerification).toBe("required");
      expect(token).toContain(".");
      await addRow(b.id, "cred-ben");
      const [row] = await svc.passkeys.listPasskeys(b.id);
      await expect(svc.passkeys.deletePasskey(a.id, row.id, PW)).rejects.toMatchObject({ code: "not_found" }); // anderes Konto
      await expect(svc.passkeys.deletePasskey(b.id, row.id, "falsch")).rejects.toMatchObject({ code: "invalid_credentials" });
      await svc.passkeys.deletePasskey(b.id, row.id, PW);
      expect(await svc.passkeys.passkeyCount(b.id)).toBe(0);
    });

    it("Registrierungs-Token gehört zu genau einem Konto", async () => {
      const a = await svc.users.setupAdmin({ username: "anna", password: PW });
      const b = await mkUser(a, "ben");
      const { token } = await svc.passkeys.registrationOptions(b.id, PW, rp);
      await expect(svc.passkeys.registerPasskey(a.id, { token, response: {} as never, name: "x" }, rp)).rejects.toMatchObject({ code: "challenge_invalid" });
      await expect(svc.passkeys.registerPasskey(b.id, { token, response: { id: "x" } as never, name: "x" }, rp)).rejects.toMatchObject({ code: "passkey_invalid" });
    });

    it("Anmelde-Optionen sehen für unbekannte Konten und Konten ohne Passkey gleich aus; Fehlversuche zählen auf dem Konto", async () => {
      const a = await svc.users.setupAdmin({ username: "anna", password: PW });
      const b = await mkUser(a, "ben");
      await addRow(b.id, "cred-ben");
      const known = await svc.passkeys.authenticationOptions("anna", rp);
      const unknown = await svc.passkeys.authenticationOptions("niemand", rp);
      expect(known.options.allowCredentials).toHaveLength(1);
      expect(unknown.options.allowCredentials).toHaveLength(1);
      const real = await svc.passkeys.authenticationOptions("ben", rp);
      expect(real.options.allowCredentials?.[0].id).toBe("cred-ben");
      await expect(svc.passkeys.completePasskeyLogin("x.y", { id: "cred-ben" } as never, rp)).rejects.toMatchObject({ code: "challenge_invalid" });
      for (let i = 0; i < 5; i++) await expect(svc.passkeys.completePasskeyLogin(real.token, { id: "cred-ben", rawId: "cred-ben", type: "public-key", response: {}, clientExtensionResults: {} } as never, rp)).rejects.toMatchObject({ code: "invalid_credentials" });
      await expect(svc.passkeys.completePasskeyLogin(real.token, { id: "cred-ben" } as never, rp)).rejects.toMatchObject({ status: 429 });
    });

    it("Ein Passkey erfüllt den TOTP-Zwang; Admin-Reset entfernt Passkeys; Testnutzer/Löschen kaskadiert", async () => {
      const a = await svc.users.setupAdmin({ username: "anna", password: PW });
      const b = await mkUser(a, "ben");
      await svc.users.adminAction(actor(a), b.id, { action: "requireTotp" });
      const token = await svc.auth.createSessionFor(b.id);
      expect((await svc.auth.resolveSession(token))?.totpSetupRequired).toBe(true);
      await addRow(b.id, "cred-ben");
      expect((await svc.auth.resolveSession(token))?.totpSetupRequired).toBe(false);
      const list = await svc.users.listUsers(actor(a));
      expect(list.find((u) => u.username === "ben")?.passkeyCount).toBe(1);
      await svc.users.adminAction(actor(a), b.id, { action: "resetTotp" });
      expect(await svc.passkeys.passkeyCount(b.id)).toBe(0);
    });
  });
});
