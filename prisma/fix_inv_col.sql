ALTER TABLE IF EXISTS "public"."investigations" ADD COLUMN IF NOT EXISTS "investigation_id" TEXT;
ALTER TABLE IF EXISTS "public"."provincial_investigations" ADD COLUMN IF NOT EXISTS "investigation_id" TEXT;
