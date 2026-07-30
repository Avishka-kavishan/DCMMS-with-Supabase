-- =============================================================================
-- DMMS Combined Database Schema & Migration Script
-- Based on ER Diagram & Preliminary Investigation Process Architecture
-- Run this in Supabase SQL Editor (Dashboard -> SQL Editor)
-- =============================================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- -----------------------------------------------------------------------------
-- 1. STAFF PROFILES & USERS TABLE (Admin, Investigation Admin, Daily Mail Reporter, Subject Officer)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.dcmms_profiles (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name    TEXT NOT NULL,
  salary_no    TEXT UNIQUE,
  email        TEXT UNIQUE NOT NULL,
  password     TEXT,
  role         TEXT NOT NULL CHECK (role IN ('admin', 'investigation_administrator', 'daily_mail_reporter', 'subject_officer')),
  status       TEXT DEFAULT 'Active' CHECK (status IN ('Active', 'Inactive')),
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_at   TIMESTAMPTZ DEFAULT NOW()
);

-- -----------------------------------------------------------------------------
-- 2. SCHOOL TABLE
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

-- -----------------------------------------------------------------------------
-- 3. NEW MAIL (DAILY MAIL) TABLE
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.dcmms_new_mail (
  serial_number                          TEXT PRIMARY KEY,
  letter_number                          TEXT,
  name_of_subject_officer                TEXT,
  party_to_whom_sent                     TEXT,
  nature_of_letter                       TEXT,
  date_of_receipt_add_sec                DATE,
  date_of_submission_disc_branch         DATE,
  subject_topic                          TEXT,
  classification_of_letter               TEXT,
  manner_of_receipt                      TEXT,
  priority                               TEXT CHECK (priority IN ('Today', 'in 3 Days', 'in 14/21 Days', 'high', 'medium', 'low')),
  reporter_email                         TEXT,
  created_at                             TIMESTAMPTZ DEFAULT NOW()
);

-- -----------------------------------------------------------------------------
-- 4. SUBJECT OFFICER'S CASES TABLE
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.dcmms_subject_cases (
  subject_file_number                    TEXT PRIMARY KEY,
  school_no                              TEXT REFERENCES public.dcmms_schools(school_no) ON DELETE SET NULL,
  subject_officer_id                     UUID REFERENCES public.dcmms_profiles(id) ON DELETE SET NULL,
  subject_officer_name                   TEXT,
  name_of_person_submitting_complaint    TEXT,
  address_of_person_submitting_complaint TEXT,
  matter_related_to_complaint            TEXT,
  complaint_letter_classification        TEXT,
  approval_of_secretary_of_education     BOOLEAN DEFAULT FALSE,
  approval_date                          DATE,
  date_prep_submission_signature         DATE,
  status                                 TEXT DEFAULT 'In Progress',
  created_at                             TIMESTAMPTZ DEFAULT NOW(),
  updated_at                             TIMESTAMPTZ DEFAULT NOW()
);

-- -----------------------------------------------------------------------------
-- 5. NEW MAIL FOR CURRENT CASE (SUBSEQUENT MAILS) TABLE
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.dcmms_subsequent_mails (
  id                                     TEXT PRIMARY KEY,
  serial_number                          TEXT,
  subject_file_number                    TEXT REFERENCES public.dcmms_subject_cases(subject_file_number) ON DELETE CASCADE,
  letter_number                          TEXT,
  party_to_whom_sent                     TEXT,
  nature_of_letter                       TEXT,
  date_of_receipt_add_sec                DATE,
  date_of_submission_disc_branch         DATE,
  subject_topic                          TEXT,
  classification_of_letter               TEXT,
  manner_of_receipt                      TEXT,
  priority                               TEXT CHECK (priority IN ('Today', 'in 3 Days', 'in 14/21 Days', 'high', 'medium', 'low')),
  created_at                             TIMESTAMPTZ DEFAULT NOW()
);

-- -----------------------------------------------------------------------------
-- 6. PERSON CONCERNED BY THE COMPLAINT TABLE (Accused Officers)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.dcmms_concerned_officers (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_file_number  TEXT REFERENCES public.dcmms_subject_cases(subject_file_number) ON DELETE CASCADE,
  nic                  TEXT NOT NULL,
  name                 TEXT NOT NULL,
  address              TEXT,
  date_of_birth        DATE,
  date_of_appointment  DATE,
  position             TEXT,
  created_at           TIMESTAMPTZ DEFAULT NOW()
);

