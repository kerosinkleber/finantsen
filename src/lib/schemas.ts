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

export const registerSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(320),
  name: z.string().trim().min(1).max(100),
  password: z.string().min(8).max(200),
  inviteCode: z.string().max(32).optional(),
});
export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(320),
  password: z.string().min(1).max(200),
});

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
});
export type ExpenseBody = z.infer<typeof expenseSchema>;

export const paymentSchema = z.object({
  fromUser: id,
  toUser: id,
  amountMinor: safeInt.min(1),
  currency: currencySchema,
  date: isoDate,
  note: z.string().trim().max(200).optional(),
});
export type PaymentBody = z.infer<typeof paymentSchema>;
