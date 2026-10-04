import { relations, sql } from "drizzle-orm";
import {
  bigint,
  boolean,
  date,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  type AnyPgColumn,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

// Geldbeträge: bigint (mode number) in der kleinsten Einheit; nie Float.
const money = (name: string) => bigint(name, { mode: "number" });

export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    /** Anmeldename: klein geschrieben, 3-32 Zeichen, ohne "@" (siehe lib/schemas) */
    username: varchar("username", { length: 32 }).notNull(),
    /** Optional, nicht verifiziert; mehrfach nutzbar, solange der Admin Duplikate erlaubt */
    email: varchar("email", { length: 320 }),
    /** Anzeigename in Gruppen und Ausgaben */
    name: varchar("name", { length: 100 }).notNull(),
    /** null, solange das Konto per Einmal-Link noch nicht aktiviert wurde */
    passwordHash: text("password_hash"),
    isAdmin: boolean("is_admin").notNull().default(false),
    /** user = echtes Konto | test = Testnutzer (kein Passwort, nie selbst anmeldbar, nur vom Admin steuerbar) */
    /** user = echtes Konto | test = Testnutzer | guest = Mitglied ohne Konto (gehört zu genau einer Gruppe, nie anmeldbar) */
    kind: varchar("kind", { length: 10 }).notNull().default("user"),
    /** Nur bei Gästen: die Gruppe, in der sie angelegt wurden (wird mit der Gruppe gelöscht) */
    guestGroupId: uuid("guest_group_id").references((): AnyPgColumn => groups.id, { onDelete: "cascade" }),
    /** active | invited (wartet auf Aktivierung per Link) | pending (Selbstregistrierung, wartet auf Freigabe) | disabled */
    status: varchar("status", { length: 20 }).notNull().default("active"),
    mustChangePassword: boolean("must_change_password").notNull().default(false),
    passwordChangedAt: timestamp("password_changed_at", { withTimezone: true }),
    /** Login-Schutz: zunehmende Wartezeit nach Fehlversuchen */
    failedAttempts: integer("failed_attempts").notNull().default(0),
    lockedUntil: timestamp("locked_until", { withTimezone: true }),
    /** TOTP: Geheimnis verschlüsselt (APP_SECRET); null = nicht eingerichtet */
    totpSecret: text("totp_secret"),
    /** Geheimnis während der Einrichtung, noch nicht bestätigt */
    totpPendingSecret: text("totp_pending_secret"),
    totpEnabledAt: timestamp("totp_enabled_at", { withTimezone: true }),
    /** Zuletzt akzeptierter Zeitschritt (Replay-Schutz) */
    totpLastStep: bigint("totp_last_step", { mode: "number" }),
    /** Admin verlangt TOTP für dieses Konto */
    totpRequired: boolean("totp_required").notNull().default(false),
    totpFailedAttempts: integer("totp_failed_attempts").notNull().default(0),
    totpLockedUntil: timestamp("totp_locked_until", { withTimezone: true }),
    locale: varchar("locale", { length: 5 }).notNull().default("de"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("users_username_idx").on(t.username), index("users_email_idx").on(sql`lower(${t.email})`)],
);

