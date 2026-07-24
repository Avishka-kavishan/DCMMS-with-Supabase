-- =============================================================
-- DMMS Fix Part 3 — Final fix
-- Fixes: dcmms_subject_assignments RLS blocking anon inserts
-- =============================================================

-- Drop ALL existing policies on dcmms_subject_assignments dynamically
DO $$
DECLARE
  pol RECORD;
BEGIN
  FOR pol IN
    SELECT policyname
    FROM pg_policies
    WHERE tablename = 'dcmms_subject_assignments' AND schemaname = 'public'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.dcmms_subject_assignments', pol.policyname);
  END LOOP;
END $$;

-- Create fully open policies (anon + authenticated both allowed)
CREATE POLICY "sa_select_all"
  ON public.dcmms_subject_assignments FOR SELECT
  USING (true);

CREATE POLICY "sa_insert_all"
  ON public.dcmms_subject_assignments FOR INSERT
  WITH CHECK (true);

CREATE POLICY "sa_update_all"
  ON public.dcmms_subject_assignments FOR UPDATE
  USING (true);

CREATE POLICY "sa_delete_all"
  ON public.dcmms_subject_assignments FOR DELETE
  USING (true);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.dcmms_subject_assignments TO anon, authenticated;

NOTIFY pgrst, 'reload schema';
