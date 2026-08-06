-- =============================================================================
-- DMMS Updated 18-Table Unified System Database Schema
-- Standardized schema with single 'users' table, roles, schools, persons,
-- letters, cases, case_status, subject_categories, investigations,
-- investigation_officers, investigation_assignments, provincial_investigations,
-- formal_investigations, documents, notifications, audit_logs, workflow_history,
-- and case_letters.
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- -----------------------------------------------------------------------------
-- 1. ROLES TABLE
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.roles (
  role_id   INT PRIMARY KEY,
  role_name VARCHAR(255) NOT NULL UNIQUE
);

INSERT INTO public.roles (role_id, role_name) VALUES
  (1, 'Admin'),
  (2, 'System Administrator'),
  (3, 'Daily Mail Reporter'),
  (4, 'Subject Officer'),
  (5, 'Investigation Branch Administrator')
ON CONFLICT (role_id) DO UPDATE SET role_name = EXCLUDED.role_name;

-- -----------------------------------------------------------------------------
-- 2. USERS TABLE
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.users (
  user_id       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_no   VARCHAR(100),
  full_name     VARCHAR(255) NOT NULL,
  email         VARCHAR(255),
  password_hash TEXT,
  role_id       INT REFERENCES public.roles(role_id),
  is_active     BOOLEAN DEFAULT true,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- -----------------------------------------------------------------------------
-- 3. SCHOOLS TABLE
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.schools (
  school_id   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_no   VARCHAR(100) UNIQUE,
  school_name VARCHAR(255) NOT NULL,
  school_type VARCHAR(100),
  address     TEXT,
  province    VARCHAR(100),
  zone        VARCHAR(100)
);

-- -----------------------------------------------------------------------------
-- 4. PERSONS CONCERNED TABLE
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.persons (
  person_id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nic              VARCHAR(50),
  full_name        VARCHAR(255) NOT NULL,
  dob              DATE,
  address          TEXT,
  appointment_date DATE,
  school_id        UUID REFERENCES public.schools(school_id) ON DELETE SET NULL
);

-- -----------------------------------------------------------------------------
-- 5. CASE STATUS TABLE
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.case_status (
  status_id   INT PRIMARY KEY,
  status_name VARCHAR(100) NOT NULL UNIQUE
);

INSERT INTO public.case_status (status_id, status_name) VALUES
  (1, 'New'),
  (2, 'Assigned'),
  (3, 'Preliminary Investigation'),
  (4, 'Investigation Ongoing'),
  (5, 'Charge Sheet'),
  (6, 'Formal Investigation'),
  (7, 'Closed'),
  (8, 'Court')
ON CONFLICT (status_id) DO UPDATE SET status_name = EXCLUDED.status_name;

-- -----------------------------------------------------------------------------
-- 6. SUBJECT CATEGORIES TABLE
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.subject_categories (
  subject_id   INT PRIMARY KEY,
  subject_name VARCHAR(255) NOT NULL UNIQUE
);

INSERT INTO public.subject_categories (subject_id, subject_name) VALUES
  (1, 'Financial Misconduct'),
  (2, 'Administrative Negligence'),
  (3, 'Behavioral Issue'),
  (4, 'Exam Malpractice'),
  (5, 'General Grievance')
ON CONFLICT (subject_id) DO UPDATE SET subject_name = EXCLUDED.subject_name;

-- -----------------------------------------------------------------------------
-- 7. LETTERS TABLE (NEW MAIL & SUBSEQUENT CASE LETTERS)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.letters (
  letter_id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  serial_number            VARCHAR(100),
  letter_number            VARCHAR(100),
  subject                  TEXT,
  sender_name              VARCHAR(255),
  received_date            DATE,
  submitted_to_branch_date DATE,
  letter_type              VARCHAR(100),
  classification           VARCHAR(100),
  received_method          VARCHAR(100),
  priority                 VARCHAR(50),
  current_case_id          UUID
);

-- -----------------------------------------------------------------------------
-- 8. CASES TABLE
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.cases (
  case_id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_number              VARCHAR(100) UNIQUE NOT NULL,
  subject_officer_id       UUID REFERENCES public.users(user_id) ON DELETE SET NULL,
  school_id                UUID REFERENCES public.schools(school_id) ON DELETE SET NULL,
  person_id                UUID REFERENCES public.persons(person_id) ON DELETE SET NULL,
  letter_id                UUID REFERENCES public.letters(letter_id) ON DELETE SET NULL,
  complaint_classification VARCHAR(100),
  complaint_description    TEXT,
  secretary_approval       BOOLEAN DEFAULT false,
  approval_date            DATE,
  case_status              VARCHAR(100) DEFAULT 'New',
  created_at               TIMESTAMPTZ DEFAULT NOW()
);

-- Add Foreign Key from letters.current_case_id -> cases.case_id
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'fk_letters_current_case'
  ) THEN
    ALTER TABLE public.letters 
      ADD CONSTRAINT fk_letters_current_case 
      FOREIGN KEY (current_case_id) REFERENCES public.cases(case_id) ON DELETE SET NULL;
  END IF;
