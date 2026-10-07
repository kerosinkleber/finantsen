ALTER TABLE "group_members" ADD COLUMN "archived_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "invites" ADD COLUMN "guest_id" uuid;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "guest_group_id" uuid;--> statement-breakpoint
ALTER TABLE "invites" ADD CONSTRAINT "invites_guest_id_users_id_fk" FOREIGN KEY ("guest_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_guest_group_id_groups_id_fk" FOREIGN KEY ("guest_group_id") REFERENCES "public"."groups"("id") ON DELETE cascade ON UPDATE no action;