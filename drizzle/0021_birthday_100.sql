ALTER TABLE "salons" ALTER COLUMN "birthday_bonus" SET DEFAULT 100;--> statement-breakpoint
UPDATE "salons" SET "birthday_bonus" = 100 WHERE "birthday_bonus" = 200;