CREATE TYPE "public"."addon_rule" AS ENUM('FREE_IF_REPEAT');--> statement-breakpoint
CREATE TYPE "public"."appointment_source" AS ENUM('ONLINE', 'ADMIN', 'WALK_IN');--> statement-breakpoint
CREATE TYPE "public"."appointment_status" AS ENUM('BOOKED', 'CONFIRMED', 'ARRIVED', 'DONE', 'CANCELLED', 'NO_SHOW');--> statement-breakpoint
CREATE TYPE "public"."hair_length" AS ENUM('SHORT', 'MEDIUM', 'LONG', 'XLONG');--> statement-breakpoint
CREATE TYPE "public"."hall" AS ENUM('MEN', 'WOMEN');--> statement-breakpoint
CREATE TYPE "public"."role" AS ENUM('OWNER', 'MANAGER', 'ADMIN', 'MASTER');--> statement-breakpoint
CREATE TYPE "public"."schedule_kind" AS ENUM('WEEKLY', 'CYCLE');--> statement-breakpoint
CREATE TABLE "addons" (
	"id" text PRIMARY KEY NOT NULL,
	"category_id" text NOT NULL,
	"name" text NOT NULL,
	"price" integer NOT NULL,
	"duration_min" integer DEFAULT 0 NOT NULL,
	"rule" "addon_rule",
	"sort_order" integer DEFAULT 0 NOT NULL,
	"active" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "appointment_addons" (
	"appointment_id" text NOT NULL,
	"addon_id" text NOT NULL,
	"price" integer NOT NULL,
	CONSTRAINT "appointment_addons_appointment_id_addon_id_pk" PRIMARY KEY("appointment_id","addon_id")
);
--> statement-breakpoint
CREATE TABLE "appointments" (
	"id" text PRIMARY KEY NOT NULL,
	"salon_id" text NOT NULL,
	"staff_id" text NOT NULL,
	"client_id" text NOT NULL,
	"service_id" text NOT NULL,
	"hair_length" "hair_length",
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone NOT NULL,
	"price" integer NOT NULL,
	"price_max" integer,
	"points_used" integer DEFAULT 0 NOT NULL,
	"status" "appointment_status" DEFAULT 'BOOKED' NOT NULL,
	"source" "appointment_source" DEFAULT 'ONLINE' NOT NULL,
	"paid" boolean DEFAULT false NOT NULL,
	"payment_method" text,
	"comment" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "clients" (
	"id" text PRIMARY KEY NOT NULL,
	"salon_id" text NOT NULL,
	"name" text NOT NULL,
	"phone" text,
	"birth_date" date,
	"points" integer DEFAULT 0 NOT NULL,
	"guardian_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "salons" (
	"id" text PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"tagline" text,
	"city" text,
	"address" text,
	"phone" text,
	"whatsapp" text,
	"instagram" text,
	"logo_url" text,
	"accent_color" text DEFAULT '#4E6B45' NOT NULL,
	"timezone" text DEFAULT 'Asia/Bishkek' NOT NULL,
	"currency" text DEFAULT 'KGS' NOT NULL,
	"booking_horizon_days" integer DEFAULT 30 NOT NULL,
	"min_lead_minutes" integer DEFAULT 60 NOT NULL,
	"slot_step_minutes" integer DEFAULT 5 NOT NULL,
	"display_step_minutes" integer DEFAULT 15 NOT NULL,
	"default_commission" integer DEFAULT 50 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "salons_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "schedule_exceptions" (
	"id" text PRIMARY KEY NOT NULL,
	"staff_id" text NOT NULL,
	"date" date NOT NULL,
	"day_off" boolean DEFAULT true NOT NULL,
	"start_minute" integer,
	"end_minute" integer,
	"note" text
);
--> statement-breakpoint
CREATE TABLE "schedules" (
	"id" text PRIMARY KEY NOT NULL,
	"staff_id" text NOT NULL,
	"kind" "schedule_kind" NOT NULL,
	"weekdays" integer[] DEFAULT '{}' NOT NULL,
	"cycle_work" integer,
	"cycle_off" integer,
	"cycle_start" date,
	"start_minute" integer NOT NULL,
	"end_minute" integer NOT NULL,
	"break_start" integer,
	"break_end" integer,
	CONSTRAINT "schedules_staff_id_unique" UNIQUE("staff_id")
);
--> statement-breakpoint
CREATE TABLE "service_categories" (
	"id" text PRIMARY KEY NOT NULL,
	"salon_id" text NOT NULL,
	"hall" "hall" NOT NULL,
	"name" text NOT NULL,
	"note" text,
	"by_length" boolean DEFAULT false NOT NULL,
	"for_kids" boolean DEFAULT false NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"active" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "service_restrictions" (
	"service_id" text NOT NULL,
	"staff_id" text NOT NULL,
	CONSTRAINT "service_restrictions_service_id_staff_id_pk" PRIMARY KEY("service_id","staff_id")
);
--> statement-breakpoint
CREATE TABLE "services" (
	"id" text PRIMARY KEY NOT NULL,
	"category_id" text NOT NULL,
	"name" text NOT NULL,
	"price" integer,
	"price_max" integer,
	"duration_min" integer,
	"duration_label" text,
	"by_length" jsonb,
	"age_min" integer,
	"age_max" integer,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"active" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "staff" (
	"id" text PRIMARY KEY NOT NULL,
	"salon_id" text NOT NULL,
	"name" text NOT NULL,
	"phone" text,
	"photo_url" text,
	"title" text,
	"roles" "role"[] DEFAULT '{}' NOT NULL,
	"commission" integer,
	"active" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "staff_categories" (
	"staff_id" text NOT NULL,
	"category_id" text NOT NULL,
	CONSTRAINT "staff_categories_staff_id_category_id_pk" PRIMARY KEY("staff_id","category_id")
);
--> statement-breakpoint
ALTER TABLE "addons" ADD CONSTRAINT "addons_category_id_service_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."service_categories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "appointment_addons" ADD CONSTRAINT "appointment_addons_appointment_id_appointments_id_fk" FOREIGN KEY ("appointment_id") REFERENCES "public"."appointments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "appointment_addons" ADD CONSTRAINT "appointment_addons_addon_id_addons_id_fk" FOREIGN KEY ("addon_id") REFERENCES "public"."addons"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_salon_id_salons_id_fk" FOREIGN KEY ("salon_id") REFERENCES "public"."salons"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_staff_id_staff_id_fk" FOREIGN KEY ("staff_id") REFERENCES "public"."staff"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_service_id_services_id_fk" FOREIGN KEY ("service_id") REFERENCES "public"."services"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clients" ADD CONSTRAINT "clients_salon_id_salons_id_fk" FOREIGN KEY ("salon_id") REFERENCES "public"."salons"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "schedule_exceptions" ADD CONSTRAINT "schedule_exceptions_staff_id_staff_id_fk" FOREIGN KEY ("staff_id") REFERENCES "public"."staff"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "schedules" ADD CONSTRAINT "schedules_staff_id_staff_id_fk" FOREIGN KEY ("staff_id") REFERENCES "public"."staff"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_categories" ADD CONSTRAINT "service_categories_salon_id_salons_id_fk" FOREIGN KEY ("salon_id") REFERENCES "public"."salons"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_restrictions" ADD CONSTRAINT "service_restrictions_service_id_services_id_fk" FOREIGN KEY ("service_id") REFERENCES "public"."services"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_restrictions" ADD CONSTRAINT "service_restrictions_staff_id_staff_id_fk" FOREIGN KEY ("staff_id") REFERENCES "public"."staff"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "services" ADD CONSTRAINT "services_category_id_service_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."service_categories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "staff" ADD CONSTRAINT "staff_salon_id_salons_id_fk" FOREIGN KEY ("salon_id") REFERENCES "public"."salons"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "staff_categories" ADD CONSTRAINT "staff_categories_staff_id_staff_id_fk" FOREIGN KEY ("staff_id") REFERENCES "public"."staff"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "staff_categories" ADD CONSTRAINT "staff_categories_category_id_service_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."service_categories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "appt_salon_time" ON "appointments" USING btree ("salon_id","starts_at");--> statement-breakpoint
CREATE INDEX "appt_staff_time" ON "appointments" USING btree ("staff_id","starts_at");--> statement-breakpoint
CREATE UNIQUE INDEX "client_salon_phone" ON "clients" USING btree ("salon_id","phone");--> statement-breakpoint
CREATE INDEX "client_salon_idx" ON "clients" USING btree ("salon_id");--> statement-breakpoint
CREATE UNIQUE INDEX "schedule_exception_day" ON "schedule_exceptions" USING btree ("staff_id","date");--> statement-breakpoint
CREATE INDEX "category_salon_idx" ON "service_categories" USING btree ("salon_id");--> statement-breakpoint
CREATE INDEX "staff_salon_idx" ON "staff" USING btree ("salon_id");