/** Wiederherstellungscodes für TOTP; gespeichert wird nur der HMAC. */
export const recoveryCodes = pgTable("recovery_codes", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  codeHash: text("code_hash").notNull(),
  usedAt: timestamp("used_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/** Passkeys (WebAuthn): öffentlicher Schlüssel je Gerät; das Passwort bleibt Pflicht, Passkeys ergänzen es. */
export const passkeys = pgTable(
  "passkeys",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    /** Credential-ID (base64url), global eindeutig */
    credentialId: text("credential_id").notNull(),
    /** COSE-Public-Key (base64url) */
    publicKey: text("public_key").notNull(),
    /** Signaturzähler gegen geklonte Authenticatoren */
    counter: bigint("counter", { mode: "number" }).notNull().default(0),
    transports: text("transports"),
    name: varchar("name", { length: 60 }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
  },
  (t) => [uniqueIndex("passkeys_credential_idx").on(t.credentialId), index("passkeys_user_idx").on(t.userId)],
);

/** Einmal-Links (Konto aktivieren / Passwort neu setzen); gespeichert wird nur der SHA-256 des Tokens. */
export const userTokens = pgTable(
  "user_tokens",
  {
    tokenHash: text("token_hash").primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    /** activation | reset */
    purpose: varchar("purpose", { length: 12 }).notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    usedAt: timestamp("used_at", { withTimezone: true }),
    createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("user_tokens_user_idx").on(t.userId)],
);

export const sessions = pgTable(
  "sessions",
  {
    /** SHA-256 des Cookie-Tokens */
    id: text("id").primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    /** Admin handelt in dieser Sitzung als dieser Testnutzer (nur kind = test) */
    actingAsUserId: uuid("acting_as_user_id").references(() => users.id, { onDelete: "set null" }),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("sessions_user_idx").on(t.userId)],
);

export const groups = pgTable("groups", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: varchar("name", { length: 100 }).notNull(),
  /** group = normale Gruppe, direct = Freundschaft (genau 2 Personen) */
  kind: varchar("kind", { length: 10 }).notNull().default("group"),
  defaultCurrency: varchar("default_currency", { length: 3 }).notNull().default("EUR"),
  /** Schuldenvereinfachung für die Anzeige der Salden */
  simplifyDebts: boolean("simplify_debts").notNull().default(true),
  /** Standard-Aufteilung für neue Ausgaben: { type: "equal"|"percent"|"shares", entries: [{ userId, value }] } */
  defaultSplit: jsonb("default_split"),
  /** Wer wiederkehrende Ausgaben verwalten darf: members (alle Mitglieder) | owner (nur Besitzer) */
  recurringPolicy: varchar("recurring_policy", { length: 10 }).notNull().default("members"),
  createdBy: uuid("created_by")
    .notNull()
    .references(() => users.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const groupMembers = pgTable(
  "group_members",
  {
    groupId: uuid("group_id")
      .notNull()
      .references(() => groups.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: varchar("role", { length: 10 }).notNull().default("member"),
    joinedAt: timestamp("joined_at", { withTimezone: true }).notNull().defaultNow(),
    /** Gruppe in der eigenen Übersicht ins Archiv verschoben (gilt nur für dieses Mitglied) */
    archivedAt: timestamp("archived_at", { withTimezone: true }),
  },
  (t) => [primaryKey({ columns: [t.groupId, t.userId] }), index("gm_user_idx").on(t.userId)],
);

export const invites = pgTable("invites", {
  code: varchar("code", { length: 32 }).primaryKey(),
  groupId: uuid("group_id")
    .notNull()
    .references(() => groups.id, { onDelete: "cascade" }),
  createdBy: uuid("created_by")
    .notNull()
    .references(() => users.id),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  maxUses: integer("max_uses").notNull().default(1),
  /** Verknüpfungs-Link: wer ihn einlöst, übernimmt diesen Gast (Mitglied ohne Konto) */
  guestId: uuid("guest_id").references(() => users.id, { onDelete: "cascade" }),
  uses: integer("uses").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const expenses = pgTable(
  "expenses",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    groupId: uuid("group_id")
      .notNull()
      .references(() => groups.id, { onDelete: "cascade" }),
    title: varchar("title", { length: 200 }).notNull(),
    amountMinor: money("amount_minor").notNull(),
    currency: varchar("currency", { length: 3 }).notNull(),
    date: date("date", { mode: "string" }).notNull(),
    category: varchar("category", { length: 30 }).notNull().default("other"),
    splitType: varchar("split_type", { length: 10 }).notNull(),
    /** Abrechnungswährung (Gruppenwährung zum Buchungszeitpunkt) und umgerechneter Betrag */
    baseCurrency: varchar("base_currency", { length: 3 }).notNull(),
    baseAmountMinor: money("base_amount_minor").notNull(),
    /** Kurs: 1 Einheit `currency` = rate Einheiten `baseCurrency` (Dezimalstring), zum Buchungszeitpunkt gespeichert */
    rate: text("rate").notNull().default("1"),
    /** same | provider | manual */
    rateSource: varchar("rate_source", { length: 10 }).notNull().default("same"),
    /** Einzelposten bei splitType "items": { items: [{ name, amountMinor, participants }], taxMinor, tipMinor } */
    items: jsonb("items"),
    /** Gesetzt, wenn die Ausgabe automatisch aus einer wiederkehrenden Vorlage entstanden ist */
    recurringId: uuid("recurring_id"),
    createdBy: uuid("created_by")
      .notNull()
      .references(() => users.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (t) => [
    index("expenses_group_idx").on(t.groupId, t.date),
    // Pro Vorlage und Datum höchstens eine automatische Buchung (Schutz gegen Doppelbuchung)
    uniqueIndex("expenses_recurring_date_idx").on(t.recurringId, t.date).where(sql`${t.recurringId} is not null`),
  ],
);

/** Wiederkehrende Ausgaben: Vorlage (Ausgaben-Body ohne Datum) plus Rhythmus. Jede Buchung ist eine normale Ausgabe. */
export const recurringExpenses = pgTable(
  "recurring_expenses",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    groupId: uuid("group_id")
      .notNull()
      .references(() => groups.id, { onDelete: "cascade" }),
    /** Gilt als Ersteller der automatischen Buchungen */
    createdBy: uuid("created_by")
      .notNull()
      .references(() => users.id),
    title: varchar("title", { length: 200 }).notNull(),
    /** ExpenseBody ohne date und rate (title, amountMinor, currency, category, payers, split) */
    template: jsonb("template").notNull(),
    /** day | week | month | year, alle `every` Einheiten */
    unit: varchar("unit", { length: 5 }).notNull(),
    every: integer("every").notNull().default(1),
    startDate: date("start_date", { mode: "string" }).notNull(),
    endDate: date("end_date", { mode: "string" }),
    /** Index des nächsten Termins (0 = Startdatum) und dessen Datum */
    nextIndex: integer("next_index").notNull().default(0),
    nextDate: date("next_date", { mode: "string" }).notNull(),
    paused: boolean("paused").notNull().default(false),
    /** Letzter Fehler beim Buchen (z. B. member_left, rate_unavailable); leer, wenn alles in Ordnung ist */
    lastError: varchar("last_error", { length: 40 }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("recurring_group_idx").on(t.groupId), index("recurring_due_idx").on(t.nextDate)],
);

export const expensePayers = pgTable(
  "expense_payers",
  {
    expenseId: uuid("expense_id")
      .notNull()
      .references(() => expenses.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id),
    amountMinor: money("amount_minor").notNull(),
    baseAmountMinor: money("base_amount_minor").notNull(),
  },
  (t) => [primaryKey({ columns: [t.expenseId, t.userId] })],
);

export const expenseShares = pgTable(
  "expense_shares",
  {
    expenseId: uuid("expense_id")
      .notNull()
      .references(() => expenses.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id),
    /** berechneter Anteil in Minor-Units */
    amountMinor: money("amount_minor").notNull(),
    baseAmountMinor: money("base_amount_minor").notNull(),
    /** Roheingabe je Aufteilungsart: Basispunkte, Shares oder fester Betrag; null bei equal/full */
    input: bigint("input", { mode: "number" }),
  },
  (t) => [primaryKey({ columns: [t.expenseId, t.userId] })],
);

export const expenseHistory = pgTable(
  "expense_history",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    expenseId: uuid("expense_id")
      .notNull()
      .references(() => expenses.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id),
    /** Echter Admin, der als Testnutzer gehandelt hat (userId ist dann der Testnutzer) */
    actedBy: uuid("acted_by").references(() => users.id, { onDelete: "set null" }),
    action: varchar("action", { length: 10 }).notNull(), // create | update | delete | restore
    snapshot: jsonb("snapshot").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("eh_expense_idx").on(t.expenseId, t.createdAt)],
);

export const payments = pgTable(
  "payments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    groupId: uuid("group_id")
      .notNull()
      .references(() => groups.id, { onDelete: "cascade" }),
    fromUser: uuid("from_user")
      .notNull()
      .references(() => users.id),
    toUser: uuid("to_user")
      .notNull()
      .references(() => users.id),
    amountMinor: money("amount_minor").notNull(),
    currency: varchar("currency", { length: 3 }).notNull(),
    date: date("date", { mode: "string" }).notNull(),
    note: varchar("note", { length: 200 }),
    actedBy: uuid("acted_by").references(() => users.id, { onDelete: "set null" }),
    createdBy: uuid("created_by")
      .notNull()
      .references(() => users.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (t) => [index("payments_group_idx").on(t.groupId)],
);

export const settings = pgTable("settings", {
  key: varchar("key", { length: 64 }).primaryKey(),
  value: text("value").notNull(),
});

export const groupsRelations = relations(groups, ({ many }) => ({
  members: many(groupMembers),
}));
export const groupMembersRelations = relations(groupMembers, ({ one }) => ({
  group: one(groups, { fields: [groupMembers.groupId], references: [groups.id] }),
  user: one(users, { fields: [groupMembers.userId], references: [users.id] }),
}));

export const expenseComments = pgTable(
  "expense_comments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    expenseId: uuid("expense_id")
      .notNull()
      .references(() => expenses.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id),
    actedBy: uuid("acted_by").references(() => users.id, { onDelete: "set null" }),
    body: varchar("body", { length: 2000 }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (t) => [index("ec_expense_idx").on(t.expenseId, t.createdAt)],
);

export const notifications = pgTable(
  "notifications",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    /** expense_created | expense_restored | comment */
    type: varchar("type", { length: 20 }).notNull(),
    groupId: uuid("group_id")
      .notNull()
      .references(() => groups.id, { onDelete: "cascade" }),
    expenseId: uuid("expense_id").references(() => expenses.id, { onDelete: "cascade" }),
    /** { actorName, title, amountMinor?, currency?, groupName, excerpt? } */
    data: jsonb("data").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    readAt: timestamp("read_at", { withTimezone: true }),
  },
  (t) => [index("notif_user_idx").on(t.userId, t.createdAt)],
);

export const pushSubscriptions = pgTable(
  "push_subscriptions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    endpoint: text("endpoint").notNull(),
    p256dh: text("p256dh").notNull(),
    auth: text("auth").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("push_endpoint_idx").on(t.endpoint)],
);

/** Cache für Wechselkurse: Kurse von `base` zu allen anderen Währungen an einem Datum. */
export const exchangeRates = pgTable(
  "exchange_rates",
  {
    provider: varchar("provider", { length: 30 }).notNull(),
    base: varchar("base", { length: 3 }).notNull(),
    date: date("date", { mode: "string" }).notNull(),
    rates: jsonb("rates").notNull(),
    fetchedAt: timestamp("fetched_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.provider, t.base, t.date] })],
);
