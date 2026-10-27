CREATE TABLE "wa_messages" (
	"id" text PRIMARY KEY NOT NULL,
	"salon_id" text NOT NULL,
	"client_id" text,
	"to" text NOT NULL,
	"template" text NOT NULL,
	"status" text NOT NULL,
	"wa_id" text,
	"error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "salons" ADD COLUMN "wa_notify" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "salons" ADD COLUMN "wa_phone_id" text;--> statement-breakpoint
ALTER TABLE "wa_messages" ADD CONSTRAINT "wa_messages_salon_id_salons_id_fk" FOREIGN KEY ("salon_id") REFERENCES "public"."salons"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "wa_salon_created" ON "wa_messages" USING btree ("salon_id","created_at");