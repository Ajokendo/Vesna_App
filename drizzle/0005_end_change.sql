ALTER TABLE "appointments" ADD COLUMN "planned_ends_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "appointments" ADD COLUMN "end_changed_by" text;--> statement-breakpoint
ALTER TABLE "appointments" ADD COLUMN "end_changed_at" timestamp with time zone;