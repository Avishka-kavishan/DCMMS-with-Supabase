-- =============================================================
-- PART 3: DAILY MAIL & LETTERS REGISTRY MODULE
-- Tables: letter_categories, letter_classifications, subject_categories, letters, dcmms_daily_mail
-- =============================================================

-- 1. Letter Categories Table
CREATE TABLE IF NOT EXISTS letter_categories (
    category_id SERIAL PRIMARY KEY,
    category_name VARCHAR(100) NOT NULL
);

-- 2. Letter Classifications Table
CREATE TABLE IF NOT EXISTS letter_classifications (
    classification_id SERIAL PRIMARY KEY,
    classification_name VARCHAR(100) NOT NULL
);

-- 3. Subject Categories Table
CREATE TABLE IF NOT EXISTS subject_categories (
    subject_id SERIAL PRIMARY KEY,
    subject_name VARCHAR(200) NOT NULL,
    description TEXT
);

-- 4. Letters Table
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

-- 5. DCMMS Daily Mail Table (App Compatibility)
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
