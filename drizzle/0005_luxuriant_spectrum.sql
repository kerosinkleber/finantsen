ALTER TABLE "expense_comments" ADD COLUMN "acted_by" uuid;--> statement-breakpoint
ALTER TABLE "expense_history" ADD COLUMN "acted_by" uuid;--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "acted_by" uuid;--> statement-breakpoint
ALTER TABLE "sessions" ADD COLUMN "acting_as_user_id" uuid;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "kind" varchar(10) DEFAULT 'user' NOT NULL;--> statement-breakpoint
ALTER TABLE "expense_comments" ADD CONSTRAINT "expense_comments_acted_by_users_id_fk" FOREIGN KEY ("acted_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expense_history" ADD CONSTRAINT "expense_history_acted_by_users_id_fk" FOREIGN KEY ("acted_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_acted_by_users_id_fk" FOREIGN KEY ("acted_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_acting_as_user_id_users_id_fk" FOREIGN KEY ("acting_as_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;