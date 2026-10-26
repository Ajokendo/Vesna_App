ALTER TABLE "salons" ADD COLUMN "logo_data" text;--> statement-breakpoint
ALTER TABLE "salons" ADD COLUMN "hours_text" text;--> statement-breakpoint
ALTER TABLE "salons" ADD COLUMN "men_hall_note" text;--> statement-breakpoint
ALTER TABLE "salons" ADD COLUMN "women_hall_note" text;--> statement-breakpoint
ALTER TABLE "salons" ADD COLUMN "admin_pin_hash" text;--> statement-breakpoint
ALTER TABLE "salons" ADD COLUMN "admin_pin_failed" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "salons" ADD COLUMN "admin_pin_locked_until" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "salons" ADD COLUMN "demo_until" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "service_categories" ADD COLUMN "journal_group" text;--> statement-breakpoint
UPDATE "salons" SET
  "hours_text" = COALESCE("hours_text", 'С 09:00 до 20:00, у каждого мастера свой график'),
  "men_hall_note" = COALESCE("men_hall_note", 'Стрижки, борода, детские'),
  "women_hall_note" = COALESCE("women_hall_note", 'Волосы, ногти, брови, шугаринг')
  WHERE "slug" = 'vesna';
