-- ─────────────────────────────────────────────────────────────
-- Migration: Update existing case_by_date_extention table schema
-- (Based on your actual table in pgAdmin)
-- ─────────────────────────────────────────────────────────────

-- 1. Add missing approval_status and decision_date columns
ALTER TABLE public.case_by_date_extention 
    ADD COLUMN IF NOT EXISTS approval_status VARCHAR(50) DEFAULT 'Pending',
    ADD COLUMN IF NOT EXISTS decision_date DATE;

-- 2. (Optional) Ensure sub_file_no column exists alongside subject_file_no
ALTER TABLE public.case_by_date_extention 
    ADD COLUMN IF NOT EXISTS sub_file_no VARCHAR(100);

-- Sync sub_file_no with subject_file_no if sub_file_no is used
UPDATE public.case_by_date_extention 
SET sub_file_no = subject_file_no 
WHERE sub_file_no IS NULL AND subject_file_no IS NOT NULL;

-- 3. Set default for approval_status
ALTER TABLE public.case_by_date_extention 
    ALTER COLUMN approval_status SET DEFAULT 'Pending';

