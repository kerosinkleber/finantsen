CREATE TABLE "recurring_expenses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"group_id" uuid NOT NULL,
	"created_by" uuid NOT NULL,
	"title" varchar(200) NOT NULL,
	"template" jsonb NOT NULL,
	"unit" varchar(5) NOT NULL,
	"every" integer DEFAULT 1 NOT NULL,
	"start_date" date NOT NULL,
	"end_date" date,
	"next_index" integer DEFAULT 0 NOT NULL,
	"next_date" date NOT NULL,
	"paused" boolean DEFAULT false NOT NULL,
	"last_error" varchar(40),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "expenses" ADD COLUMN "recurring_id" uuid;--> statement-breakpoint
ALTER TABLE "groups" ADD COLUMN "recurring_policy" varchar(10) DEFAULT 'members' NOT NULL;--> statement-breakpoint
ALTER TABLE "recurring_expenses" ADD CONSTRAINT "recurring_expenses_group_id_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."groups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recurring_expenses" ADD CONSTRAINT "recurring_expenses_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "recurring_group_idx" ON "recurring_expenses" USING btree ("group_id");--> statement-breakpoint
CREATE INDEX "recurring_due_idx" ON "recurring_expenses" USING btree ("next_date");--> statement-breakpoint
CREATE UNIQUE INDEX "expenses_recurring_date_idx" ON "expenses" USING btree ("recurring_id","date") WHERE "expenses"."recurring_id" is not null;