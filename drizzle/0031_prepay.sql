ALTER TABLE "salons" ADD COLUMN IF NOT EXISTS "prepay_enabled" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "salons" ADD COLUMN IF NOT EXISTS "prepay_after_no_shows" integer DEFAULT 2 NOT NULL;--> statement-breakpoint
ALTER TABLE "salons" ADD COLUMN IF NOT EXISTS "prepay_minutes" integer DEFAULT 30 NOT NULL;--> statement-breakpoint
ALTER TABLE "salons" ADD COLUMN IF NOT EXISTS "prepay_details" text;--> statement-breakpoint
ALTER TABLE "clients" ADD COLUMN IF NOT EXISTS "prepay" text;--> statement-breakpoint
ALTER TABLE "appointments" ADD COLUMN IF NOT EXISTS "prepay_amount" integer;--> statement-breakpoint
ALTER TABLE "appointments" ADD COLUMN IF NOT EXISTS "prepay_due" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "appointments" ADD COLUMN IF NOT EXISTS "prepaid_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "appointments" ADD COLUMN IF NOT EXISTS "prepaid" integer DEFAULT 0 NOT NULL;
