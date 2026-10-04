import { and, asc, eq, isNull, lte, or, sql } from "drizzle-orm";
import { getDb } from "../db";
import { groups, recurringExpenses, users } from "../schema";
import { ApiError, forbidden, notFound } from "../http";
import { requireMember, memberIds } from "./access";
import { createExpense, validateTemplate } from "./expenses";
import { dueOccurrences, occurrence, type Unit } from "@/lib/recurrence";
import type { ExpenseBody, RecurringBody } from "@/lib/schemas";

type Row = typeof recurringExpenses.$inferSelect;
type Template = Omit<ExpenseBody, "date" | "rate">;

const MAX_PER_RUN = 400; // Schutz gegen Endlosschleifen bei sehr alten Startdaten

export const todayUtc = (now = new Date()) => now.toISOString().slice(0, 10);

const templateOf = (b: RecurringBody): Template => ({
  title: b.title,
  amountMinor: b.amountMinor,
  currency: b.currency,
  category: b.category,
  payers: b.payers,
  split: b.split,
});

/** Mitglieder dürfen immer lesen; verwalten dürfen sie nur, wenn die Gruppe es nicht auf Besitzer beschränkt. */
async function requireManager(userId: string, groupId: string) {
  const { role, group } = await requireMember(userId, groupId);
  if (group.recurringPolicy === "owner" && role !== "owner") throw forbidden();
  return group;
}

async function load(groupId: string, id: string): Promise<Row> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) throw notFound();
  const [r] = await getDb().select().from(recurringExpenses).where(and(eq(recurringExpenses.id, id), eq(recurringExpenses.groupId, groupId)));
  if (!r) throw notFound();
  return r;
}

export type RecurringView = ReturnType<typeof view>;
const view = (r: Row, creatorName: string, now = new Date()) => ({
  id: r.id,
  groupId: r.groupId,
  title: r.title,
  template: r.template as Template,
  unit: r.unit as Unit,
  every: r.every,
  startDate: r.startDate,
  endDate: r.endDate,
  nextDate: r.nextDate,
  paused: r.paused,
  lastError: r.lastError,
  createdBy: r.createdBy,
  createdByName: creatorName,
  /** Alle Termine gebucht und das Enddatum liegt hinter uns */
  finished: !!r.endDate && r.nextDate > r.endDate,
  due: !r.paused && r.nextDate <= todayUtc(now) && (!r.endDate || r.nextDate <= r.endDate),
});

export async function listRecurring(userId: string, groupId: string) {
  const { group } = await requireMember(userId, groupId);
  const rows = await getDb()
    .select({ r: recurringExpenses, name: sql<string>`case when ${users.kind} = 'test' then ${users.name} || ' (Test)' else ${users.name} end` })
    .from(recurringExpenses)
    .innerJoin(users, eq(users.id, recurringExpenses.createdBy))
    .where(eq(recurringExpenses.groupId, groupId))
    .orderBy(asc(recurringExpenses.nextDate));
  return { policy: group.recurringPolicy as "members" | "owner", items: rows.map((x) => view(x.r, x.name)) };
}

export async function getRecurring(userId: string, groupId: string, id: string) {
  await requireMember(userId, groupId);
  const r = await load(groupId, id);
  const [u] = await getDb().select({ name: users.name }).from(users).where(eq(users.id, r.createdBy));
  return view(r, u?.name ?? "?");
}

export async function createRecurring(userId: string, groupId: string, body: RecurringBody) {
  await requireManager(userId, groupId);
  if (body.endDate && body.endDate < body.startDate) throw new ApiError(400, "end_before_start");
  await validateTemplate(groupId, templateOf(body));
  const [row] = await getDb()
    .insert(recurringExpenses)
    .values({
      groupId,
      createdBy: userId,
      title: body.title,
      template: templateOf(body),
      unit: body.unit,
      every: body.every,
      startDate: body.startDate,
      endDate: body.endDate ?? null,
      nextIndex: 0,
      nextDate: body.startDate,
      paused: body.paused ?? false,
    })
    .returning();
  // Liegt der erste Termin heute oder früher, werden sofort alle fälligen Termine gebucht (auch verpasste).
  const booked = row.paused ? 0 : await bookDue(row.id);
  return { id: row.id, booked };
}

export async function updateRecurring(userId: string, groupId: string, id: string, body: RecurringBody) {
  await requireManager(userId, groupId);
  const r = await load(groupId, id);
  if (body.endDate && body.endDate < body.startDate) throw new ApiError(400, "end_before_start");
  await validateTemplate(groupId, templateOf(body));
  // Ändert sich der Rhythmus oder Start, beginnt die Folge neu ab dem neuen Startdatum.
  const reschedule = r.unit !== body.unit || r.every !== body.every || r.startDate !== body.startDate;
  await getDb()
    .update(recurringExpenses)
    .set({
      title: body.title,
      template: templateOf(body),
      unit: body.unit,
      every: body.every,
      startDate: body.startDate,
      endDate: body.endDate ?? null,
      ...(reschedule ? { nextIndex: 0, nextDate: body.startDate } : {}),
      paused: body.paused ?? r.paused,
      lastError: null,
      updatedAt: new Date(),
    })
    .where(eq(recurringExpenses.id, id));
  const booked = (body.paused ?? r.paused) ? 0 : await bookDue(id);
  return { id, booked };
}