END $$;

-- -----------------------------------------------------------------------------
-- 9. INVESTIGATIONS TABLE
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.investigations (
  investigation_id     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id              UUID REFERENCES public.cases(case_id) ON DELETE CASCADE,
  investigation_type   VARCHAR(100),
  investigation_no     VARCHAR(100),
  assigned_date        DATE,
  due_date             DATE,
  report_received_date DATE,
  extension_days       INT DEFAULT 0,
  recommendation       TEXT,
  approval_date        DATE,
  next_action          VARCHAR(255),
  status               VARCHAR(100) DEFAULT 'Pending'
);

-- -----------------------------------------------------------------------------
-- 10. INVESTIGATION OFFICERS TABLE
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.investigation_officers (
  officer_id       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  officer_name     VARCHAR(255) NOT NULL,
  nic              VARCHAR(50),
  designation      VARCHAR(100),
  school_attended  VARCHAR(255),
  children_school  VARCHAR(255),
  appointment_date DATE
);

-- -----------------------------------------------------------------------------
-- 11. INVESTIGATION ASSIGNMENTS (JUNCTION TABLE M:N)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.investigation_assignments (
  assignment_id    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  investigation_id UUID REFERENCES public.investigations(investigation_id) ON DELETE CASCADE,
  officer_id       UUID REFERENCES public.investigation_officers(officer_id) ON DELETE CASCADE,
  assigned_date    DATE DEFAULT CURRENT_DATE
);

-- -----------------------------------------------------------------------------
-- 12. PROVINCIAL PRELIMINARY INVESTIGATIONS TABLE
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.provincial_investigations (
  provincial_id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  investigation_id     UUID REFERENCES public.investigations(investigation_id) ON DELETE CASCADE,
  assigned_officers    TEXT,
  appointment_date     DATE,
  due_date             DATE,
  report_received_date DATE,
  recommendation       TEXT,
  approved_date        DATE,
  next_action          VARCHAR(255)
);

-- -----------------------------------------------------------------------------
-- 13. FORMAL DISCIPLINARY INVESTIGATION TABLE
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.formal_investigations (
  formal_id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  investigation_id     UUID REFERENCES public.investigations(investigation_id) ON DELETE CASCADE,
  assigned_officers    TEXT,
  recommendation       TEXT,
  report_received_date DATE,
  approved_date        DATE,
  next_action          VARCHAR(255)
);

-- -----------------------------------------------------------------------------
-- 14. DOCUMENTS TABLE
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.documents (
  document_id   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id       UUID REFERENCES public.cases(case_id) ON DELETE CASCADE,
  uploaded_by   UUID REFERENCES public.users(user_id) ON DELETE SET NULL,
  document_type VARCHAR(100),
  file_name     VARCHAR(255) NOT NULL,
  file_url      TEXT NOT NULL,
  uploaded_at   TIMESTAMPTZ DEFAULT NOW()
);

-- -----------------------------------------------------------------------------
-- 15. NOTIFICATIONS TABLE
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.notifications (
  notification_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID REFERENCES public.users(user_id) ON DELETE CASCADE,
  title           VARCHAR(255) NOT NULL,
  message         TEXT NOT NULL,
  is_read         BOOLEAN DEFAULT false,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- -----------------------------------------------------------------------------
-- 16. AUDIT LOGS TABLE
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.audit_logs (
  audit_id   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID REFERENCES public.users(user_id) ON DELETE SET NULL,
  action     TEXT NOT NULL,
  table_name VARCHAR(100),
  record_id  UUID,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- -----------------------------------------------------------------------------
-- 17. WORKFLOW HISTORY TABLE
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.workflow_history (
  history_id      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id         UUID REFERENCES public.cases(case_id) ON DELETE CASCADE,
  previous_status VARCHAR(100),
  new_status      VARCHAR(100),
  changed_by      UUID REFERENCES public.users(user_id) ON DELETE SET NULL,
  remarks         TEXT,
  changed_at      TIMESTAMPTZ DEFAULT NOW()
);

-- -----------------------------------------------------------------------------
-- 18. CASE-LETTER RELATIONSHIP TABLE (JUNCTION/HISTORY)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.case_letters (
  case_letter_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id        UUID REFERENCES public.cases(case_id) ON DELETE CASCADE,
  letter_id      UUID REFERENCES public.letters(letter_id) ON DELETE CASCADE,
  linked_by      UUID REFERENCES public.users(user_id) ON DELETE SET NULL,
  linked_at      TIMESTAMPTZ DEFAULT NOW()
);
