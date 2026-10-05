import { z } from "zod";
import { CATEGORIES } from "./categories";
import { isValidCurrency } from "./money";

const id = z.string().uuid();
export const currencySchema = z
  .string()
  .length(3)
  .transform((s) => s.toUpperCase())
  .refine(isValidCurrency, "invalid currency");
const safeInt = z.number().int().safe();
const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((s) => !Number.isNaN(Date.parse(s)) && new Date(s).toISOString().startsWith(s), "invalid date");

/** Anmeldename: 3-32 Zeichen, a-z 0-9 . _ -, beginnt mit Buchstabe/Ziffer, kein "@" (damit er nie mit einer E-Mail verwechselt wird). */
export const usernameSchema = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[a-z0-9][a-z0-9._-]{2,31}$/, "invalid username");
/** Anzeigename ist optional; ohne Angabe gilt der Nutzername (Server setzt den Standard). */
const displayName = z.preprocess(
  (v) => (typeof v === "string" && v.trim() === "" ? undefined : v),
  z.string().trim().min(1).max(100).optional(),
);
const optionalEmail = z.preprocess(
  (v) => (typeof v === "string" && v.trim() === "" ? undefined : v),
  z.string().trim().toLowerCase().email().max(320).optional(),
);
const passwordInput = z.string().min(1).max(300); // die Richtlinie prüft der Server (lib/password)

export const setupSchema = z.object({ name: displayName, username: usernameSchema, email: optionalEmail, password: passwordInput });
/** Selbstregistrierung (nur wenn der Admin sie aktiviert hat); Konto wartet auf Freigabe. */
export const registerSchema = setupSchema;
export const loginSchema = z.object({
  /** Nutzername oder E-Mail */
  identifier: z.string().trim().min(1).max(320),
  password: z.string().min(1).max(300),
  /** Nur nötig, wenn über die E-Mail mehrere Konten mit demselben Passwort passen */
  userId: z.string().uuid().optional(),
});
export const changePasswordSchema = z.object({ current: z.string().min(1).max(300), next: passwordInput });
export const activateSchema = z.object({ password: passwordInput });

export const adminCreateUserSchema = z.object({
  name: displayName,
  username: usernameSchema,
  email: optionalEmail,
  /** link = Nutzer wählt sein Passwort per Einmal-Link; password = Admin setzt es */
  mode: z.enum(["link", "password"]),
  password: passwordInput.optional(),
  mustChange: z.boolean().default(true),
  isAdmin: z.boolean().default(false),
});
export const adminUserActionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("approve") }),
  z.object({ action: z.literal("disable") }),
  z.object({ action: z.literal("enable") }),
  z.object({ action: z.literal("makeAdmin") }),
  z.object({ action: z.literal("removeAdmin") }),
  z.object({ action: z.literal("link") }),
  z.object({ action: z.literal("resetTotp") }),
  z.object({ action: z.literal("requireTotp") }),
  z.object({ action: z.literal("unrequireTotp") }),
  z.object({ action: z.literal("setPassword"), password: passwordInput, mustChange: z.boolean().default(true) }),
]);

export const groupCreateSchema = z.object({
  name: z.string().trim().min(1).max(100),
  defaultCurrency: currencySchema.default("EUR"),
});
export const defaultSplitSchema = z.object({
  type: z.enum(["equal", "percent", "shares"]),
  /** value: Basispunkte (percent), Anteile (shares), bei equal ignoriert */
  entries: z.array(z.object({ userId: id, value: safeInt.min(0).max(1_000_000) })).min(1).max(100),
});
export type DefaultSplit = z.infer<typeof defaultSplitSchema>;

export const groupUpdateSchema = z.object({
  defaultSplit: defaultSplitSchema.nullable().optional(),
  name: z.string().trim().min(1).max(100).optional(),
  defaultCurrency: currencySchema.optional(),
  simplifyDebts: z.boolean().optional(),
  recurringPolicy: z.enum(["members", "owner"]).optional(),
  /** Budget in der Gruppenwährung; `null` entfernt es */
  budget: z.object({ amountMinor: safeInt.min(1), period: z.enum(["month", "total"]) }).nullable().optional(),
});

