ALTER TABLE "salons" ADD COLUMN "map_url" text;--> statement-breakpoint
UPDATE "salons" SET "map_url" = 'https://2gis.kg/bishkek/geo/70000001020269548' WHERE "slug" = 'vesna' AND "map_url" IS NULL;
