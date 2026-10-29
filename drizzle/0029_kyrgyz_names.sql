ALTER TABLE "services" ADD COLUMN IF NOT EXISTS "name_ky" text;--> statement-breakpoint
ALTER TABLE "service_categories" ADD COLUMN IF NOT EXISTS "name_ky" text;--> statement-breakpoint
ALTER TABLE "staff" ADD COLUMN IF NOT EXISTS "title_ky" text;
