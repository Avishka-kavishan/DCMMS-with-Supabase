-- =============================================================
-- DMMS Database Migration & Fix Script
-- Run this in your Supabase SQL Editor (Dashboard → SQL Editor)
-- =============================================================

-- ─────────────────────────────────────────────────────────────
-- FIX 1: Add missing 'assigned_officer' column to dcmms_subject
-- ─────────────────────────────────────────────────────────────
ALTER TABLE public.dcmms_subject
  ADD COLUMN IF NOT EXISTS officer_name TEXT,
  ADD COLUMN IF NOT EXISTS assigned_officer TEXT;

-- ─────────────────────────────────────────────────────────────
-- FIX 2: Create dcmms_subject_assignments (was completely missing)
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.dcmms_subject_assignments (
  id                      TEXT PRIMARY KEY,
  case_no                 TEXT NOT NULL,
  subject_officer_name    TEXT,
  assigned_officers       TEXT[],           -- array of officer names (investigation page)
  status                  TEXT DEFAULT 'Step 1: Officers Assigned',
  appointment_date        DATE,
  report_due_date         DATE,
  extension_term          TEXT,
  extension_start_date    DATE,
  extension_end_date      DATE,
  certification_submitted BOOLEAN DEFAULT FALSE,
  certification_date      DATE,
  report_submit_date      DATE,
  report_content          TEXT,
  created_at              TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.dcmms_subject_assignments ENABLE ROW LEVEL SECURITY;

-- Allow all authenticated users to read
CREATE POLICY "Allow authenticated read dcmms_subject_assignments"
  ON public.dcmms_subject_assignments FOR SELECT
  USING (auth.role() = 'authenticated' OR auth.role() = 'anon');

-- Allow authenticated users to insert/upsert/update
CREATE POLICY "Allow authenticated write dcmms_subject_assignments"
  ON public.dcmms_subject_assignments FOR ALL
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

-- ─────────────────────────────────────────────────────────────
-- FIX 3: Create dcmms_investigation (was completely missing)
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.dcmms_investigation (
  id                TEXT PRIMARY KEY,
  case_no           TEXT NOT NULL,
  inquiry_no        TEXT,
  subject           TEXT,
  target_date       DATE,
  status            TEXT DEFAULT 'Scheduled',
  assigned_officer  TEXT,
  notes             TEXT,
  created_at        TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.dcmms_investigation ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow authenticated read dcmms_investigation"
  ON public.dcmms_investigation FOR SELECT
  USING (auth.role() = 'authenticated' OR auth.role() = 'anon');

CREATE POLICY "Allow authenticated write dcmms_investigation"
  ON public.dcmms_investigation FOR ALL
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

-- ─────────────────────────────────────────────────────────────
-- FIX 4: Create dcmms_investigation_officers (was completely missing)
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.dcmms_investigation_officers (
  id              TEXT PRIMARY KEY,
  full_name       TEXT NOT NULL,
  nic_no          TEXT,
  officer_role    TEXT CHECK (officer_role IN ('Chairman', 'Member')),
  studied_schools TEXT[],
  children_schools TEXT[],
  email           TEXT,
  status          TEXT DEFAULT 'Active' CHECK (status IN ('Active', 'Inactive')),
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.dcmms_investigation_officers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow authenticated read dcmms_investigation_officers"
  ON public.dcmms_investigation_officers FOR SELECT
  USING (auth.role() = 'authenticated' OR auth.role() = 'anon');

CREATE POLICY "Allow authenticated write dcmms_investigation_officers"
  ON public.dcmms_investigation_officers FOR ALL
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

-- ─────────────────────────────────────────────────────────────
-- FIX 5: Fix RLS on dcmms_subject_details
--   (was blocking authenticated users from inserting)
-- ─────────────────────────────────────────────────────────────

-- Drop existing overly-restrictive policies
DROP POLICY IF EXISTS "Allow insert for authenticated users" ON public.dcmms_subject_details;
DROP POLICY IF EXISTS "Allow read for authenticated users" ON public.dcmms_subject_details;
DROP POLICY IF EXISTS "Users can insert subject details" ON public.dcmms_subject_details;
DROP POLICY IF EXISTS "Users can read subject details" ON public.dcmms_subject_details;
DROP POLICY IF EXISTS "Enable read access for all users" ON public.dcmms_subject_details;
DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON public.dcmms_subject_details;

-- Create permissive policies
CREATE POLICY "dcmms_subject_details_select"
  ON public.dcmms_subject_details FOR SELECT
  USING (true);

CREATE POLICY "dcmms_subject_details_insert"
  ON public.dcmms_subject_details FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "dcmms_subject_details_update"
  ON public.dcmms_subject_details FOR UPDATE
  USING (auth.role() = 'authenticated');

CREATE POLICY "dcmms_subject_details_delete"
  ON public.dcmms_subject_details FOR DELETE
  USING (auth.role() = 'authenticated');

-- ─────────────────────────────────────────────────────────────
-- FIX 6: Fix RLS on dcmms_subsequent_mails
--   (was blocking authenticated users from inserting)
-- ─────────────────────────────────────────────────────────────

-- Drop existing overly-restrictive policies
DROP POLICY IF EXISTS "Allow insert for authenticated users" ON public.dcmms_subsequent_mails;
DROP POLICY IF EXISTS "Allow read for authenticated users" ON public.dcmms_subsequent_mails;
DROP POLICY IF EXISTS "Users can insert subsequent mails" ON public.dcmms_subsequent_mails;
DROP POLICY IF EXISTS "Users can read subsequent mails" ON public.dcmms_subsequent_mails;
DROP POLICY IF EXISTS "Enable read access for all users" ON public.dcmms_subsequent_mails;
DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON public.dcmms_subsequent_mails;

-- Create permissive policies
CREATE POLICY "dcmms_subsequent_mails_select"
  ON public.dcmms_subsequent_mails FOR SELECT
  USING (true);

CREATE POLICY "dcmms_subsequent_mails_insert"
  ON public.dcmms_subsequent_mails FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "dcmms_subsequent_mails_update"
  ON public.dcmms_subsequent_mails FOR UPDATE
  USING (auth.role() = 'authenticated');

CREATE POLICY "dcmms_subsequent_mails_delete"
  ON public.dcmms_subsequent_mails FOR DELETE
  USING (auth.role() = 'authenticated');

-- ─────────────────────────────────────────────────────────────
-- FIX 7: Create dcmms_audit_logs (did not exist at all)
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.dcmms_audit_logs (
  id         TEXT PRIMARY KEY,
  timestamp  TIMESTAMPTZ DEFAULT NOW(),
  user_id    TEXT,
  username   TEXT,
  email      TEXT,
  action     TEXT NOT NULL,
  details    TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.dcmms_audit_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "dcmms_audit_logs_select" ON public.dcmms_audit_logs;
DROP POLICY IF EXISTS "dcmms_audit_logs_insert" ON public.dcmms_audit_logs;

CREATE POLICY "dcmms_audit_logs_select"
  ON public.dcmms_audit_logs FOR SELECT
  USING (true);

CREATE POLICY "dcmms_audit_logs_insert"
  ON public.dcmms_audit_logs FOR INSERT
  WITH CHECK (true);

-- ─────────────────────────────────────────────────────────────
-- FIX 8: Create dcmms_sessions (did not exist at all)
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.dcmms_sessions (
  id           TEXT PRIMARY KEY,
  user_id      TEXT,
  username     TEXT,
  email        TEXT,
  login_time   TIMESTAMPTZ DEFAULT NOW(),
  logout_time  TIMESTAMPTZ,
  duration     INTEGER,
  status       TEXT DEFAULT 'active' CHECK (status IN ('active', 'logged_out', 'forced_logged_out')),
  ip_address   TEXT,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.dcmms_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "dcmms_sessions_select" ON public.dcmms_sessions;
DROP POLICY IF EXISTS "dcmms_sessions_insert" ON public.dcmms_sessions;
DROP POLICY IF EXISTS "dcmms_sessions_update" ON public.dcmms_sessions;

CREATE POLICY "dcmms_sessions_select"
  ON public.dcmms_sessions FOR SELECT
  USING (true);

CREATE POLICY "dcmms_sessions_insert"
  ON public.dcmms_sessions FOR INSERT
  WITH CHECK (true);

CREATE POLICY "dcmms_sessions_update"
  ON public.dcmms_sessions FOR UPDATE
  USING (true);

-- ─────────────────────────────────────────────────────────────
-- Grant API access to all tables and reload PostgREST schema
-- ─────────────────────────────────────────────────────────────
GRANT USAGE ON SCHEMA public TO anon, authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.dcmms_audit_logs          TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.dcmms_sessions             TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.dcmms_subject_assignments  TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.dcmms_investigation        TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.dcmms_investigation_officers TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.dcmms_subject_details      TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.dcmms_subsequent_mails     TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.dcmms_subject              TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.dcmms_daily_mail           TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.dcmms_profiles             TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.dcmms_calendar             TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.dcmms_institutes           TO anon, authenticated;

-- Notify PostgREST to reload its schema cache
NOTIFY pgrst, 'reload schema';
