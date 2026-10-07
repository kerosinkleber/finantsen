ALTER TABLE "groups" ADD COLUMN "budget_minor" bigint;--> statement-breakpoint
ALTER TABLE "groups" ADD COLUMN "budget_period" varchar(10);--> statement-breakpoint
ALTER TABLE "groups" ADD COLUMN "budget_currency" varchar(3);--> statement-breakpoint
ALTER TABLE "groups" ADD COLUMN "budget_alert_key" varchar(20);