export const splitSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("equal"), participants: z.array(id).min(1).max(100) }),
  z.object({
    type: z.literal("percent"),
    entries: z.array(z.object({ userId: id, bp: safeInt.min(0).max(10000) })).min(1).max(100),
  }),
  z.object({
    type: z.literal("exact"),
    entries: z.array(z.object({ userId: id, amountMinor: safeInt.min(0) })).min(1).max(100),
  }),
  z.object({
    type: z.literal("shares"),
    entries: z.array(z.object({ userId: id, shares: safeInt.min(0).max(1_000_000) })).min(1).max(100),
  }),
  z.object({
    type: z.literal("adjust"),
    // Plus/minus je Person in Minor-Units; der Rest wird gleich verteilt
    entries: z.array(z.object({ userId: id, adjustMinor: safeInt })).min(1).max(100),
  }),
  z.object({ type: z.literal("full"), owner: id }),
  z.object({
    type: z.literal("items"),
    items: z
      .array(
        z.object({
          name: z.string().trim().min(1).max(200),
          amountMinor: safeInt.min(0),
          participants: z.array(id).min(1).max(100),
        }),
      )
      .min(1)
      .max(200),
    taxMinor: safeInt.min(0).default(0),
    tipMinor: safeInt.min(0).default(0),
  }),
]);
export type SplitBody = z.infer<typeof splitSchema>;

export const PAYMENT_METHODS = ["cash", "card", "bank", "paypal", "other"] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export const expenseSchema = z.object({
  title: z.string().trim().min(1).max(200),
  amountMinor: safeInt.min(1),
  currency: currencySchema,
  date: isoDate,
  category: z.enum(CATEGORIES).default("other"),
  payers: z.array(z.object({ userId: id, amountMinor: safeInt.min(0) })).min(1).max(100),
  split: splitSchema,
  /** Optionaler manueller Kurs (1 Einheit `currency` = rate Einheiten der Gruppenwährung); ersetzt den automatischen */
  rate: z.string().trim().max(40).optional(),
  /** Rückerstattung (Geld kam zurück): „Zahler“ = wer es erhalten hat, Aufteilung = wem es zusteht */
  isRefund: z.boolean().optional(),
  paymentMethod: z.enum(PAYMENT_METHODS).nullable().optional(),
});
export type ExpenseBody = z.infer<typeof expenseSchema>;

/** Wiederkehrende Ausgabe: Ausgaben-Vorlage (ohne Datum und manuellen Kurs) plus Rhythmus. */
export const recurringSchema = expenseSchema.omit({ date: true, rate: true }).extend({
  unit: z.enum(["day", "week", "month", "year"]),
  every: z.number().int().min(1).max(365).default(1),
  startDate: isoDate,
  endDate: isoDate.nullable().optional(),
  paused: z.boolean().optional(),
});
export type RecurringBody = z.infer<typeof recurringSchema>;

export const paymentSchema = z.object({
  fromUser: id,
  toUser: id,
  amountMinor: safeInt.min(1),
  currency: currencySchema,
  date: isoDate,
  note: z.string().trim().max(200).optional(),
});
export type PaymentBody = z.infer<typeof paymentSchema>;

// ---- Admin-Testfunktionen
export const testUserCreateSchema = z.union([
  z.object({ count: z.number().int().min(1).max(20) }),
  z.object({ name: displayName, username: usernameSchema }),
]);
export const testUserUpdateSchema = z.object({
  name: displayName.optional(),
  username: usernameSchema.optional(),
  locale: z.enum(["de", "en"]).optional(),
});
export const membershipActionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("addGroup"), groupId: id, role: z.enum(["owner", "member"]).default("member"), confirmed: z.boolean().optional() }),
  z.object({ action: z.literal("setRole"), groupId: id, role: z.enum(["owner", "member"]) }),
  z.object({ action: z.literal("removeGroup"), groupId: id, confirmed: z.boolean().optional() }),
  z.object({ action: z.literal("addFriend"), userId: id, confirmed: z.boolean().optional() }),
]);
