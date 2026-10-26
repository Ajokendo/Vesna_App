ALTER TABLE "appointments" ADD COLUMN "arrived_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "appointments" ADD COLUMN "late_minutes" integer;--> statement-breakpoint
ALTER TABLE "appointments" ADD COLUMN "late_reported_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "appointments" ADD COLUMN "cancelled_by" text;--> statement-breakpoint
ALTER TABLE "salons" ADD COLUMN "late_call_minutes" integer DEFAULT 5 NOT NULL;--> statement-breakpoint
ALTER TABLE "salons" ADD COLUMN "no_show_minutes" integer DEFAULT 15 NOT NULL;