import { and, desc, eq, inArray, isNull } from "drizzle-orm";
import { getDb, type Tx } from "../db";
import { expenseHistory, expensePayers, expenseShares, expenses, users } from "../schema";
import { ApiError, notFound } from "../http";
import { computeShares, validatePayers, type SplitInput } from "@/lib/money";
import type { ExpenseBody } from "@/lib/schemas";
import { memberIds, requireMember } from "./access";

export type ExpenseDetail = {
  id: string;
  groupId: string;
  title: string;
  amountMinor: number;
  currency: string;
  date: string;
  category: string;
  splitType: string;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
  payers: { userId: string; amountMinor: number }[];
  shares: { userId: string; amountMinor: number; input: number | null }[];
};

function toSplitInput(split: ExpenseBody["split"]): SplitInput {
  switch (split.type) {
    case "equal":
      return { type: "equal", participants: split.participants };
    case "percent":
      return { type: "percent", entries: split.entries.map((e) => ({ id: e.userId, bp: e.bp })) };
    case "exact":
      return { type: "exact", entries: split.entries.map((e) => ({ id: e.userId, amount: e.amountMinor })) };
    case "shares":
      return { type: "shares", entries: split.entries.map((e) => ({ id: e.userId, shares: e.shares })) };
    case "full":
      return { type: "full", owner: split.owner };
  }
}

function rawInput(split: ExpenseBody["split"]): Map<string, number> {
  const m = new Map<string, number>();
  if (split.type === "percent") split.entries.forEach((e) => m.set(e.userId, e.bp));
  if (split.type === "exact") split.entries.forEach((e) => m.set(e.userId, e.amountMinor));
  if (split.type === "shares") split.entries.forEach((e) => m.set(e.userId, e.shares));
  return m;
}

async function hydrate(rows: (typeof expenses.$inferSelect)[]): Promise<ExpenseDetail[]> {
  if (!rows.length) return [];
  const db = getDb();
  const ids = rows.map((r) => r.id);
  const [payers, shares] = await Promise.all([
    db.select().from(expensePayers).where(inArray(expensePayers.expenseId, ids)),
    db.select().from(expenseShares).where(inArray(expenseShares.expenseId, ids)),
  ]);
  return rows.map((r) => ({
    id: r.id,
    groupId: r.groupId,
    title: r.title,
    amountMinor: r.amountMinor,
    currency: r.currency,
    date: r.date,
    category: r.category,
    splitType: r.splitType,
    createdBy: r.createdBy,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
    deletedAt: r.deletedAt,
    payers: payers.filter((p) => p.expenseId === r.id).map((p) => ({ userId: p.userId, amountMinor: p.amountMinor })),
    shares: shares
      .filter((s) => s.expenseId === r.id)
      .map((s) => ({ userId: s.userId, amountMinor: s.amountMinor, input: s.input })),
  }));
}

export async function listExpenses(userId: string, groupId: string, opts: { includeDeleted?: boolean } = {}) {
  await requireMember(userId, groupId);
  return loadExpenses(groupId, opts);
}

export async function loadExpenses(groupId: string, opts: { includeDeleted?: boolean } = {}) {
  const rows = await getDb()
    .select()
    .from(expenses)
    .where(opts.includeDeleted ? eq(expenses.groupId, groupId) : and(eq(expenses.groupId, groupId), isNull(expenses.deletedAt)))
    .orderBy(desc(expenses.date), desc(expenses.createdAt));
  return hydrate(rows);
}

export async function getExpense(userId: string, groupId: string, expenseId: string): Promise<ExpenseDetail> {
  await requireMember(userId, groupId);
  if (!/^[0-9a-f-]{36}$/i.test(expenseId)) throw notFound();
  const rows = await getDb()
    .select()
    .from(expenses)
    .where(and(eq(expenses.id, expenseId), eq(expenses.groupId, groupId)))
    .limit(1);
  if (!rows[0]) throw notFound();
  return (await hydrate(rows))[0];
}

