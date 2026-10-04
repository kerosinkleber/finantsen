// Integrationstests gegen eine echte PostgreSQL-DB. Werden nur ausgeführt, wenn TEST_DATABASE_URL gesetzt ist.
import type { ExpenseBody } from "@/lib/schemas";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

const url = process.env.TEST_DATABASE_URL;
const d = url ? describe : describe.skip;

d("services (PostgreSQL)", () => {
  let svc: Awaited<ReturnType<typeof load>>;

  async function load() {
    process.env.DATABASE_URL = url;
    process.env.REGISTRATION_ENABLED = "false";
    const [{ getDb, closeDb }, { runMigrations }, users, groups, expenses, balances, payments, { sql }, comments, notifications, stats, rates, settings] = await Promise.all([
      import("../db"),
      import("../migrate"),
      import("./users"),
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
    ]);
    return { getDb, closeDb, runMigrations, users, groups, expenses, balances, payments, sql, comments, notifications, stats, rates, settings };
  }

  beforeAll(async () => {
    svc = await load();
    await svc.runMigrations(2);
  });
  afterAll(async () => svc?.closeDb());
  beforeEach(async () => {
    await svc.getDb().execute(svc.sql`truncate users, groups, settings, exchange_rates cascade`);
  });

  async function setup() {
    const a = await svc.users.registerUser({ email: "a@x.de", name: "Anna", password: "password1" });
    const g = await svc.groups.createGroup(a.id, { name: "WG", defaultCurrency: "EUR" });
    const inv = await svc.groups.createInvite(a.id, g.id);
    const b = await svc.users.registerUser({ email: "b@x.de", name: "Ben", password: "password1", inviteCode: inv.code });
    const inv2 = await svc.groups.createInvite(a.id, g.id);
    const c = await svc.users.registerUser({ email: "c@x.de", name: "Cleo", password: "password1", inviteCode: inv2.code });
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

  it("erster Nutzer ist Admin; Registrierung kann abgeschaltet sein; Einladung umgeht das", async () => {
    const { a, b } = await setup();
    expect(a.isAdmin).toBe(true);
    expect(b.isAdmin).toBe(false);
    await expect(svc.users.registerUser({ email: "z@x.de", name: "Z", password: "password1" })).rejects.toMatchObject({ code: "registration_disabled" });
    await expect(svc.users.registerUser({ email: "A@X.de", name: "Z", password: "password1", inviteCode: "nope" })).rejects.toMatchObject({ code: "invite_invalid" });
  });

  it("E-Mail-Eindeutigkeit (case-insensitive) gilt, wenn der Admin Duplikate abschaltet; Login funktioniert", async () => {
    const { a } = await setup();
    await svc.settings.updateAdminSettings({ allowDuplicateEmails: false });
    const inv = await svc.groups.createInvite(a.id, (await svc.groups.listGroups(a.id))[0].id);
    await expect(svc.users.registerUser({ email: "A@x.de", name: "X", password: "password1", inviteCode: inv.code })).rejects.toMatchObject({ code: "email_taken" });
    expect(await svc.users.authenticate("a@x.de", "password1")).toHaveLength(1);
    expect(await svc.users.authenticate("a@x.de", "wrong")).toHaveLength(0);
    expect(await svc.users.authenticate("nobody@x.de", "password1")).toHaveLength(0);
  });

  it("Nicht-Mitglieder sehen und ändern nichts (404)", async () => {
    const { a, g } = await setup();
    const inv = await svc.groups.createGroup(a.id, { name: "Privat", defaultCurrency: "EUR" });
    const invite = await svc.groups.createInvite(a.id, g.id);
    const d = await svc.users.registerUser({ email: "d@x.de", name: "Dora", password: "password1", inviteCode: invite.code });
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

  describe("Mehrere Konten pro E-Mail", () => {
    it("ist standardmäßig erlaubt; Login liefert alle Konten mit passendem Passwort", async () => {
      expect(await svc.settings.allowDuplicateEmails()).toBe(true);
      const { a, g } = await setup();
      const mk = async (name: string, password: string) => {
        const inv = await svc.groups.createInvite(a.id, g.id);
        return svc.users.registerUser({ email: "Zwilling@X.de", name, password, inviteCode: inv.code });
      };
      const z1 = await mk("Zwilling Eins", "password1");
      const z2 = await mk("Zwilling Zwei", "password1");
      const z3 = await mk("Zwilling Drei", "anderes-pw-123");
      expect(new Set([z1.id, z2.id, z3.id]).size).toBe(3);
      const same = await svc.users.authenticate("zwilling@x.de", "password1");
      expect(same.map((u) => u.name)).toEqual(["Zwilling Eins", "Zwilling Zwei"]);
      const other = await svc.users.authenticate("zwilling@x.de", "anderes-pw-123");
      expect(other.map((u) => u.name)).toEqual(["Zwilling Drei"]);
      expect(await svc.users.authenticate("zwilling@x.de", "falsch")).toHaveLength(0);
    });

    it("Admin kann es abschalten (nur neue Registrierungen betroffen) und wieder einschalten", async () => {
      const { a, g } = await setup();
      const reg = async (email: string) => {
        const inv = await svc.groups.createInvite(a.id, g.id);
        return svc.users.registerUser({ email, name: "N", password: "password1", inviteCode: inv.code });
      };
      await reg("dup@x.de");
      await reg("dup@x.de"); // erlaubt
      await svc.settings.updateAdminSettings({ allowDuplicateEmails: false });
      await expect(reg("DUP@x.de")).rejects.toMatchObject({ status: 409, code: "email_taken" });
      await reg("neu@x.de"); // andere E-Mail geht weiterhin
      expect(await svc.users.authenticate("dup@x.de", "password1")).toHaveLength(2); // Bestand bleibt
      await svc.settings.updateAdminSettings({ allowDuplicateEmails: true });
      await reg("dup@x.de");
      expect(await svc.users.authenticate("dup@x.de", "password1")).toHaveLength(3);
    });
  });
});
