-- =============================================================
-- PART 5: INVESTIGATION & OFFICERS MODULE
-- Tables: investigation_officers, investigations, investigation_assignments, provincial_investigations, formal_disciplinary_investigations, dcmms_investigation_officers
-- =============================================================

-- 1. Investigation Officers Table
CREATE TABLE IF NOT EXISTS investigation_officers (
    officer_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    officer_name VARCHAR(150) NOT NULL,
    nic VARCHAR(15),
    designation VARCHAR(150),
    school_attended VARCHAR(200),
    children_school VARCHAR(200),
    appointment_date DATE,
    is_active BOOLEAN DEFAULT TRUE
);

-- 2. Investigations Table
CREATE TABLE IF NOT EXISTS investigations (
    investigation_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    case_id UUID NOT NULL REFERENCES cases(case_id) ON DELETE CASCADE,
    investigation_type VARCHAR(100),
    investigation_no VARCHAR(100),
    assigned_date DATE,
    due_date DATE,
    report_received_date DATE,
    extension_days INT,
    recommendation TEXT,
    approval_date DATE,
    next_action VARCHAR(150),
    status VARCHAR(100) DEFAULT 'Ongoing'
);

-- 3. Investigation Assignments Table
CREATE TABLE IF NOT EXISTS investigation_assignments (
    assignment_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    investigation_id UUID NOT NULL REFERENCES investigations(investigation_id) ON DELETE CASCADE,
    officer_id UUID NOT NULL REFERENCES investigation_officers(officer_id) ON DELETE CASCADE,
    assigned_by UUID REFERENCES users(user_id) ON DELETE SET NULL,
    assigned_date DATE DEFAULT CURRENT_DATE
);

-- 4. Provincial Investigations Table
CREATE TABLE IF NOT EXISTS provincial_investigations (
    provincial_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    investigation_id UUID NOT NULL REFERENCES investigations(investigation_id) ON DELETE CASCADE,
    recommendation TEXT,
    appointment_date DATE,
    due_date DATE,
    report_received_date DATE,
    approved_date DATE,
    next_action VARCHAR(100)
);

-- 5. Formal Disciplinary Investigations Table
CREATE TABLE IF NOT EXISTS formal_disciplinary_investigations (
    formal_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    investigation_id UUID NOT NULL REFERENCES investigations(investigation_id) ON DELETE CASCADE,
    recommendation TEXT,
    report_received_date DATE,
    approved_date DATE,
    disciplinary_order TEXT,
    next_action VARCHAR(100)
);

-- 6. DCMMS Investigation Officers Table (App Compatibility)
CREATE TABLE IF NOT EXISTS dcmms_investigation_officers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    officer_name VARCHAR(150) NOT NULL,
    nic VARCHAR(15),
    designation VARCHAR(150),
    school_attended VARCHAR(200),
    children_school VARCHAR(200),
    appointment_date DATE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 7. Accused Officer to Subject Officer Form Many-to-Many Junction Table
CREATE TABLE IF NOT EXISTS accused_officer_subject_officer_form_table (
    accused_officer_id UUID NOT NULL REFERENCES accused_officer_table(id) ON DELETE CASCADE,
    subject_officer_form_id BIGINT NOT NULL REFERENCES subject_officer_form_table(id) ON DELETE CASCADE,
    PRIMARY KEY (accused_officer_id, subject_officer_form_id)
);

-- 8. Formal Disciplinary Inspection Details Table
CREATE TABLE IF NOT EXISTS formal_disciplinary_inspection_table (
    id BIGSERIAL PRIMARY KEY,
    ref_number VARCHAR(100) NOT NULL UNIQUE REFERENCES subject_officer_form_table(ref_number) ON DELETE CASCADE ON UPDATE CASCADE,
    
    -- Section 2: Investigation Committee Details
    inv_officer_name TEXT,
    inv_officer_designation TEXT,
    inv_officer_appointment_date DATE,
    inv_officer_tel VARCHAR(50),
    inv_officer_address TEXT,

    complaint_officer_name TEXT,
    complaint_officer_designation TEXT,
    complaint_officer_appointment_date DATE,
    complaint_officer_tel VARCHAR(50),
    complaint_officer_address TEXT,

    maintenance_officer_name TEXT,
    maintenance_officer_designation TEXT,
    maintenance_officer_appointment_date DATE,
    maintenance_officer_tel VARCHAR(50),
    maintenance_officer_address TEXT,

    -- Section 3: Disciplinary Investigation Proceedings (Steps 1 to 8)
    date_submission_report DATE,
    recommendation_report TEXT,
    date_submission_rec_approval DATE,
    date_of_approval DATE,
    recommendation_approved VARCHAR(50),
    disciplinary_order TEXT,
    approval_secretary_status VARCHAR(50),
    approval_secretary_details TEXT,
    order_start_date DATE,
    order_end_date DATE,
    other_decisions TEXT,

    -- Legacy & Compatibility columns
    recommendation TEXT,
    discipline_command TEXT,
    granted_approval VARCHAR(100),
    other_decision TEXT,

    -- Audit Timestamps
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_formal_disc_inspection_ref_number ON formal_disciplinary_inspection_table(ref_number);
CREATE INDEX IF NOT EXISTS idx_formal_disc_inspection_date_sub ON formal_disciplinary_inspection_table(date_submission_report);
CREATE INDEX IF NOT EXISTS idx_formal_disc_inspection_rec_app ON formal_disciplinary_inspection_table(recommendation_approved);
CREATE INDEX IF NOT EXISTS idx_formal_disc_inspection_sec_status ON formal_disciplinary_inspection_table(approval_secretary_status);