/** Validiert Teilnehmer/Zahler gegen die Mitglieder und berechnet die Anteile. */
async function prepare(groupId: string, body: ExpenseBody) {
  const members = new Set(await memberIds(groupId));
  const payerList = body.payers.map((p) => ({ id: p.userId, amount: p.amountMinor }));
  validatePayers(body.amountMinor, payerList);
  const shares = computeShares(body.amountMinor, toSplitInput(body.split));
  const involved = [...payerList.map((p) => p.id), ...shares.map((s) => s.id)];
  if (involved.some((u) => !members.has(u))) throw new ApiError(400, "not_a_member");
  return { payerList, shares, raw: rawInput(body.split) };
}

async function writeParts(tx: Tx, expenseId: string, p: Awaited<ReturnType<typeof prepare>>) {
  await tx.insert(expensePayers).values(p.payerList.filter((x) => x.amount > 0).map((x) => ({ expenseId, userId: x.id, amountMinor: x.amount })));
  await tx.insert(expenseShares).values(
    p.shares.map((s) => ({ expenseId, userId: s.id, amountMinor: s.amount, input: p.raw.get(s.id) ?? null })),
  );
}

function snapshot(e: ExpenseDetail) {
  return {
    title: e.title,
    amountMinor: e.amountMinor,
    currency: e.currency,
    date: e.date,
    category: e.category,
    splitType: e.splitType,
    payers: e.payers,
    shares: e.shares,
    deleted: e.deletedAt !== null,
  };
}

export async function createExpense(userId: string, groupId: string, body: ExpenseBody) {
  await requireMember(userId, groupId);
  const p = await prepare(groupId, body);
  const id = await getDb().transaction(async (tx) => {
    const [row] = await tx
      .insert(expenses)
      .values({
        groupId,
        title: body.title,
        amountMinor: body.amountMinor,
        currency: body.currency,
        date: body.date,
        category: body.category,
        splitType: body.split.type,
        createdBy: userId,
      })
      .returning();
    await writeParts(tx, row.id, p);
    return row.id;
  });
  const detail = await getExpense(userId, groupId, id);
  await getDb().insert(expenseHistory).values({ expenseId: id, userId, action: "create", snapshot: snapshot(detail) });
  return detail;
}

export async function updateExpense(userId: string, groupId: string, expenseId: string, body: ExpenseBody) {
  const existing = await getExpense(userId, groupId, expenseId);
  if (existing.deletedAt) throw new ApiError(409, "expense_deleted");
  const p = await prepare(groupId, body);
  await getDb().transaction(async (tx) => {
    await tx
      .update(expenses)
      .set({
        title: body.title,
        amountMinor: body.amountMinor,
        currency: body.currency,
        date: body.date,
        category: body.category,
        splitType: body.split.type,
        updatedAt: new Date(),
      })
      .where(eq(expenses.id, expenseId));
    await tx.delete(expensePayers).where(eq(expensePayers.expenseId, expenseId));
    await tx.delete(expenseShares).where(eq(expenseShares.expenseId, expenseId));
    await writeParts(tx, expenseId, p);
  });
  const detail = await getExpense(userId, groupId, expenseId);
  await getDb().insert(expenseHistory).values({ expenseId, userId, action: "update", snapshot: snapshot(detail) });
  return detail;
}

export async function deleteExpense(userId: string, groupId: string, expenseId: string) {
  const existing = await getExpense(userId, groupId, expenseId);
  if (existing.deletedAt) return;
  await getDb().update(expenses).set({ deletedAt: new Date(), updatedAt: new Date() }).where(eq(expenses.id, expenseId));
  const detail = await getExpense(userId, groupId, expenseId);
  await getDb().insert(expenseHistory).values({ expenseId, userId, action: "delete", snapshot: snapshot(detail) });
}

export async function expenseHistoryFor(userId: string, groupId: string, expenseId: string) {
  await getExpense(userId, groupId, expenseId);
  return getDb()
    .select({
      id: expenseHistory.id,
      action: expenseHistory.action,
      snapshot: expenseHistory.snapshot,
      createdAt: expenseHistory.createdAt,
      userId: expenseHistory.userId,
      userName: users.name,
    })
    .from(expenseHistory)
    .innerJoin(users, eq(users.id, expenseHistory.userId))
    .where(eq(expenseHistory.expenseId, expenseId))
    .orderBy(desc(expenseHistory.createdAt));
}
