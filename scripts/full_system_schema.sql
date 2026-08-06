-- =============================================================================
-- DMMS Complete System Database Schema Script (Fully Comprehensive)
-- Target Project ID: qhkrndgnfzifswnvpilb
-- Run this script in Supabase SQL Editor:
-- https://supabase.com/dashboard/project/qhkrndgnfzifswnvpilb/sql/new
-- =============================================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- -----------------------------------------------------------------------------
-- 1. STAFF PROFILES & USERS TABLE
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.dcmms_profiles (
  id               TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  full_name        TEXT,
  username         TEXT,
  salary_no        TEXT,
  email            TEXT,
  password         TEXT,
  role             TEXT,
  status           TEXT DEFAULT 'Active',
  nic_no           TEXT,
  officer_role     TEXT,
  studied_schools  TEXT[],
  children_schools TEXT[],
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  updated_at       TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.dcmms_profiles ALTER COLUMN email DROP NOT NULL;
ALTER TABLE public.dcmms_profiles ALTER COLUMN role DROP NOT NULL;
ALTER TABLE public.dcmms_profiles DROP CONSTRAINT IF EXISTS dcmms_profiles_email_key;
ALTER TABLE public.dcmms_profiles DROP CONSTRAINT IF EXISTS dcmms_profiles_salary_no_key;

ALTER TABLE public.dcmms_profiles ADD COLUMN IF NOT EXISTS full_name TEXT;
ALTER TABLE public.dcmms_profiles ADD COLUMN IF NOT EXISTS username TEXT;
ALTER TABLE public.dcmms_profiles ADD COLUMN IF NOT EXISTS salary_no TEXT;
ALTER TABLE public.dcmms_profiles ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE public.dcmms_profiles ADD COLUMN IF NOT EXISTS password TEXT;
ALTER TABLE public.dcmms_profiles ADD COLUMN IF NOT EXISTS role TEXT;
ALTER TABLE public.dcmms_profiles ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'Active';
ALTER TABLE public.dcmms_profiles ADD COLUMN IF NOT EXISTS nic_no TEXT;
ALTER TABLE public.dcmms_profiles ADD COLUMN IF NOT EXISTS officer_role TEXT;
ALTER TABLE public.dcmms_profiles ADD COLUMN IF NOT EXISTS studied_schools TEXT[];
ALTER TABLE public.dcmms_profiles ADD COLUMN IF NOT EXISTS children_schools TEXT[];

-- -----------------------------------------------------------------------------
-- 2. SCHOOLS & INSTITUTES TABLES
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.dcmms_schools (
  school_no    TEXT PRIMARY KEY,
  school_name  TEXT NOT NULL,
  address      TEXT,
  province     TEXT,
  zone         TEXT,
  school_type  TEXT,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.dcmms_institutes (
  id             TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  census_no      TEXT,
  institute_name TEXT NOT NULL,
  institute_type TEXT,
  province       TEXT,
  district       TEXT,
  zone           TEXT,
  division       TEXT,
  address        TEXT,
  created_at     TIMESTAMPTZ DEFAULT NOW()
);

-- -----------------------------------------------------------------------------
-- 3. DAILY MAIL TABLE
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.dcmms_daily_mail (
  id                             TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  serial_number                  TEXT,
  ref_no                         TEXT,
  letter_no                      TEXT,
  letter_number                  TEXT,
  letter_type                    TEXT,
  subject_category               TEXT,
  sender_name                    TEXT,
  sender_address                 TEXT,
  institute_name                 TEXT,
  name_of_subject_officer        TEXT,
  party_to_whom_sent             TEXT,
  nature_of_letter               TEXT,
  date_of_receipt_add_sec        DATE,
  date_of_submission_disc_branch DATE,
  received_date                  DATE,
  letter_date                    DATE,
  subject                        TEXT,
  subject_topic                  TEXT,
  classification_of_letter       TEXT,
  manner_of_receipt              TEXT,
  priority                       TEXT,
  reporter_email                 TEXT,
  officer_name                   TEXT,
  region_province                TEXT,
  status                         TEXT DEFAULT 'registered',
  created_at                     TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.dcmms_daily_mail ADD COLUMN IF NOT EXISTS serial_number TEXT;
ALTER TABLE public.dcmms_daily_mail ADD COLUMN IF NOT EXISTS ref_no TEXT;
ALTER TABLE public.dcmms_daily_mail ADD COLUMN IF NOT EXISTS letter_no TEXT;
ALTER TABLE public.dcmms_daily_mail ADD COLUMN IF NOT EXISTS letter_number TEXT;
ALTER TABLE public.dcmms_daily_mail ADD COLUMN IF NOT EXISTS letter_type TEXT;
ALTER TABLE public.dcmms_daily_mail ADD COLUMN IF NOT EXISTS subject_category TEXT;
ALTER TABLE public.dcmms_daily_mail ADD COLUMN IF NOT EXISTS sender_name TEXT;
ALTER TABLE public.dcmms_daily_mail ADD COLUMN IF NOT EXISTS sender_address TEXT;
ALTER TABLE public.dcmms_daily_mail ADD COLUMN IF NOT EXISTS institute_name TEXT;
ALTER TABLE public.dcmms_daily_mail ADD COLUMN IF NOT EXISTS name_of_subject_officer TEXT;
ALTER TABLE public.dcmms_daily_mail ADD COLUMN IF NOT EXISTS party_to_whom_sent TEXT;
ALTER TABLE public.dcmms_daily_mail ADD COLUMN IF NOT EXISTS nature_of_letter TEXT;
ALTER TABLE public.dcmms_daily_mail ADD COLUMN IF NOT EXISTS date_of_receipt_add_sec DATE;
ALTER TABLE public.dcmms_daily_mail ADD COLUMN IF NOT EXISTS date_of_submission_disc_branch DATE;
ALTER TABLE public.dcmms_daily_mail ADD COLUMN IF NOT EXISTS received_date DATE;
ALTER TABLE public.dcmms_daily_mail ADD COLUMN IF NOT EXISTS letter_date DATE;
ALTER TABLE public.dcmms_daily_mail ADD COLUMN IF NOT EXISTS subject TEXT;
ALTER TABLE public.dcmms_daily_mail ADD COLUMN IF NOT EXISTS subject_topic TEXT;
ALTER TABLE public.dcmms_daily_mail ADD COLUMN IF NOT EXISTS classification_of_letter TEXT;
ALTER TABLE public.dcmms_daily_mail ADD COLUMN IF NOT EXISTS manner_of_receipt TEXT;
ALTER TABLE public.dcmms_daily_mail ADD COLUMN IF NOT EXISTS priority TEXT;
ALTER TABLE public.dcmms_daily_mail ADD COLUMN IF NOT EXISTS reporter_email TEXT;
ALTER TABLE public.dcmms_daily_mail ADD COLUMN IF NOT EXISTS officer_name TEXT;
ALTER TABLE public.dcmms_daily_mail ADD COLUMN IF NOT EXISTS region_province TEXT;
ALTER TABLE public.dcmms_daily_mail ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'registered';

-- -----------------------------------------------------------------------------
-- 4. SUBJECT OFFICER'S CASES TABLE
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.dcmms_subject (
  case_no                                TEXT PRIMARY KEY,
  id                                     TEXT,
  ref_no                                 TEXT,
  subject_file_number                    TEXT,
  school_no                              TEXT,
  subject_officer_id                     TEXT,
  subject_officer_name                   TEXT,
  assigned_officer                       TEXT,
  officer_name                           TEXT,
  subject                                TEXT,
  name_of_person_submitting_complaint    TEXT,
  address_of_person_submitting_complaint TEXT,
  matter_related_to_complaint            TEXT,
  complaint_letter_classification        TEXT,
  approval_of_secretary_of_education     BOOLEAN DEFAULT FALSE,
  approval_date                          DATE,
  date_prep_submission_signature         DATE,
  assigned_date                          DATE,
  priority                               TEXT,
  status                                 TEXT DEFAULT 'In Progress',
  created_at                             TIMESTAMPTZ DEFAULT NOW(),
  updated_at                             TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.dcmms_subject ADD COLUMN IF NOT EXISTS id TEXT;
ALTER TABLE public.dcmms_subject ADD COLUMN IF NOT EXISTS ref_no TEXT;
ALTER TABLE public.dcmms_subject ADD COLUMN IF NOT EXISTS subject_file_number TEXT;
ALTER TABLE public.dcmms_subject ADD COLUMN IF NOT EXISTS school_no TEXT;
ALTER TABLE public.dcmms_subject ADD COLUMN IF NOT EXISTS subject_officer_id TEXT;
ALTER TABLE public.dcmms_subject ADD COLUMN IF NOT EXISTS subject_officer_name TEXT;
ALTER TABLE public.dcmms_subject ADD COLUMN IF NOT EXISTS assigned_officer TEXT;
ALTER TABLE public.dcmms_subject ADD COLUMN IF NOT EXISTS officer_name TEXT;
ALTER TABLE public.dcmms_subject ADD COLUMN IF NOT EXISTS subject TEXT;
ALTER TABLE public.dcmms_subject ADD COLUMN IF NOT EXISTS priority TEXT;
ALTER TABLE public.dcmms_subject ADD COLUMN IF NOT EXISTS name_of_person_submitting_complaint TEXT;
ALTER TABLE public.dcmms_subject ADD COLUMN IF NOT EXISTS address_of_person_submitting_complaint TEXT;
ALTER TABLE public.dcmms_subject ADD COLUMN IF NOT EXISTS matter_related_to_complaint TEXT;
ALTER TABLE public.dcmms_subject ADD COLUMN IF NOT EXISTS complaint_letter_classification TEXT;
ALTER TABLE public.dcmms_subject ADD COLUMN IF NOT EXISTS approval_of_secretary_of_education BOOLEAN DEFAULT FALSE;
ALTER TABLE public.dcmms_subject ADD COLUMN IF NOT EXISTS approval_date DATE;
ALTER TABLE public.dcmms_subject ADD COLUMN IF NOT EXISTS date_prep_submission_signature DATE;
ALTER TABLE public.dcmms_subject ADD COLUMN IF NOT EXISTS assigned_date DATE;
ALTER TABLE public.dcmms_subject ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'In Progress';

-- -----------------------------------------------------------------------------
-- 5. SUBJECT DETAILS TABLE
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.dcmms_subject_details (
  id                      TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  case_no                 TEXT,
  ref_no                  TEXT,
  received_date           DATE,
  report_state            TEXT,
  special_notes           TEXT,
  subject_officer_name    TEXT,
  step_taken              TEXT,
  officer_name            TEXT,
  institution_name        TEXT,
  institution_type        TEXT,
  region_province         TEXT,
  education_zone          TEXT,
  division                TEXT,
  subject_topic           TEXT,
  nature_of_complaint     TEXT,
  date_of_offence         DATE,
  date_complaint_received DATE,
  received_by             TEXT,
  status                  TEXT DEFAULT 'Pending',
  created_at              TIMESTAMPTZ DEFAULT NOW(),
  updated_at              TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.dcmms_subject_details ADD COLUMN IF NOT EXISTS case_no TEXT;
ALTER TABLE public.dcmms_subject_details ADD COLUMN IF NOT EXISTS ref_no TEXT;
ALTER TABLE public.dcmms_subject_details ADD COLUMN IF NOT EXISTS received_date DATE;
ALTER TABLE public.dcmms_subject_details ADD COLUMN IF NOT EXISTS report_state TEXT;
ALTER TABLE public.dcmms_subject_details ADD COLUMN IF NOT EXISTS special_notes TEXT;
ALTER TABLE public.dcmms_subject_details ADD COLUMN IF NOT EXISTS subject_officer_name TEXT;
ALTER TABLE public.dcmms_subject_details ADD COLUMN IF NOT EXISTS step_taken TEXT;
ALTER TABLE public.dcmms_subject_details ADD COLUMN IF NOT EXISTS officer_name TEXT;
ALTER TABLE public.dcmms_subject_details ADD COLUMN IF NOT EXISTS institution_name TEXT;
ALTER TABLE public.dcmms_subject_details ADD COLUMN IF NOT EXISTS institution_type TEXT;
ALTER TABLE public.dcmms_subject_details ADD COLUMN IF NOT EXISTS region_province TEXT;
ALTER TABLE public.dcmms_subject_details ADD COLUMN IF NOT EXISTS education_zone TEXT;
ALTER TABLE public.dcmms_subject_details ADD COLUMN IF NOT EXISTS division TEXT;
ALTER TABLE public.dcmms_subject_details ADD COLUMN IF NOT EXISTS subject_topic TEXT;
ALTER TABLE public.dcmms_subject_details ADD COLUMN IF NOT EXISTS nature_of_complaint TEXT;
ALTER TABLE public.dcmms_subject_details ADD COLUMN IF NOT EXISTS date_of_offence DATE;
ALTER TABLE public.dcmms_subject_details ADD COLUMN IF NOT EXISTS date_complaint_received DATE;
ALTER TABLE public.dcmms_subject_details ADD COLUMN IF NOT EXISTS received_by TEXT;
ALTER TABLE public.dcmms_subject_details ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'Pending';

-- -----------------------------------------------------------------------------
-- 6. SUBJECT ASSIGNMENTS TABLE
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.dcmms_subject_assignments (
  id                         TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  case_no                    TEXT NOT NULL,
  subject_officer_name       TEXT,
  assigned_officers          TEXT[],
  status                     TEXT DEFAULT 'Step 1: Officers Assigned',
  appointment_date           DATE,
  report_due_date            DATE,
  dates_submitted_by_subject BOOLEAN DEFAULT FALSE,
  extension_term             TEXT,
  extension_start_date       DATE,
  extension_end_date         DATE,
  certification_submitted    BOOLEAN DEFAULT FALSE,
  certification_date         DATE,
  report_submit_date         DATE,
  report_content             TEXT,
  chairman                   JSONB,
  members                    JSONB,
  created_at                 TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.dcmms_subject_assignments ADD COLUMN IF NOT EXISTS case_no TEXT;
ALTER TABLE public.dcmms_subject_assignments ADD COLUMN IF NOT EXISTS subject_officer_name TEXT;
ALTER TABLE public.dcmms_subject_assignments ADD COLUMN IF NOT EXISTS assigned_officers TEXT;
ALTER TABLE public.dcmms_subject_assignments ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'Step 1: Officers Assigned';
ALTER TABLE public.dcmms_subject_assignments ADD COLUMN IF NOT EXISTS appointment_date DATE;
ALTER TABLE public.dcmms_subject_assignments ADD COLUMN IF NOT EXISTS report_due_date DATE;
ALTER TABLE public.dcmms_subject_assignments ADD COLUMN IF NOT EXISTS dates_submitted_by_subject BOOLEAN DEFAULT FALSE;
ALTER TABLE public.dcmms_subject_assignments ADD COLUMN IF NOT EXISTS extension_term TEXT;
ALTER TABLE public.dcmms_subject_assignments ADD COLUMN IF NOT EXISTS extension_start_date DATE;
ALTER TABLE public.dcmms_subject_assignments ADD COLUMN IF NOT EXISTS extension_end_date DATE;
ALTER TABLE public.dcmms_subject_assignments ADD COLUMN IF NOT EXISTS certification_submitted BOOLEAN DEFAULT FALSE;
ALTER TABLE public.dcmms_subject_assignments ADD COLUMN IF NOT EXISTS certification_date DATE;
ALTER TABLE public.dcmms_subject_assignments ADD COLUMN IF NOT EXISTS report_submit_date DATE;
ALTER TABLE public.dcmms_subject_assignments ADD COLUMN IF NOT EXISTS report_content TEXT;
ALTER TABLE public.dcmms_subject_assignments ADD COLUMN IF NOT EXISTS chairman JSONB;
ALTER TABLE public.dcmms_subject_assignments ADD COLUMN IF NOT EXISTS members JSONB;

-- -----------------------------------------------------------------------------
-- 7. SUBSEQUENT MAILS TABLE
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.dcmms_subsequent_mails (
  id                             TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  serial_number                  TEXT,
  case_no                        TEXT,
  subject_file_number            TEXT,
  letter_number                  TEXT,
  party_to_whom_sent             TEXT,
  nature_of_letter               TEXT,
  date_of_receipt_add_sec        DATE,
  date_of_submission_disc_branch DATE,
  subject_topic                  TEXT,
  classification_of_letter       TEXT,
  manner_of_receipt              TEXT,
  priority                       TEXT,
  mail_officer_name              TEXT,
  sender_name                    TEXT,
  letter_title                   TEXT,
  letter_type                    TEXT,
  mail_date                      DATE,
  received_date                  DATE,
  is_answer_letter               BOOLEAN DEFAULT FALSE,
  created_at                     TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.dcmms_subsequent_mails ADD COLUMN IF NOT EXISTS serial_number TEXT;
ALTER TABLE public.dcmms_subsequent_mails ADD COLUMN IF NOT EXISTS case_no TEXT;
ALTER TABLE public.dcmms_subsequent_mails ADD COLUMN IF NOT EXISTS subject_file_number TEXT;
ALTER TABLE public.dcmms_subsequent_mails ADD COLUMN IF NOT EXISTS letter_number TEXT;
ALTER TABLE public.dcmms_subsequent_mails ADD COLUMN IF NOT EXISTS party_to_whom_sent TEXT;
ALTER TABLE public.dcmms_subsequent_mails ADD COLUMN IF NOT EXISTS nature_of_letter TEXT;
ALTER TABLE public.dcmms_subsequent_mails ADD COLUMN IF NOT EXISTS date_of_receipt_add_sec DATE;
ALTER TABLE public.dcmms_subsequent_mails ADD COLUMN IF NOT EXISTS date_of_submission_disc_branch DATE;
ALTER TABLE public.dcmms_subsequent_mails ADD COLUMN IF NOT EXISTS subject_topic TEXT;
ALTER TABLE public.dcmms_subsequent_mails ADD COLUMN IF NOT EXISTS classification_of_letter TEXT;
ALTER TABLE public.dcmms_subsequent_mails ADD COLUMN IF NOT EXISTS manner_of_receipt TEXT;
ALTER TABLE public.dcmms_subsequent_mails ADD COLUMN IF NOT EXISTS priority TEXT;
ALTER TABLE public.dcmms_subsequent_mails ADD COLUMN IF NOT EXISTS mail_officer_name TEXT;
ALTER TABLE public.dcmms_subsequent_mails ADD COLUMN IF NOT EXISTS sender_name TEXT;
ALTER TABLE public.dcmms_subsequent_mails ADD COLUMN IF NOT EXISTS letter_title TEXT;
ALTER TABLE public.dcmms_subsequent_mails ADD COLUMN IF NOT EXISTS letter_type TEXT;
ALTER TABLE public.dcmms_subsequent_mails ADD COLUMN IF NOT EXISTS mail_date DATE;
ALTER TABLE public.dcmms_subsequent_mails ADD COLUMN IF NOT EXISTS received_date DATE;
ALTER TABLE public.dcmms_subsequent_mails ADD COLUMN IF NOT EXISTS is_answer_letter BOOLEAN DEFAULT FALSE;

-- -----------------------------------------------------------------------------
-- 8. CONCERNED OFFICERS TABLE
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.dcmms_concerned_officers (
  id                  TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  case_no             TEXT,
  subject_file_number TEXT,
  officer_name        TEXT,
  name                TEXT,
  institute_name      TEXT,
  institute_address   TEXT,
  position            TEXT,
  address             TEXT,
  appointment_date    DATE,
  date_of_appointment DATE,
  dob                 DATE,
  date_of_birth       DATE,
  nic                 TEXT,
  created_at          TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.dcmms_concerned_officers ADD COLUMN IF NOT EXISTS case_no TEXT;
ALTER TABLE public.dcmms_concerned_officers ADD COLUMN IF NOT EXISTS subject_file_number TEXT;
ALTER TABLE public.dcmms_concerned_officers ADD COLUMN IF NOT EXISTS officer_name TEXT;
ALTER TABLE public.dcmms_concerned_officers ADD COLUMN IF NOT EXISTS name TEXT;
ALTER TABLE public.dcmms_concerned_officers ADD COLUMN IF NOT EXISTS institute_name TEXT;
ALTER TABLE public.dcmms_concerned_officers ADD COLUMN IF NOT EXISTS institute_address TEXT;
ALTER TABLE public.dcmms_concerned_officers ADD COLUMN IF NOT EXISTS position TEXT;
ALTER TABLE public.dcmms_concerned_officers ADD COLUMN IF NOT EXISTS address TEXT;
ALTER TABLE public.dcmms_concerned_officers ADD COLUMN IF NOT EXISTS appointment_date DATE;
ALTER TABLE public.dcmms_concerned_officers ADD COLUMN IF NOT EXISTS date_of_appointment DATE;
ALTER TABLE public.dcmms_concerned_officers ADD COLUMN IF NOT EXISTS dob DATE;
ALTER TABLE public.dcmms_concerned_officers ADD COLUMN IF NOT EXISTS date_of_birth DATE;
ALTER TABLE public.dcmms_concerned_officers ADD COLUMN IF NOT EXISTS nic TEXT;

-- -----------------------------------------------------------------------------
-- 9. PRELIMINARY INVESTIGATIONS TABLE
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.dcmms_preliminary_investigations (
  id                   TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  case_no              TEXT,
  reason               TEXT,
  committee_members    JSONB,
  appointment_date     DATE,
  report_due_date      DATE,
  report_received_date DATE,
  findings             TEXT,
  observations         TEXT,
  recommendations      TEXT,
  next_action          TEXT,
  status               TEXT DEFAULT 'Initiated',
  created_at           TIMESTAMPTZ DEFAULT NOW(),
  updated_at           TIMESTAMPTZ DEFAULT NOW()
);

-- -----------------------------------------------------------------------------
-- 10. INVESTIGATION TABLE
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.dcmms_investigation (
  id                                 TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  investigate_id                     TEXT,
  case_no                            TEXT,
  subject_file_number                TEXT,
  inquiry_no                         TEXT,
  investigation_report_no            TEXT,
  subject                            TEXT,
  target_date                        DATE,
  step_taken                         TEXT,
  date_received_investigation_report DATE,
  investigation_recommendation       TEXT,
  date_report_due                    DATE,
  extension_of_days                  INTEGER DEFAULT 0,
  approval_date                      DATE,
  status                             TEXT DEFAULT 'Scheduled',
  assigned_officer                   TEXT,
  notes                              TEXT,
  created_at                         TIMESTAMPTZ DEFAULT NOW(),
  updated_at                         TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.dcmms_investigation ADD COLUMN IF NOT EXISTS investigate_id TEXT;
ALTER TABLE public.dcmms_investigation ADD COLUMN IF NOT EXISTS case_no TEXT;
ALTER TABLE public.dcmms_investigation ADD COLUMN IF NOT EXISTS subject_file_number TEXT;
ALTER TABLE public.dcmms_investigation ADD COLUMN IF NOT EXISTS inquiry_no TEXT;
ALTER TABLE public.dcmms_investigation ADD COLUMN IF NOT EXISTS investigation_report_no TEXT;
ALTER TABLE public.dcmms_investigation ADD COLUMN IF NOT EXISTS subject TEXT;
ALTER TABLE public.dcmms_investigation ADD COLUMN IF NOT EXISTS target_date DATE;
ALTER TABLE public.dcmms_investigation ADD COLUMN IF NOT EXISTS step_taken TEXT;
ALTER TABLE public.dcmms_investigation ADD COLUMN IF NOT EXISTS date_received_investigation_report DATE;
ALTER TABLE public.dcmms_investigation ADD COLUMN IF NOT EXISTS investigation_recommendation TEXT;
ALTER TABLE public.dcmms_investigation ADD COLUMN IF NOT EXISTS date_report_due DATE;
ALTER TABLE public.dcmms_investigation ADD COLUMN IF NOT EXISTS extension_of_days INTEGER DEFAULT 0;
ALTER TABLE public.dcmms_investigation ADD COLUMN IF NOT EXISTS approval_date DATE;
ALTER TABLE public.dcmms_investigation ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'Scheduled';
ALTER TABLE public.dcmms_investigation ADD COLUMN IF NOT EXISTS assigned_officer TEXT;
ALTER TABLE public.dcmms_investigation ADD COLUMN IF NOT EXISTS notes TEXT;

-- -----------------------------------------------------------------------------
-- 11. INVESTIGATION OFFICERS TABLE
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.dcmms_investigation_officers (
  id               TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  officer_id       TEXT,
  full_name        TEXT,
  name             TEXT,
  nic_no           TEXT,
  nic              TEXT,
  officer_role     TEXT,
  role             TEXT,
  studied_schools  TEXT[],
  school_attended  TEXT[],
  children_schools TEXT[],
  children_school  TEXT[],
  email            TEXT,
  status           TEXT DEFAULT 'Active',
  appointment_date DATE,
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.dcmms_investigation_officers ADD COLUMN IF NOT EXISTS officer_id TEXT;
ALTER TABLE public.dcmms_investigation_officers ADD COLUMN IF NOT EXISTS full_name TEXT;
ALTER TABLE public.dcmms_investigation_officers ADD COLUMN IF NOT EXISTS name TEXT;
ALTER TABLE public.dcmms_investigation_officers ADD COLUMN IF NOT EXISTS nic_no TEXT;
ALTER TABLE public.dcmms_investigation_officers ADD COLUMN IF NOT EXISTS nic TEXT;
ALTER TABLE public.dcmms_investigation_officers ADD COLUMN IF NOT EXISTS officer_role TEXT;
ALTER TABLE public.dcmms_investigation_officers ADD COLUMN IF NOT EXISTS role TEXT;
ALTER TABLE public.dcmms_investigation_officers ADD COLUMN IF NOT EXISTS studied_schools TEXT[];
ALTER TABLE public.dcmms_investigation_officers ADD COLUMN IF NOT EXISTS school_attended TEXT[];
ALTER TABLE public.dcmms_investigation_officers ADD COLUMN IF NOT EXISTS children_schools TEXT[];
ALTER TABLE public.dcmms_investigation_officers ADD COLUMN IF NOT EXISTS children_school TEXT[];
ALTER TABLE public.dcmms_investigation_officers ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE public.dcmms_investigation_officers ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'Active';
ALTER TABLE public.dcmms_investigation_officers ADD COLUMN IF NOT EXISTS appointment_date DATE;

-- -----------------------------------------------------------------------------
-- 12. CALENDAR TABLE
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.dcmms_calendar (
  id          TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  title       TEXT,
  date        DATE,
  event_date  DATE,
  type        TEXT,
  event_type  TEXT,
  description TEXT,
  case_no     TEXT,
  ref_no      TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- -----------------------------------------------------------------------------
-- 13. SESSIONS TABLE
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.dcmms_sessions (
  id          TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id     TEXT,
  username    TEXT,
  email       TEXT,
  login_time  TIMESTAMPTZ DEFAULT NOW(),
  logout_time TIMESTAMPTZ,
  duration    INTEGER,
  status      TEXT DEFAULT 'active',
  ip_address  TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- -----------------------------------------------------------------------------
-- 14. AUDIT LOGS TABLE
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.dcmms_audit_logs (
  id         TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  timestamp  TIMESTAMPTZ DEFAULT NOW(),
  user_id    TEXT,
  username   TEXT,
  email      TEXT,
  action     TEXT NOT NULL,
  details    TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- -----------------------------------------------------------------------------
-- INDEXES FOR FAST SEARCHING
-- -----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_dcmms_daily_mail_ref ON public.dcmms_daily_mail(ref_no);
CREATE INDEX IF NOT EXISTS idx_dcmms_subject_case ON public.dcmms_subject(case_no);
CREATE INDEX IF NOT EXISTS idx_dcmms_subject_det_case ON public.dcmms_subject_details(case_no);
CREATE INDEX IF NOT EXISTS idx_dcmms_subject_asg_case ON public.dcmms_subject_assignments(case_no);
CREATE INDEX IF NOT EXISTS idx_dcmms_sub_mail_case ON public.dcmms_subsequent_mails(case_no);
CREATE INDEX IF NOT EXISTS idx_dcmms_concerned_case ON public.dcmms_concerned_officers(case_no);

-- -----------------------------------------------------------------------------
-- ENABLE ROW LEVEL SECURITY & GRANT PERMISSIONS
-- -----------------------------------------------------------------------------
ALTER TABLE public.dcmms_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dcmms_schools ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dcmms_institutes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dcmms_daily_mail ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dcmms_subject ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dcmms_subject_details ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dcmms_subject_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dcmms_subsequent_mails ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dcmms_concerned_officers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dcmms_preliminary_investigations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dcmms_investigation ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dcmms_investigation_officers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dcmms_calendar ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dcmms_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dcmms_audit_logs ENABLE ROW LEVEL SECURITY;

-- Create ALL permissive policies for API access
DO $$ 
DECLARE
  t TEXT;
BEGIN
  FOR t IN SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name LIKE 'dcmms_%'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS "%s_permissive_select" ON public.%I', t, t);
    EXECUTE format('DROP POLICY IF EXISTS "%s_permissive_all" ON public.%I', t, t);
    EXECUTE format('CREATE POLICY "%s_permissive_select" ON public.%I FOR SELECT USING (true)', t, t);
    EXECUTE format('CREATE POLICY "%s_permissive_all" ON public.%I FOR ALL USING (true) WITH CHECK (true)', t, t);
  END LOOP;
END $$;

GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO anon, authenticated;

-- Reload Schema Cache
NOTIFY pgrst, 'reload schema';
