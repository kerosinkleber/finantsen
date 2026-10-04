import { randomBytes } from "node:crypto";
import { and, eq, inArray, isNotNull, sql } from "drizzle-orm";
import { getDb, type Tx } from "../db";
import { expenses, groupMembers, groups, invites, payments, recurringExpenses, users } from "../schema";
import { ApiError, notFound } from "../http";
import { env } from "../env";
import { requireMember } from "./access";
import { replaceUserInDefaultSplit, replaceUserInItems, replaceUserInTemplate } from "@/lib/merge";

/**
 * Mitglieder ohne Konto („Gäste“): users.kind = 'guest', gehören zu genau einer Gruppe (guest_group_id),
 * können nie angemeldet werden und bekommen keine Benachrichtigungen. Später kann ein Konto sie per
 * Verknüpfungs-Link übernehmen; dann wandern alle ihre Daten auf das Konto.
 */
const LINK_DAYS = 7;

async function loadGuest(db: Tx | ReturnType<typeof getDb>, groupId: string, guestId: string) {
  if (!/^[0-9a-f-]{36}$/i.test(guestId)) throw notFound();
  const [g] = await db.select().from(users).where(and(eq(users.id, guestId), eq(users.kind, "guest"), eq(users.guestGroupId, groupId)));
  if (!g) throw notFound();
  return g;
}

const cleanName = (name: string) => {
  const n = name.trim().replace(/\s+/g, " ");
  if (n.length < 1 || n.length > 100) throw new ApiError(400, "validation");
  return n;
};

export async function addGuest(userId: string, groupId: string, name: string) {
  const { group } = await requireMember(userId, groupId);
  if (group.kind !== "group") throw new ApiError(400, "direct_group");
  const n = cleanName(name);
  return getDb().transaction(async (tx) => {
    // Interner, nie anmeldbarer Nutzername; Kollision ist praktisch ausgeschlossen, wird aber geprüft
    let username = "";
    for (let i = 0; i < 5; i++) {
      username = `gast-${randomBytes(6).toString("hex")}`;
      const [dup] = await tx.select({ id: users.id }).from(users).where(eq(users.username, username));
      if (!dup) break;
    }
    const [u] = await tx
      .insert(users)
      .values({ username, name: n, kind: "guest", status: "active", passwordHash: null, guestGroupId: groupId, locale: env.defaultLocale })
      .returning({ id: users.id, name: users.name });
    await tx.insert(groupMembers).values({ groupId, userId: u.id, role: "member" });
    return u;
  });
}

export async function renameGuest(userId: string, groupId: string, guestId: string, name: string) {
  await requireMember(userId, groupId);
  await loadGuest(getDb(), groupId, guestId);
  await getDb().update(users).set({ name: cleanName(name) }).where(eq(users.id, guestId));
}

async function guestHasData(guestId: string) {
  const [r] = (await getDb().execute(sql`
    select exists(select 1 from expense_payers where user_id = ${guestId})
        or exists(select 1 from expense_shares where user_id = ${guestId})
        or exists(select 1 from payments where (from_user = ${guestId} or to_user = ${guestId}) and deleted_at is null)
        or exists(select 1 from recurring_expenses where template::text like ${"%" + guestId + "%"}) as used`)) as unknown as { used: boolean }[];
  return r.used;
}

/** Löschen nur ohne Ausgaben/Zahlungen/Vorlagen, damit Salden nicht verfälscht werden. */
export async function deleteGuest(userId: string, groupId: string, guestId: string) {
  await requireMember(userId, groupId);
  await loadGuest(getDb(), groupId, guestId);
  if (await guestHasData(guestId)) throw new ApiError(409, "guest_has_data");
  // auch gelöschte Ausgaben/Zahlungen verweisen evtl. noch auf den Gast: dann bleibt er erhalten
  try {
    await getDb().delete(users).where(and(eq(users.id, guestId), eq(users.kind, "guest")));
  } catch {
    throw new ApiError(409, "guest_has_data");
  }
}

/** Verknüpfungs-Link: wer ihn mit seinem Konto einlöst, übernimmt den Gast (7 Tage, einmalig). */
export async function createGuestLink(userId: string, groupId: string, guestId: string) {
  await requireMember(userId, groupId);
  await loadGuest(getDb(), groupId, guestId);
  const code = randomBytes(12).toString("base64url");
  const db = getDb();
  await db.delete(invites).where(eq(invites.guestId, guestId)); // ältere Links ungültig
  const [inv] = await db
    .insert(invites)
    .values({ code, groupId, createdBy: userId, guestId, maxUses: 1, expiresAt: new Date(Date.now() + LINK_DAYS * 86400_000) })
    .returning();
  return { code, url: `${env.appUrl.replace(/\/$/, "")}/join/${code}`, expiresAt: inv.expiresAt };
}

/**
 * Übernimmt einen Gast: alle Zahler-/Anteilszeilen, Zahlungen, Einzelposten, Vorlagen und Verlaufs-Snapshots
 * gehen auf das Konto über (bei Überschneidungen werden Beträge zusammengefasst), das Konto wird Mitglied,
 * der Gast verschwindet. Läuft in der Transaktion der Einladung (`acceptInvite`).
 */
