ALTER TABLE "appointments" ADD COLUMN IF NOT EXISTS "materials" integer DEFAULT 0 NOT NULL;
