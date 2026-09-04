-- PostgreSQL Master CREATE TABLE Script for DCMMS (Normalized 3NF + Compatibility Schema)
-- Run this in pgAdmin 4 Query Tool or execute the individual scripts in prisma/modules/

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =============================================================
-- PART 1: CORE SYSTEM & AUTHENTICATION MODULE
-- =============================================================
CREATE TABLE IF NOT EXISTS roles (
    role_id SERIAL PRIMARY KEY,
    role_name VARCHAR(100) UNIQUE NOT NULL,
    description TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS users (
    user_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_no VARCHAR(30) UNIQUE,
    full_name VARCHAR(150) NOT NULL,
    email VARCHAR(150) UNIQUE,
    password_hash TEXT,
    role_id INT REFERENCES roles(role_id) ON DELETE SET NULL,
    phone VARCHAR(20),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS dcmms_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username VARCHAR(100) UNIQUE NOT NULL,
    full_name VARCHAR(150),
    role VARCHAR(50) DEFAULT 'User',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS dcmms_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    role VARCHAR(50),
    login_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    is_active BOOLEAN DEFAULT TRUE
);

-- =============================================================
-- PART 2: INSTITUTIONAL STRUCTURE & PERSONNEL MODULE
-- =============================================================
CREATE TABLE IF NOT EXISTS provinces (
    province_id SERIAL PRIMARY KEY,
    province_name VARCHAR(100) NOT NULL
);

CREATE TABLE IF NOT EXISTS education_zones (
    zone_id SERIAL PRIMARY KEY,
    province_id INT NOT NULL REFERENCES provinces(province_id) ON DELETE CASCADE,
    zone_name VARCHAR(100) NOT NULL
);

CREATE TABLE IF NOT EXISTS schools (
    school_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_no VARCHAR(30) UNIQUE,
    school_name VARCHAR(255) NOT NULL,
    school_type VARCHAR(50),
    address TEXT,
    province_id INT REFERENCES provinces(province_id) ON DELETE SET NULL,
    zone_id INT REFERENCES education_zones(zone_id) ON DELETE SET NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS persons (
    person_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nic VARCHAR(15) UNIQUE,
    full_name VARCHAR(150) NOT NULL,
    date_of_birth DATE,
    address TEXT,
    appointment_date DATE,
    school_id UUID REFERENCES schools(school_id) ON DELETE SET NULL,
    designation VARCHAR(150),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS dcmms_subject (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    subject_id VARCHAR(50),
    subject_name VARCHAR(150) NOT NULL,
    designation VARCHAR(100),
    workplace VARCHAR(200),
    nic VARCHAR(15),
    contact_no VARCHAR(20),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS dcmms_subject_details (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    subject_id VARCHAR(50) NOT NULL,
    charge_details TEXT,
    status VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =============================================================
-- PART 3: DAILY MAIL & LETTERS REGISTRY MODULE
-- =============================================================
CREATE TABLE IF NOT EXISTS letter_categories (
    category_id SERIAL PRIMARY KEY,
    category_name VARCHAR(100) NOT NULL
);

CREATE TABLE IF NOT EXISTS letter_classifications (
    classification_id SERIAL PRIMARY KEY,
    classification_name VARCHAR(100) NOT NULL
);

CREATE TABLE IF NOT EXISTS subject_categories (
    subject_id SERIAL PRIMARY KEY,
    subject_name VARCHAR(200) NOT NULL,
    description TEXT
);

CREATE TABLE IF NOT EXISTS letters (
    letter_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    serial_number VARCHAR(50) UNIQUE,
    letter_number VARCHAR(100),
    sender_name VARCHAR(255),
    sender_address TEXT,
    sender_contact VARCHAR(50),
    received_date DATE,
    received_method VARCHAR(50),
    submission_date DATE,
    subject_id INT REFERENCES subject_categories(subject_id) ON DELETE SET NULL,
    category_id INT REFERENCES letter_categories(category_id) ON DELETE SET NULL,
    classification_id INT REFERENCES letter_classifications(classification_id) ON DELETE SET NULL,
    priority VARCHAR(30),
    description TEXT,
    created_by UUID REFERENCES users(user_id) ON DELETE SET NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS dcmms_daily_mail (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    serial_no VARCHAR(50),
    received_date DATE,
    letter_no VARCHAR(100),
    submitted_date DATE,
    subject TEXT,
    sender VARCHAR(255),
    method VARCHAR(50),
    type VARCHAR(50),
    classification VARCHAR(50),
    action_officer VARCHAR(150),
    status VARCHAR(50) DEFAULT 'Pending',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =============================================================
-- PART 4: CASE MANAGEMENT & TRACKING MODULE
-- =============================================================
CREATE TABLE IF NOT EXISTS case_status (
    status_id SERIAL PRIMARY KEY,
    status_name VARCHAR(100) NOT NULL,
    status_description TEXT,
    status_order INT,
    is_active BOOLEAN DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS cases (
    case_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    case_number VARCHAR(50) UNIQUE NOT NULL,
    subject_officer_id UUID,
    school_id UUID REFERENCES schools(school_id) ON DELETE SET NULL,
    person_id UUID REFERENCES persons(person_id) ON DELETE SET NULL,
    current_status_id INT REFERENCES case_status(status_id) ON DELETE SET NULL,
    secretary_approval BOOLEAN DEFAULT FALSE,
    approval_date DATE,
    complaint_summary TEXT,
    created_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS case_letters (
    case_letter_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    case_id UUID NOT NULL REFERENCES cases(case_id) ON DELETE CASCADE,
    letter_id UUID NOT NULL REFERENCES letters(letter_id) ON DELETE CASCADE,
    linked_by UUID REFERENCES users(user_id) ON DELETE SET NULL,
    linked_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS case_status_history (
    history_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    case_id UUID NOT NULL REFERENCES cases(case_id) ON DELETE CASCADE,
    status_id INT NOT NULL REFERENCES case_status(status_id) ON DELETE CASCADE,
    changed_by UUID REFERENCES users(user_id) ON DELETE SET NULL,
    remarks TEXT,
    changed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS case_actions (
    action_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    case_id UUID NOT NULL REFERENCES cases(case_id) ON DELETE CASCADE,
    action_type VARCHAR(100),
    action_description TEXT,
    performed_by UUID REFERENCES users(user_id) ON DELETE SET NULL,
    performed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS case_comments (
    comment_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    case_id UUID NOT NULL REFERENCES cases(case_id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    comment TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =============================================================
-- PART 5: INVESTIGATION & OFFICERS MODULE
-- =============================================================
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

CREATE TABLE IF NOT EXISTS investigation_assignments (
    assignment_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    investigation_id UUID NOT NULL REFERENCES investigations(investigation_id) ON DELETE CASCADE,
    officer_id UUID NOT NULL REFERENCES investigation_officers(officer_id) ON DELETE CASCADE,
    assigned_by UUID REFERENCES users(user_id) ON DELETE SET NULL,
    assigned_date DATE DEFAULT CURRENT_DATE
);

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

CREATE TABLE IF NOT EXISTS formal_disciplinary_investigations (
    formal_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    investigation_id UUID NOT NULL REFERENCES investigations(investigation_id) ON DELETE CASCADE,
    recommendation TEXT,
    report_received_date DATE,
    approved_date DATE,
    disciplinary_order TEXT,
    next_action VARCHAR(100)
);

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

-- Accused Officer to Subject Officer Form Many-to-Many Junction Table
CREATE TABLE IF NOT EXISTS accused_officer_subject_officer_form_table (
    accused_officer_id UUID NOT NULL REFERENCES accused_officer_table(id) ON DELETE CASCADE,
    subject_officer_form_id BIGINT NOT NULL REFERENCES subject_officer_form_table(id) ON DELETE CASCADE,
    PRIMARY KEY (accused_officer_id, subject_officer_form_id)
);

-- Charge Sheet & Disciplinary Order Details Table
CREATE TABLE IF NOT EXISTS charge_sheet_table (
    id BIGSERIAL PRIMARY KEY,
    ref_number VARCHAR(100) NOT NULL UNIQUE REFERENCES subject_officer_form_table(ref_number) ON DELETE CASCADE,
    issued_charge_sheet TEXT,
    date_the_charge_sheet_issued DATE,
    date_the_response_to_the_charge_sheet_was_given DATE,
    disciplinary_order TEXT,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_charge_sheet_ref_number ON charge_sheet_table(ref_number);

-- =============================================================
-- PART 6: SYSTEM AUDIT & DOCUMENTS MODULE
-- =============================================================
CREATE TABLE IF NOT EXISTS documents (
    document_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    case_id UUID REFERENCES cases(case_id) ON DELETE SET NULL,
    investigation_id UUID REFERENCES investigations(investigation_id) ON DELETE SET NULL,
    letter_id UUID REFERENCES letters(letter_id) ON DELETE SET NULL,
    document_type VARCHAR(100),
    file_name VARCHAR(255) NOT NULL,
    file_path TEXT NOT NULL,
    uploaded_by UUID REFERENCES users(user_id) ON DELETE SET NULL,
    uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS notifications (
    notification_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    title VARCHAR(200) NOT NULL,
    message TEXT NOT NULL,
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS audit_logs (
    audit_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(user_id) ON DELETE SET NULL,
    action VARCHAR(255) NOT NULL,
    table_name VARCHAR(100),
    record_id UUID,
    old_value JSONB,
    new_value JSONB,
    ip_address VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS dcmms_audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID,
    action VARCHAR(255) NOT NULL,
    entity_type VARCHAR(100),
    entity_id UUID,
    details TEXT,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =============================================================
-- REGISTER OFFICER TABLE (RECREATING FRESH TABLE & SEED DATA)
-- =============================================================
DROP TABLE IF EXISTS register_officer_table CASCADE;

CREATE TABLE register_officer_table (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_no VARCHAR(50) UNIQUE NOT NULL,
    full_name VARCHAR(150) NOT NULL,
    email VARCHAR(150) UNIQUE NOT NULL,
    password TEXT NOT NULL DEFAULT '123456',
    role VARCHAR(50) DEFAULT 'Register Officer',
    is_active BOOLEAN DEFAULT TRUE,
    created_by UUID REFERENCES register_officer_table(id) ON DELETE SET NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 1. Pre-seeded Admins (System Admin & Branch Admin)
INSERT INTO register_officer_table (employee_no, full_name, email, password, role, is_active, created_by) 
VALUES 
    ('200280401310', 'Nathasha Sathsarani', 'nathashasathsarani209@gmail.com', '123456', 'System admin', TRUE, NULL),
    ('200133702441', 'Avishka Kavishan', 'avishkakavishan13@gmail.com', '123456', 'Branch admin', TRUE, NULL);

-- 2. Officers added by Branch Admin (Avishka Kavishan)
INSERT INTO register_officer_table (employee_no, full_name, email, password, role, is_active, created_by)
VALUES 
    -- Subject Officer added by Branch Admin
    ('200399100111', 'Kamal Perera', 'subject.officer@dcmms.gov.lk', '123456', 'Subject officer', TRUE, 
        (SELECT id FROM register_officer_table WHERE email = 'avishkakavishan13@gmail.com')),
    
    -- Daily Mail Officer added by Branch Admin
    ('200399100222', 'Nimal Silva', 'dailymail.officer@dcmms.gov.lk', '123456', 'Daily mail officer', TRUE, 
        (SELECT id FROM register_officer_table WHERE email = 'avishkakavishan13@gmail.com')),
    
    -- Investigation Officer added by Branch Admin
    ('200399100333', 'Sunil Fernando', 'investigation.officer@dcmms.gov.lk', '123456', 'Investigation officer', TRUE, 
        (SELECT id FROM register_officer_table WHERE email = 'avishkakavishan13@gmail.com'));


