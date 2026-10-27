ALTER TABLE "staff" ADD COLUMN IF NOT EXISTS "tempo" integer DEFAULT 100 NOT NULL;--> statement-breakpoint
ALTER TABLE "staff" ADD COLUMN IF NOT EXISTS "buffer_min" integer DEFAULT 0 NOT NULL;
