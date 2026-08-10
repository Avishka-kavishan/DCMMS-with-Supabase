-- SQL Script to Drop All DCMMS Tables (Clean Database Reset)
-- Run this in pgAdmin 4 Query Tool or psql to wipe all tables before rebuilding.

DROP TABLE IF EXISTS case_comments CASCADE;
DROP TABLE IF EXISTS case_actions CASCADE;
DROP TABLE IF EXISTS audit_logs CASCADE;
DROP TABLE IF EXISTS notifications CASCADE;
DROP TABLE IF EXISTS documents CASCADE;
DROP TABLE IF EXISTS formal_disciplinary_investigations CASCADE;
DROP TABLE IF EXISTS provincial_investigations CASCADE;
DROP TABLE IF EXISTS investigation_assignments CASCADE;
DROP TABLE IF EXISTS investigation_officers CASCADE;
DROP TABLE IF EXISTS investigations CASCADE;
DROP TABLE IF EXISTS case_status_history CASCADE;
DROP TABLE IF EXISTS case_letters CASCADE;
DROP TABLE IF EXISTS cases CASCADE;
DROP TABLE IF EXISTS case_status CASCADE;
DROP TABLE IF EXISTS letters CASCADE;
DROP TABLE IF EXISTS subject_categories CASCADE;
DROP TABLE IF EXISTS letter_classifications CASCADE;
DROP TABLE IF EXISTS letter_categories CASCADE;
DROP TABLE IF EXISTS persons CASCADE;
DROP TABLE IF EXISTS schools CASCADE;
DROP TABLE IF EXISTS education_zones CASCADE;
DROP TABLE IF EXISTS provinces CASCADE;
DROP TABLE IF EXISTS users CASCADE;
DROP TABLE IF EXISTS roles CASCADE;

-- Legacy & Application Compatibility Tables
DROP TABLE IF EXISTS dcmms_investigation_officers CASCADE;
DROP TABLE IF EXISTS dcmms_profiles CASCADE;
DROP TABLE IF EXISTS dcmms_sessions CASCADE;
DROP TABLE IF EXISTS dcmms_audit_logs CASCADE;
DROP TABLE IF EXISTS dcmms_subject_details CASCADE;
DROP TABLE IF EXISTS dcmms_subject CASCADE;
DROP TABLE IF EXISTS dcmms_daily_mail CASCADE;
DROP TABLE IF EXISTS register_officer_table CASCADE;