export async function setRecurringPaused(userId: string, groupId: string, id: string, paused: boolean) {
  await requireManager(userId, groupId);
  await load(groupId, id);
  await getDb().update(recurringExpenses).set({ paused, lastError: paused ? undefined : null, updatedAt: new Date() }).where(eq(recurringExpenses.id, id));
  const booked = paused ? 0 : await bookDue(id);
  return { booked };
}

/** Löscht die Vorlage; bereits gebuchte Ausgaben bleiben unberührt. */
export async function deleteRecurring(userId: string, groupId: string, id: string) {
  await requireManager(userId, groupId);
  await load(groupId, id);
  await getDb().delete(recurringExpenses).where(eq(recurringExpenses.id, id));
}

export async function setRecurringPolicy(userId: string, groupId: string, policy: "members" | "owner") {
  const { role } = await requireMember(userId, groupId);
  if (role !== "owner") throw forbidden();
  await getDb().update(groups).set({ recurringPolicy: policy }).where(eq(groups.id, groupId));
}

// ------------------------------------------------------------------ Buchen

/**
 * Bucht alle fälligen Termine einer Vorlage. Jeder Termin wird zuerst atomar „beansprucht“ (next_index hochzählen,
 * nur wenn niemand anderes schneller war), dann gebucht; scheitert die Buchung, wird der Anspruch zurückgenommen.
 * Der eindeutige Index (recurring_id, date) verhindert zusätzlich eine Doppelbuchung.
 */
export async function bookDue(id: string, now = new Date()): Promise<number> {
  const db = getDb();
  let booked = 0;
  for (let n = 0; n < MAX_PER_RUN; n++) {
    const [r] = await db.select().from(recurringExpenses).where(eq(recurringExpenses.id, id));
    if (!r || r.paused) return booked;
    const due = dueOccurrences({ start: r.startDate, unit: r.unit as Unit, every: r.every, from: r.nextIndex, until: todayUtc(now), end: r.endDate, limit: 1 });
    if (due.length === 0) return booked;
    const { index, date } = due[0];
    const nextDate = occurrence(r.startDate, r.unit as Unit, r.every, index + 1);
    const claim = await db
      .update(recurringExpenses)
      .set({ nextIndex: index + 1, nextDate, updatedAt: new Date() })
      .where(and(eq(recurringExpenses.id, id), eq(recurringExpenses.nextIndex, index), eq(recurringExpenses.paused, false)))
      .returning({ id: recurringExpenses.id });
    if (claim.length === 0) return booked; // ein anderer Prozess war schneller
    const revert = (extra: Partial<Row> = {}) =>
      db
        .update(recurringExpenses)
        .set({ nextIndex: index, nextDate: date, updatedAt: new Date(), ...extra })
        .where(and(eq(recurringExpenses.id, id), eq(recurringExpenses.nextIndex, index + 1)));
    try {
      const members = new Set(await memberIds(r.groupId));
      if (!members.has(r.createdBy)) throw new ApiError(400, "not_a_member");
      await createExpense(r.createdBy, r.groupId, { ...(r.template as Template), date } as ExpenseBody, null, { recurringId: r.id });
      if (r.lastError) await db.update(recurringExpenses).set({ lastError: null }).where(eq(recurringExpenses.id, id));
      booked++;
    } catch (e) {
      const code = e instanceof ApiError ? e.code : "";
      const pg = e as { code?: string; cause?: { code?: string } };
      if (pg.code === "23505" || pg.cause?.code === "23505") continue; // dieses Datum ist schon gebucht: Anspruch behalten
      if (code === "rate_unavailable" || code === "currency_unsupported") {
        await revert({ lastError: "rate_unavailable" }); // später erneut versuchen, nie mit geratenem Kurs
        return booked;
      }
      if (code === "not_a_member") {
        await revert({ paused: true, lastError: "member_left" });
        return booked;
      }
      console.error("[recurring] booking failed", id, e);
      await revert({ paused: true, lastError: "booking_failed" });
      return booked;
    }
  }
  return booked;
}

let running = false;
/** Bucht alles Fällige aller Vorlagen (vom Scheduler und beim Start aufgerufen). */
export async function runDueRecurring(now = new Date()): Promise<number> {
  if (running) return 0;
  running = true;
  try {
    const rows = await getDb()
      .select({ id: recurringExpenses.id })
      .from(recurringExpenses)
      .where(and(eq(recurringExpenses.paused, false), lte(recurringExpenses.nextDate, todayUtc(now)), or(isNull(recurringExpenses.endDate), sql`${recurringExpenses.nextDate} <= ${recurringExpenses.endDate}`)));
    let total = 0;
    for (const r of rows) total += await bookDue(r.id, now);
    return total;
  } finally {
    running = false;
  }
}

export function startRecurringScheduler(everyMs = 15 * 60_000) {
  if (process.env.SCHEDULER === "off") return;
  const tick = () => runDueRecurring().catch((e) => console.error("[recurring] run failed", e));
  void tick(); // beim Start nachholen
  setInterval(tick, everyMs).unref();
}

