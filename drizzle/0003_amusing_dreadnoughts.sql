DROP INDEX "users_email_idx";--> statement-breakpoint
CREATE INDEX "users_email_idx" ON "users" USING btree (lower("email"));