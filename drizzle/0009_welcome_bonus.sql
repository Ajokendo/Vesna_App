ALTER TABLE "clients" ADD COLUMN "welcome_bonus_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "salons" ADD COLUMN "welcome_bonus" integer DEFAULT 100 NOT NULL;