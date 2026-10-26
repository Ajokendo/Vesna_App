ALTER TABLE "clients" ADD COLUMN "referral_code" text;--> statement-breakpoint
ALTER TABLE "clients" ADD COLUMN "referred_by_id" text;--> statement-breakpoint
ALTER TABLE "clients" ADD COLUMN "referral_rewarded_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "salons" ADD COLUMN "referral_bonus" integer DEFAULT 50 NOT NULL;--> statement-breakpoint
ALTER TABLE "salons" ADD COLUMN "referral_monthly_limit" integer DEFAULT 10 NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "client_ref_code" ON "clients" USING btree ("salon_id","referral_code");