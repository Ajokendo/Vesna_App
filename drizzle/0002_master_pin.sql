ALTER TABLE "staff" ADD COLUMN "pin_hash" text;--> statement-breakpoint
ALTER TABLE "staff" ADD COLUMN "pin_failed" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "staff" ADD COLUMN "pin_locked_until" timestamp with time zone;