-- -----------------------------------------------------------------------------
-- 7. PRELIMINARY INVESTIGATION TABLE (7 Stages, 12 Steps)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.dcmms_preliminary_investigations (
  id                                     TEXT PRIMARY KEY,
  case_no                                TEXT REFERENCES public.dcmms_subject_cases(subject_file_number) ON DELETE CASCADE,
  reason                                 TEXT,
  committee_members                      JSONB,
  appointment_date                       DATE,
  report_due_date                        DATE,
  report_received_date                   DATE,
  findings                               TEXT,
  observations                           TEXT,
  recommendations                        TEXT,
  next_action                            TEXT CHECK (next_action IN ('no_further_action', 'formal_investigation', 'additional_clarification', 'other_disciplinary')),
  status                                 TEXT DEFAULT 'Initiated',
  created_at                             TIMESTAMPTZ DEFAULT NOW(),
  updated_at                             TIMESTAMPTZ DEFAULT NOW()
);

-- -----------------------------------------------------------------------------
-- 8. CASE INVESTIGATE TABLE (Investigation Process & Reports)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.dcmms_case_investigate (
  investigate_id                         TEXT PRIMARY KEY,
  subject_file_number                    TEXT REFERENCES public.dcmms_subject_cases(subject_file_number) ON DELETE CASCADE,
  investigation_report_no                TEXT,
  step_taken                             TEXT,
  date_received_investigation_report     DATE,
  investigation_recommendation           TEXT,
  date_report_due                        DATE,
  extension_of_days                      INTEGER DEFAULT 0,
  approval_date                          DATE,
  status                                 TEXT DEFAULT 'Step 1: Officers Assigned',
  created_at                             TIMESTAMPTZ DEFAULT NOW(),
  updated_at                             TIMESTAMPTZ DEFAULT NOW()
);

-- -----------------------------------------------------------------------------
-- 9. INVESTIGATE OFFICER TABLE (Committee Chairman & Members)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.dcmms_investigation_officers (
  officer_id           TEXT PRIMARY KEY,
  investigate_id       TEXT REFERENCES public.dcmms_case_investigate(investigate_id) ON DELETE SET NULL,
  nic                  TEXT,
  name                 TEXT NOT NULL,
  role                 TEXT CHECK (role IN ('Chairman', 'Member')),
  school_attended      TEXT[],
  children_school      TEXT[],
  appointment_date     DATE,
  email                TEXT,
  status               TEXT DEFAULT 'Active',
  created_at           TIMESTAMPTZ DEFAULT NOW()
);

-- -----------------------------------------------------------------------------
-- INDEXES FOR OPTIMAL QUERY PERFORMANCE
-- -----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_sub_mails_case ON public.dcmms_subsequent_mails(subject_file_number);
CREATE INDEX IF NOT EXISTS idx_concerned_case ON public.dcmms_concerned_officers(subject_file_number);
CREATE INDEX IF NOT EXISTS idx_prelim_case ON public.dcmms_preliminary_investigations(case_no);
CREATE INDEX IF NOT EXISTS idx_case_inv_file  ON public.dcmms_case_investigate(subject_file_number);
CREATE INDEX IF NOT EXISTS idx_inv_officer_inv ON public.dcmms_investigation_officers(investigate_id);

-- -----------------------------------------------------------------------------
-- ENABLE ROW LEVEL SECURITY & GRANT PERMISSIONS
-- -----------------------------------------------------------------------------
ALTER TABLE public.dcmms_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dcmms_schools ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dcmms_new_mail ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dcmms_subject_cases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dcmms_subsequent_mails ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dcmms_concerned_officers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dcmms_preliminary_investigations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dcmms_case_investigate ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dcmms_investigation_officers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read access" ON public.dcmms_profiles FOR SELECT USING (true);
CREATE POLICY "Allow public read access" ON public.dcmms_schools FOR SELECT USING (true);
CREATE POLICY "Allow public read access" ON public.dcmms_new_mail FOR SELECT USING (true);
CREATE POLICY "Allow public read access" ON public.dcmms_subject_cases FOR SELECT USING (true);
CREATE POLICY "Allow public read access" ON public.dcmms_subsequent_mails FOR SELECT USING (true);
CREATE POLICY "Allow public read access" ON public.dcmms_concerned_officers FOR SELECT USING (true);
CREATE POLICY "Allow public read access" ON public.dcmms_preliminary_investigations FOR SELECT USING (true);
CREATE POLICY "Allow public read access" ON public.dcmms_case_investigate FOR SELECT USING (true);
CREATE POLICY "Allow public read access" ON public.dcmms_investigation_officers FOR SELECT USING (true);

CREATE POLICY "Allow all write access" ON public.dcmms_profiles FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all write access" ON public.dcmms_schools FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all write access" ON public.dcmms_new_mail FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all write access" ON public.dcmms_subject_cases FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all write access" ON public.dcmms_subsequent_mails FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all write access" ON public.dcmms_concerned_officers FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all write access" ON public.dcmms_preliminary_investigations FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all write access" ON public.dcmms_case_investigate FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all write access" ON public.dcmms_investigation_officers FOR ALL USING (true) WITH CHECK (true);

GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO anon, authenticated;

NOTIFY pgrst, 'reload schema';
