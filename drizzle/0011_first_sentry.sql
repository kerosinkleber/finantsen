ALTER TABLE "users" ADD COLUMN "pay_iban" varchar(34);--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "pay_holder" varchar(70);--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "pay_paypal" varchar(30);