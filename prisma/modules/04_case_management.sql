-- =============================================================
-- PART 4: CASE MANAGEMENT & TRACKING MODULE
-- Tables: case_status, cases, case_letters, case_status_history, case_actions, case_comments
-- =============================================================

-- 1. Case Status Table
CREATE TABLE IF NOT EXISTS case_status (
    status_id SERIAL PRIMARY KEY,
    status_name VARCHAR(100) NOT NULL,
    status_description TEXT,
    status_order INT,
    is_active BOOLEAN DEFAULT TRUE
);

-- 2. Cases Table
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

-- 3. Case Letters Table
CREATE TABLE IF NOT EXISTS case_letters (
    case_letter_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    case_id UUID NOT NULL REFERENCES cases(case_id) ON DELETE CASCADE,
    letter_id UUID NOT NULL REFERENCES letters(letter_id) ON DELETE CASCADE,
    linked_by UUID REFERENCES users(user_id) ON DELETE SET NULL,
    linked_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 4. Case Status History Table
CREATE TABLE IF NOT EXISTS case_status_history (
    history_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    case_id UUID NOT NULL REFERENCES cases(case_id) ON DELETE CASCADE,
    status_id INT NOT NULL REFERENCES case_status(status_id) ON DELETE CASCADE,
    changed_by UUID REFERENCES users(user_id) ON DELETE SET NULL,
    remarks TEXT,
    changed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 5. Case Actions Table
CREATE TABLE IF NOT EXISTS case_actions (
    action_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    case_id UUID NOT NULL REFERENCES cases(case_id) ON DELETE CASCADE,
    action_type VARCHAR(100),
    action_description TEXT,
    performed_by UUID REFERENCES users(user_id) ON DELETE SET NULL,
    performed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 6. Case Comments Table
CREATE TABLE IF NOT EXISTS case_comments (
    comment_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    case_id UUID NOT NULL REFERENCES cases(case_id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    comment TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
