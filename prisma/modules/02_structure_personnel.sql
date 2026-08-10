-- =============================================================
-- PART 2: INSTITUTIONAL STRUCTURE & PERSONNEL MODULE
-- Tables: provinces, education_zones, schools, persons, dcmms_subject, dcmms_subject_details
-- =============================================================

-- 1. Provinces Table
CREATE TABLE IF NOT EXISTS provinces (
    province_id SERIAL PRIMARY KEY,
    province_name VARCHAR(100) NOT NULL
);

-- 2. Education Zones Table
CREATE TABLE IF NOT EXISTS education_zones (
    zone_id SERIAL PRIMARY KEY,
    province_id INT NOT NULL REFERENCES provinces(province_id) ON DELETE CASCADE,
    zone_name VARCHAR(100) NOT NULL
);

-- 3. Schools Table
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

-- 4. Persons Table (Accused / Subject Personnel)
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

-- 5. DCMMS Subject Table (App Compatibility)
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

-- 6. DCMMS Subject Details Table (App Compatibility)
CREATE TABLE IF NOT EXISTS dcmms_subject_details (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    subject_id VARCHAR(50) NOT NULL,
    charge_details TEXT,
    status VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
