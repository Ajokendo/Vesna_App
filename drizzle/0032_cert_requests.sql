ALTER TABLE "certificates" ADD COLUMN IF NOT EXISTS "paid_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "certificates" ADD COLUMN IF NOT EXISTS "buyer_client_id" text;--> statement-breakpoint
ALTER TABLE "certificates" ADD COLUMN IF NOT EXISTS "recipient_phone" text;--> statement-breakpoint
ALTER TABLE "certificates" ADD COLUMN IF NOT EXISTS "recipient_client_id" text;--> statement-breakpoint
ALTER TABLE "certificates" ADD COLUMN IF NOT EXISTS "receipt" text;--> statement-breakpoint
UPDATE "certificates" SET "paid_at" = "sold_at" WHERE "paid_at" IS NULL AND "receipt" IS NULL;
