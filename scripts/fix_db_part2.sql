-- =============================================================
-- DMMS Fix Part 2 — Run in Supabase SQL Editor
-- Fixes 3 remaining issues from functional test:
--   1. dcmms_subject_assignments: missing UNIQUE constraint on case_no
--   2. dcmms_subject_details:     RLS still blocking anon inserts
--   3. dcmms_subsequent_mails:    RLS still blocking anon inserts
-- =============================================================

-- ─────────────────────────────────────────────────────────────
-- FIX A: Add UNIQUE constraint on case_no in dcmms_subject_assignments
--   so that upsert ON CONFLICT (case_no) works correctly
-- ─────────────────────────────────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'dcmms_subject_assignments_case_no_key'
      AND conrelid = 'public.dcmms_subject_assignments'::regclass
  ) THEN
    ALTER TABLE public.dcmms_subject_assignments
      ADD CONSTRAINT dcmms_subject_assignments_case_no_key UNIQUE (case_no);
  END IF;
END $$;

-- ─────────────────────────────────────────────────────────────
-- FIX B: Drop ALL existing RLS policies on dcmms_subject_details
--   and replace with permissive ones (anon + authenticated)
-- ─────────────────────────────────────────────────────────────
DO $$
DECLARE
  pol RECORD;
BEGIN
  FOR pol IN
    SELECT policyname
    FROM pg_policies
    WHERE tablename = 'dcmms_subject_details' AND schemaname = 'public'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.dcmms_subject_details', pol.policyname);
  END LOOP;
END $$;

-- Allow anyone to read
CREATE POLICY "sd_select_all"
  ON public.dcmms_subject_details FOR SELECT
  USING (true);

-- Allow anon AND authenticated to insert (the app uses anon key even when logged in via JWT)
CREATE POLICY "sd_insert_all"
  ON public.dcmms_subject_details FOR INSERT
  WITH CHECK (true);

CREATE POLICY "sd_update_all"
  ON public.dcmms_subject_details FOR UPDATE
  USING (true);

CREATE POLICY "sd_delete_all"
  ON public.dcmms_subject_details FOR DELETE
  USING (true);

-- ─────────────────────────────────────────────────────────────
-- FIX C: Drop ALL existing RLS policies on dcmms_subsequent_mails
--   and replace with permissive ones (anon + authenticated)
-- ─────────────────────────────────────────────────────────────
DO $$
DECLARE
  pol RECORD;
BEGIN
  FOR pol IN
    SELECT policyname
    FROM pg_policies
    WHERE tablename = 'dcmms_subsequent_mails' AND schemaname = 'public'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.dcmms_subsequent_mails', pol.policyname);
  END LOOP;
END $$;

-- Allow anyone to read
CREATE POLICY "sm_select_all"
  ON public.dcmms_subsequent_mails FOR SELECT
  USING (true);

-- Allow anon AND authenticated to insert
CREATE POLICY "sm_insert_all"
  ON public.dcmms_subsequent_mails FOR INSERT
  WITH CHECK (true);

CREATE POLICY "sm_update_all"
  ON public.dcmms_subsequent_mails FOR UPDATE
  USING (true);

CREATE POLICY "sm_delete_all"
  ON public.dcmms_subsequent_mails FOR DELETE
  USING (true);

-- ─────────────────────────────────────────────────────────────
-- Re-grant permissions and reload schema cache
-- ─────────────────────────────────────────────────────────────
GRANT SELECT, INSERT, UPDATE, DELETE ON public.dcmms_subject_details     TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.dcmms_subsequent_mails    TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.dcmms_subject_assignments TO anon, authenticated;

NOTIFY pgrst, 'reload schema';
