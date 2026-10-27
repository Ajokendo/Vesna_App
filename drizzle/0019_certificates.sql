CREATE TABLE "certificates" (
	"id" text PRIMARY KEY NOT NULL,
	"salon_id" text NOT NULL,
	"code" text NOT NULL,
	"amount" integer NOT NULL,
	"balance" integer NOT NULL,
	"to_name" text,
	"from_name" text,
	"buyer_phone" text,
	"sold_method" text NOT NULL,
	"sold_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"cancelled_at" timestamp with time zone,
	CONSTRAINT "certificates_code_unique" UNIQUE("code")
);
--> statement-breakpoint
ALTER TABLE "appointments" ADD COLUMN "cert_paid" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "appointments" ADD COLUMN "certificate_id" text;--> statement-breakpoint
ALTER TABLE "salons" ADD COLUMN "certificates_enabled" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "salons" ADD COLUMN "certificate_months" integer DEFAULT 12 NOT NULL;--> statement-breakpoint
ALTER TABLE "certificates" ADD CONSTRAINT "certificates_salon_id_salons_id_fk" FOREIGN KEY ("salon_id") REFERENCES "public"."salons"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "cert_salon_sold" ON "certificates" USING btree ("salon_id","sold_at");