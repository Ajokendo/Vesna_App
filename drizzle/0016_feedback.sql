CREATE TABLE "feedback" (
	"id" text PRIMARY KEY NOT NULL,
	"salon_slug" text,
	"role" text NOT NULL,
	"text" text NOT NULL,
	"contact" text,
	"page" text,
	"device" text,
	"resolved" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "feedback_created" ON "feedback" USING btree ("created_at");