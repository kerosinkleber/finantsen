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
    const [{ getDb, closeDb }, { runMigrations }, users, groups, expenses, balances, payments, { sql }] = await Promise.all([
      import("../db"),
      import("../migrate"),
      import("./users"),
      import("./groups"),
      import("./expenses"),
      import("./balances"),
      import("./payments"),
      import("drizzle-orm"),
    ]);
    return { getDb, closeDb, runMigrations, users, groups, expenses, balances, payments, sql };
  }

  beforeAll(async () => {
    svc = await load();
    await svc.runMigrations(2);
  });
  afterAll(async () => svc?.closeDb());
  beforeEach(async () => {
    await svc.getDb().execute(svc.sql`truncate users, groups, settings cascade`);
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

  it("E-Mail ist eindeutig (case-insensitive) und Login funktioniert", async () => {
    const { a } = await setup();
    const inv = await svc.groups.createInvite(a.id, (await svc.groups.listGroups(a.id))[0].id);
    await expect(svc.users.registerUser({ email: "A@x.de", name: "X", password: "password1", inviteCode: inv.code })).rejects.toMatchObject({ code: "email_taken" });
    expect(await svc.users.authenticate("a@x.de", "password1")).not.toBeNull();
    expect(await svc.users.authenticate("a@x.de", "wrong")).toBeNull();
    expect(await svc.users.authenticate("nobody@x.de", "password1")).toBeNull();
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

  it("Währungen getrennt, JPY ohne Nachkommastellen", async () => {
    const { a, b, g } = await setup();
    await svc.expenses.createExpense(a.id, g.id, base({ currency: "JPY", amountMinor: 1001, payers: [{ userId: a.id, amountMinor: 1001 }], split: { type: "equal", participants: [a.id, b.id] } }));
    await svc.expenses.createExpense(b.id, g.id, base({ amountMinor: 500, payers: [{ userId: b.id, amountMinor: 500 }], split: { type: "equal", participants: [a.id, b.id] } }));
    const bal = await svc.balances.getGroupBalances(a.id, g.id);
    // 1001 JPY auf zwei: 501/500, der Restyen geht deterministisch an die kleinere ID
    const lo = [a.id, b.id].sort()[0];
    const aShare = a.id === lo ? 501 : 500;
    expect(bal.net.JPY).toEqual({ [a.id]: 1001 - aShare, [b.id]: -(1001 - aShare) });
    expect(bal.net.EUR).toEqual({ [b.id]: 250, [a.id]: -250 });
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
});
