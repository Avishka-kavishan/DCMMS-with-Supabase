-- ─────────────────────────────────────────────────────────────
-- Fix Full System Extension Flow & Missing Database Columns
-- Target Project ID: qhkrndgnfzifswnvpilb
-- Run this script in Supabase SQL Editor:
-- https://supabase.com/dashboard/project/qhkrndgnfzifswnvpilb/sql/new
-- ─────────────────────────────────────────────────────────────

-- 1. Table: dcmms_subject_assignments
CREATE TABLE IF NOT EXISTS public.dcmms_subject_assignments (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  case_no TEXT NOT NULL UNIQUE,
  subject_officer_name TEXT,
  assigned_officers TEXT[],
  status TEXT DEFAULT 'Step 1: Officers Assigned',
  appointment_date DATE,
  report_due_date DATE,
  dates_submitted_by_subject BOOLEAN DEFAULT FALSE,
  extension_term TEXT,
  extension_start_date DATE,
  extension_end_date DATE,
  certification_submitted BOOLEAN DEFAULT FALSE,
  certification_date DATE,
  report_submit_date DATE,
  report_content TEXT,
  chairman JSONB,
  members JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.dcmms_subject_assignments
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS extension_approval_status TEXT,
  ADD COLUMN IF NOT EXISTS extension_decision_date DATE,
  ADD COLUMN IF NOT EXISTS extension_term TEXT,
  ADD COLUMN IF NOT EXISTS extension_start_date DATE,
  ADD COLUMN IF NOT EXISTS extension_end_date DATE,
  ADD COLUMN IF NOT EXISTS extension_requested_by_admin BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS extension_submitted_by_subject BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS after_investigation_sent BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS after_investigation_date DATE,
  ADD COLUMN IF NOT EXISTS investigation_file_no TEXT,
  ADD COLUMN IF NOT EXISTS investigation_status TEXT,
  ADD COLUMN IF NOT EXISTS investigation_notes TEXT,
  ADD COLUMN IF NOT EXISTS progress_details TEXT;

-- 2. Table: dcmms_subject
CREATE TABLE IF NOT EXISTS public.dcmms_subject (
  case_no TEXT PRIMARY KEY,
  id TEXT,
  ref_no TEXT,
  subject_file_number TEXT,
  school_no TEXT,
  subject_officer_id TEXT,
  subject_officer_name TEXT,
  assigned_officer TEXT,
  officer_name TEXT,
  subject TEXT,
  status TEXT DEFAULT 'In Progress',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.dcmms_subject
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS report_due_date DATE,
  ADD COLUMN IF NOT EXISTS appointment_date DATE;

-- 3. Table: dcmms_preliminary_investigations
CREATE TABLE IF NOT EXISTS public.dcmms_preliminary_investigations (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  case_no TEXT,
  reason TEXT,
  committee_members JSONB,
  appointment_date DATE,
  report_due_date DATE,
  report_received_date DATE,
  findings TEXT,
  observations TEXT,
  recommendations TEXT,
  next_action TEXT,
  status TEXT DEFAULT 'Initiated',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.dcmms_preliminary_investigations
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS extension_approval_status TEXT,
  ADD COLUMN IF NOT EXISTS extension_decision_date DATE,
  ADD COLUMN IF NOT EXISTS extension_term TEXT,
  ADD COLUMN IF NOT EXISTS extension_start_date DATE,
  ADD COLUMN IF NOT EXISTS extension_end_date DATE,
  ADD COLUMN IF NOT EXISTS extension_requested_by_admin BOOLEAN DEFAULT FALSE;

-- 4. Table: dcmms_investigation
CREATE TABLE IF NOT EXISTS public.dcmms_investigation (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  investigate_id TEXT,
  case_no TEXT,
  subject_file_number TEXT,
  inquiry_no TEXT,
  investigation_report_no TEXT,
  subject TEXT,
  target_date DATE,
  step_taken TEXT,
  status TEXT DEFAULT 'Scheduled',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.dcmms_investigation
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS extension_approval_status TEXT,
  ADD COLUMN IF NOT EXISTS extension_decision_date DATE,
  ADD COLUMN IF NOT EXISTS extension_term TEXT,
  ADD COLUMN IF NOT EXISTS extension_start_date DATE,
  ADD COLUMN IF NOT EXISTS extension_end_date DATE,
  ADD COLUMN IF NOT EXISTS report_due_date DATE;

-- 5. Table: dcmms_calendar
CREATE TABLE IF NOT EXISTS public.dcmms_calendar (
  id TEXT PRIMARY KEY,
  case_no TEXT,
  date DATE,
  summary TEXT,
  description TEXT,
  source TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
