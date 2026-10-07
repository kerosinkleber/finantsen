ALTER TABLE "expenses" ADD COLUMN "is_refund" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "expenses" ADD COLUMN "payment_method" varchar(10);