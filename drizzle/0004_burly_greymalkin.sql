CREATE TABLE "user_tokens" (
	"token_hash" text PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"purpose" varchar(12) NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"used_at" timestamp with time zone,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "email" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "password_hash" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "username" varchar(32);--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "status" varchar(20) DEFAULT 'active' NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "must_change_password" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "password_changed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "failed_attempts" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "locked_until" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "user_tokens" ADD CONSTRAINT "user_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_tokens" ADD CONSTRAINT "user_tokens_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "user_tokens_user_idx" ON "user_tokens" USING btree ("user_id");--> statement-breakpoint
-- Bestehende Konten: Nutzername aus dem Teil vor dem "@" der E-Mail (nur a-z 0-9 . _ -), mindestens 3 Zeichen,
-- bei Dopplungen mit fortlaufender Nummer (aeltestes Konto behaelt den Namen).
WITH base AS (
  SELECT id, created_at,
         regexp_replace(regexp_replace(lower(split_part(coalesce(email, 'user'), '@', 1)), '[^a-z0-9._-]', '', 'g'), '^[^a-z0-9]+', '') AS b
  FROM "users"
), named AS (
  SELECT id, created_at, left(CASE WHEN length(b) < 3 THEN 'user' || b ELSE b END, 28) AS n FROM base
), ranked AS (
  SELECT id, n, row_number() OVER (PARTITION BY n ORDER BY created_at, id) AS rn FROM named
)
UPDATE "users" u SET "username" = CASE WHEN r.rn = 1 THEN r.n ELSE r.n || r.rn END FROM ranked r WHERE u.id = r.id;--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "username" SET NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "users_username_idx" ON "users" USING btree ("username");