export async function claimGuest(tx: Tx, targetId: string, groupId: string, guestId: string) {
  const [target] = await tx.select({ kind: users.kind }).from(users).where(eq(users.id, targetId));
  if (!target || target.kind === "guest") throw new ApiError(400, "invite_invalid");
  await loadGuest(tx, groupId, guestId);
  const ids = (await tx.select({ id: expenses.id }).from(expenses).where(eq(expenses.groupId, groupId))).map((r) => r.id);
  if (ids.length) {
    const list = sql.join(ids.map((x) => sql`${x}::uuid`), sql`, `);
    // Ausgaben, an denen Gast UND Konto beteiligt sind: Aufteilungsart so umstellen, dass ein späteres Bearbeiten
    // dieselben (zusammengefassten) Anteile ergibt
    const overlap = (await tx.execute(sql`
      select e.id, e.split_type from expenses e
      where e.id in (${list})
        and exists(select 1 from expense_shares s where s.expense_id = e.id and s.user_id = ${guestId})
        and exists(select 1 from expense_shares s where s.expense_id = e.id and s.user_id = ${targetId})
        and (e.split_type <> 'equal' or (select count(*) from expense_shares s where s.expense_id = e.id) > 2)`)) as unknown as { id: string; split_type: string }[];
    for (const table of ["expense_payers", "expense_shares"] as const) {
      const t = sql.raw(table);
      const input = table === "expense_shares" ? sql`, input = case when t.input is null or g.input is null then t.input else t.input + g.input end` : sql``;
      await tx.execute(sql`update ${t} t set amount_minor = t.amount_minor + g.amount_minor, base_amount_minor = t.base_amount_minor + g.base_amount_minor ${input}
        from ${t} g where g.expense_id = t.expense_id and g.user_id = ${guestId} and t.user_id = ${targetId} and t.expense_id in (${list})`);
      await tx.execute(sql`delete from ${t} g using ${t} t where g.expense_id = t.expense_id and g.user_id = ${guestId} and t.user_id = ${targetId}`);
      await tx.execute(sql`update ${t} set user_id = ${targetId} where user_id = ${guestId}`);
    }
    for (const o of overlap) {
      if (o.split_type === "equal") {
        // gleichmäßig → Anteile: das Konto trägt jetzt zwei Teile (seinen und den des Gasts)
        await tx.update(expenses).set({ splitType: "shares" }).where(eq(expenses.id, o.id));
        await tx.execute(sql`update expense_shares set input = case when user_id = ${targetId} then 2 else 1 end where expense_id = ${o.id}`);
      } else if (o.split_type === "items") {
        // Einzelposten → feste Beträge (die bereits berechneten Anteile)
        await tx.update(expenses).set({ splitType: "exact", items: null }).where(eq(expenses.id, o.id));
        await tx.execute(sql`update expense_shares set input = amount_minor where expense_id = ${o.id}`);
      }
    }
    // Einzelposten und Verlaufs-Snapshots nennen den Gast per ID
    const withItems = await tx.select({ id: expenses.id, items: expenses.items }).from(expenses).where(and(inArray(expenses.id, ids), isNotNull(expenses.items)));
    for (const e of withItems) {
      const it = e.items as { items: { name: string; amountMinor: number; participants: string[] }[]; taxMinor: number; tipMinor: number };
      if (!JSON.stringify(it).includes(guestId)) continue;
      await tx.update(expenses).set({ items: { ...it, items: replaceUserInItems(it.items, guestId, targetId) } }).where(eq(expenses.id, e.id));
    }
    await tx.execute(sql`update expense_history set snapshot = replace(snapshot::text, ${guestId}, ${targetId})::jsonb where expense_id in (${list})`);
  }
  await tx.update(payments).set({ fromUser: targetId }).where(and(eq(payments.groupId, groupId), eq(payments.fromUser, guestId)));
  await tx.update(payments).set({ toUser: targetId }).where(and(eq(payments.groupId, groupId), eq(payments.toUser, guestId)));
  // Zahlungen zwischen Gast und Konto heben sich jetzt auf: als gelöscht markieren
  await tx.update(payments).set({ deletedAt: new Date() }).where(and(eq(payments.groupId, groupId), eq(payments.fromUser, targetId), eq(payments.toUser, targetId)));
  const tpls = await tx.select().from(recurringExpenses).where(eq(recurringExpenses.groupId, groupId));
  for (const r of tpls) {
    if (!JSON.stringify(r.template).includes(guestId)) continue;
    await tx.update(recurringExpenses).set({ template: replaceUserInTemplate(r.template as never, guestId, targetId) }).where(eq(recurringExpenses.id, r.id));
  }
  const [grp] = await tx.select({ defaultSplit: groups.defaultSplit }).from(groups).where(eq(groups.id, groupId));
  if (grp?.defaultSplit && JSON.stringify(grp.defaultSplit).includes(guestId)) {
    await tx.update(groups).set({ defaultSplit: replaceUserInDefaultSplit(grp.defaultSplit as never, guestId, targetId) }).where(eq(groups.id, groupId));
  }
  const [isMember] = await tx.select({ u: groupMembers.userId }).from(groupMembers).where(and(eq(groupMembers.groupId, groupId), eq(groupMembers.userId, targetId)));
  if (!isMember) await tx.insert(groupMembers).values({ groupId, userId: targetId, role: "member" });
  await tx.delete(users).where(and(eq(users.id, guestId), eq(users.kind, "guest"))); // kaskadiert Mitgliedschaft und Links
  const [g] = await tx.select({ id: groups.id }).from(groups).where(eq(groups.id, groupId));
  return { groupId: g.id };
}
