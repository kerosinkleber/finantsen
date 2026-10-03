CREATE TABLE "exchange_rates" (
	"provider" varchar(30) NOT NULL,
	"base" varchar(3) NOT NULL,
	"date" date NOT NULL,
	"rates" jsonb NOT NULL,
	"fetched_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "exchange_rates_provider_base_date_pk" PRIMARY KEY("provider","base","date")
);
--> statement-breakpoint
ALTER TABLE "expense_payers" ADD COLUMN "base_amount_minor" bigint;--> statement-breakpoint
ALTER TABLE "expense_shares" ADD COLUMN "base_amount_minor" bigint;--> statement-breakpoint
ALTER TABLE "expenses" ADD COLUMN "base_currency" varchar(3);--> statement-breakpoint
ALTER TABLE "expenses" ADD COLUMN "base_amount_minor" bigint;--> statement-breakpoint
ALTER TABLE "expenses" ADD COLUMN "rate" text DEFAULT '1' NOT NULL;--> statement-breakpoint
ALTER TABLE "expenses" ADD COLUMN "rate_source" varchar(10) DEFAULT 'same' NOT NULL;--> statement-breakpoint
ALTER TABLE "expenses" ADD COLUMN "items" jsonb;--> statement-breakpoint
-- Bestehende Ausgaben (Phase 1/2) hatten keine Umrechnung: Basiswerte = Originalwerte.
UPDATE "expenses" SET "base_currency" = "currency", "base_amount_minor" = "amount_minor";--> statement-breakpoint
UPDATE "expense_payers" SET "base_amount_minor" = "amount_minor";--> statement-breakpoint
UPDATE "expense_shares" SET "base_amount_minor" = "amount_minor";--> statement-breakpoint
ALTER TABLE "expense_payers" ALTER COLUMN "base_amount_minor" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "expense_shares" ALTER COLUMN "base_amount_minor" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "expenses" ALTER COLUMN "base_currency" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "expenses" ALTER COLUMN "base_amount_minor" SET NOT NULL;
