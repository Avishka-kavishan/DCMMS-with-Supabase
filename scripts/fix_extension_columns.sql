-- ─────────────────────────────────────────────────────────────
-- Migration: Add missing extension columns to dcmms_subject_assignments
-- Run this in your Supabase SQL Editor to fix the Extension of Days flow
-- ─────────────────────────────────────────────────────────────

-- Add extension_approval_status column (set by Subject Officer: Approved/Disapproved)
ALTER TABLE public.dcmms_subject_assignments
  ADD COLUMN IF NOT EXISTS extension_approval_status TEXT;

-- Add extension_decision_date column (date Subject Officer made the decision)
ALTER TABLE public.dcmms_subject_assignments
  ADD COLUMN IF NOT EXISTS extension_decision_date DATE;

-- Add extension_requested_by_admin flag (set to TRUE when Investigation Admin sends the request)
ALTER TABLE public.dcmms_subject_assignments
  ADD COLUMN IF NOT EXISTS extension_requested_by_admin BOOLEAN DEFAULT FALSE;

-- Also ensure the after-investigation tracking columns exist
ALTER TABLE public.dcmms_subject_assignments
  ADD COLUMN IF NOT EXISTS after_investigation_sent BOOLEAN DEFAULT FALSE;

ALTER TABLE public.dcmms_subject_assignments
  ADD COLUMN IF NOT EXISTS after_investigation_date DATE;

ALTER TABLE public.dcmms_subject_assignments
  ADD COLUMN IF NOT EXISTS investigation_file_no TEXT;

ALTER TABLE public.dcmms_subject_assignments
  ADD COLUMN IF NOT EXISTS investigation_status TEXT;

ALTER TABLE public.dcmms_subject_assignments
  ADD COLUMN IF NOT EXISTS investigation_notes TEXT;

ALTER TABLE public.dcmms_subject_assignments
  ADD COLUMN IF NOT EXISTS progress_details TEXT;
