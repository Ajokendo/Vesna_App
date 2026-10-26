CREATE TYPE "public"."points_kind" AS ENUM('EARN', 'REDEEM', 'ADJUST');--> statement-breakpoint
CREATE TABLE "points_ledger" (
	"id" text PRIMARY KEY NOT NULL,
	"salon_id" text NOT NULL,
	"client_id" text NOT NULL,
	"appointment_id" text,
	"kind" "points_kind" NOT NULL,
	"delta" integer NOT NULL,
	"balance_after" integer NOT NULL,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "appointments" ADD COLUMN "pause_start" integer;--> statement-breakpoint
ALTER TABLE "appointments" ADD COLUMN "pause_min" integer;--> statement-breakpoint
ALTER TABLE "appointments" ADD COLUMN "final_price" integer;--> statement-breakpoint
ALTER TABLE "appointments" ADD COLUMN "cash_paid" integer;--> statement-breakpoint
ALTER TABLE "appointments" ADD COLUMN "points_earned" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "appointments" ADD COLUMN "master_percent" integer;--> statement-breakpoint
ALTER TABLE "appointments" ADD COLUMN "master_share" integer;--> statement-breakpoint
ALTER TABLE "appointments" ADD COLUMN "paid_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "salons" ADD COLUMN "points_percent" integer DEFAULT 5 NOT NULL;--> statement-breakpoint
ALTER TABLE "services" ADD COLUMN "pause_after_min" integer;--> statement-breakpoint
ALTER TABLE "services" ADD COLUMN "pause_min" integer;--> statement-breakpoint
ALTER TABLE "points_ledger" ADD CONSTRAINT "points_ledger_salon_id_salons_id_fk" FOREIGN KEY ("salon_id") REFERENCES "public"."salons"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "points_ledger" ADD CONSTRAINT "points_ledger_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "points_ledger" ADD CONSTRAINT "points_ledger_appointment_id_appointments_id_fk" FOREIGN KEY ("appointment_id") REFERENCES "public"."appointments"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "points_client_idx" ON "points_ledger" USING btree ("client_id");