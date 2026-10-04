import { eq, sql } from "drizzle-orm";
import { getDb } from "../db";
import { env } from "../env";
import { users } from "../schema";
import { ApiError } from "../http";
import { hashPassword, verifyPassword } from "../auth";
import { acceptInvite, isInviteValid } from "./groups";
import { allowDuplicateEmails } from "./settings";

// Dummy-Hash, damit Login-Zeit nicht verrät, ob die E-Mail existiert.
let dummyHash: Promise<string> | undefined;

/**
 * Prüft E-Mail + Passwort. Da mehrere Konten dieselbe E-Mail haben können, werden alle Konten mit
 * dieser E-Mail geprüft und alle mit passendem Passwort zurückgegeben (0 = ungültig, 1 = eindeutig,
 * mehrere = Nutzer muss das Konto wählen).
 */
export async function authenticate(email: string, password: string) {
  const rows = await getDb()
    .select()
    .from(users)
    .where(eq(sql`lower(${users.email})`, email.toLowerCase()))
    .orderBy(users.createdAt);
  if (rows.length === 0) {
    dummyHash ??= hashPassword("dummy-password");
    await verifyPassword(await dummyHash, password);
    return [];
  }
  const ok = await Promise.all(rows.map(async (u) => ((await verifyPassword(u.passwordHash, password)) ? u : null)));
  return ok.filter((u): u is (typeof rows)[number] => u !== null);
}

export async function registerUser(input: { email: string; name: string; password: string; inviteCode?: string }) {
  const db = getDb();
  const [{ count }] = await db.select({ count: sql<number>`count(*)::int` }).from(users);
  const first = count === 0;
  const inviteOk = input.inviteCode ? await isInviteValid(input.inviteCode) : false;
  if (input.inviteCode && !inviteOk) throw new ApiError(410, "invite_invalid");
  if (!first && !env.registrationEnabled && !inviteOk) throw new ApiError(403, "registration_disabled");

  const passwordHash = await hashPassword(input.password);
  // Der erste Nutzer wird Admin. Advisory Lock verhindert zwei „erste“ Nutzer bei Gleichzeitigkeit.
  const user = await db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(727001)`);
    const [{ c }] = await tx.select({ c: sql<number>`count(*)::int` }).from(users);
    if (c > 0 && !(await allowDuplicateEmails())) {
      const [dup] = await tx.select({ id: users.id }).from(users).where(eq(sql`lower(${users.email})`, input.email.toLowerCase())).limit(1);
      if (dup) throw new ApiError(409, "email_taken");
    }
    const [u] = await tx
      .insert(users)
      .values({ email: input.email, name: input.name, passwordHash, isAdmin: c === 0, locale: env.defaultLocale })
      .returning();
    return u;
  });
  let joinedGroupId: string | undefined;
  if (inviteOk && input.inviteCode) joinedGroupId = (await acceptInvite(user.id, input.inviteCode)).groupId;
  return { ...user, joinedGroupId };
}

export async function setLocale(userId: string, locale: "de" | "en") {
  await getDb().update(users).set({ locale }).where(eq(users.id, userId));
}
