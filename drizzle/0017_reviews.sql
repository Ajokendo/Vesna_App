CREATE TABLE "reviews" (
	"id" text PRIMARY KEY NOT NULL,
	"salon_id" text NOT NULL,
	"appointment_id" text NOT NULL,
	"staff_id" text NOT NULL,
	"client_id" text NOT NULL,
	"stars" integer NOT NULL,
	"text" text,
	"gis_clicked_at" timestamp with time zone,
	"gis_rewarded_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "reviews_appointment_id_unique" UNIQUE("appointment_id")
);
--> statement-breakpoint
ALTER TABLE "salons" ADD COLUMN "review_bonus" integer DEFAULT 50 NOT NULL;--> statement-breakpoint
ALTER TABLE "staff" ADD COLUMN "show_rating" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_salon_id_salons_id_fk" FOREIGN KEY ("salon_id") REFERENCES "public"."salons"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_appointment_id_appointments_id_fk" FOREIGN KEY ("appointment_id") REFERENCES "public"."appointments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_staff_id_staff_id_fk" FOREIGN KEY ("staff_id") REFERENCES "public"."staff"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "reviews_staff" ON "reviews" USING btree ("staff_id");