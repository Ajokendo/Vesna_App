ALTER TABLE "clients" ADD COLUMN "birthday_gift_year" integer;--> statement-breakpoint
ALTER TABLE "salons" ADD COLUMN "birthday_greet" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "salons" ADD COLUMN "birthday_bonus" integer DEFAULT 200 NOT NULL;