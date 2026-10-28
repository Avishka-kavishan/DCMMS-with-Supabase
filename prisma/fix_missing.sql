ALTER TABLE IF EXISTS "public"."dcmms_preliminary_investigations" ADD COLUMN IF NOT EXISTS "extension_decision_date" VARCHAR(255);
CREATE TABLE IF NOT EXISTS "public"."investigations" (
  "id" TEXT PRIMARY KEY,
  "case_no" TEXT,
  "status" TEXT,
  "created_at" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP
);
