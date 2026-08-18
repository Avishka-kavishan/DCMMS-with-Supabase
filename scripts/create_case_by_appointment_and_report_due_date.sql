-- ─────────────────────────────────────────────────────────────
-- Migration: Create case_by_appointment_and_report_due_date table
-- ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.case_by_appointment_and_report_due_date (
  id BIGSERIAL PRIMARY KEY,
  subject_file_no VARCHAR(100),
  sub_file_no VARCHAR(100),
  subject_officer_form_id BIGINT,
  appointment_letter_date DATE,
  report_due_date DATE,
  dates_submitted_by_subject BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_case_by_appt_sub_file ON public.case_by_appointment_and_report_due_date(subject_file_no);
CREATE INDEX IF NOT EXISTS idx_case_by_appt_sub_file_2 ON public.case_by_appointment_and_report_due_date(sub_file_no);
