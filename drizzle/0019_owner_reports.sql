CREATE TABLE "expenses" (
	"id" text PRIMARY KEY NOT NULL,
	"salon_id" text NOT NULL,
	"date" date NOT NULL,
	"category" text NOT NULL,
	"amount" integer NOT NULL,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "salons" ADD COLUMN "owner_pin_hash" text;--> statement-breakpoint
ALTER TABLE "salons" ADD COLUMN "owner_pin_failed" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "salons" ADD COLUMN "owner_pin_locked_until" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_salon_id_salons_id_fk" FOREIGN KEY ("salon_id") REFERENCES "public"."salons"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "expenses_salon_date" ON "expenses" USING btree ("salon_id","date");