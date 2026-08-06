/**
 * DMMS Standard 18-Table Unified System Database Schema
 * TypeScript definitions and object models
 */

export interface Role {
  role_id: number;
  role_name: 'Admin' | 'System Administrator' | 'Daily Mail Reporter' | 'Subject Officer' | 'Investigation Branch Administrator' | string;
}

export interface User {
  user_id: string;
  employee_no?: string;
  full_name: string;
  email?: string;
  password_hash?: string;
  role_id?: number;
  is_active?: boolean;
  created_at?: string;
}

export interface School {
  school_id: string;
  school_no?: string;
  school_name: string;
  school_type?: string;
  address?: string;
  province?: string;
  zone?: string;
}

export interface Person {
  person_id: string;
  nic?: string;
  full_name: string;
  dob?: string;
  address?: string;
  appointment_date?: string;
  school_id?: string;
}

export interface Letter {
  letter_id: string;
  serial_number?: string;
  letter_number?: string;
  subject?: string;
  sender_name?: string;
  received_date?: string;
  submitted_to_branch_date?: string;
  letter_type?: string;
  classification?: string;
  received_method?: string;
  priority?: string;
  current_case_id?: string | null;
}

export interface Case {
  case_id: string;
  case_number: string;
  subject_officer_id?: string;
  school_id?: string;
  person_id?: string;
  letter_id?: string;
  complaint_classification?: string;
  complaint_description?: string;
  secretary_approval?: boolean;
  approval_date?: string;
  case_status?: string;
  created_at?: string;
}

export interface CaseStatus {
  status_id: number;
  status_name: 'New' | 'Assigned' | 'Preliminary Investigation' | 'Investigation Ongoing' | 'Charge Sheet' | 'Formal Investigation' | 'Closed' | 'Court' | string;
}

export interface SubjectCategory {
  subject_id: number;
  subject_name: string;
}

export interface Investigation {
  investigation_id: string;
  case_id: string;
  investigation_type?: string;
  investigation_no?: string;
  assigned_date?: string;
  due_date?: string;
  report_received_date?: string;
  extension_days?: number;
  recommendation?: string;
  approval_date?: string;
  next_action?: string;
  status?: string;
}

export interface InvestigationOfficer {
  officer_id: string;
  officer_name: string;
  nic?: string;
  designation?: string;
  school_attended?: string;
  children_school?: string;
  appointment_date?: string;
}

export interface InvestigationAssignment {
  assignment_id: string;
  investigation_id: string;
  officer_id: string;
  assigned_date?: string;
}

export interface ProvincialInvestigation {
  provincial_id: string;
  investigation_id: string;
  assigned_officers?: string;
  appointment_date?: string;
  due_date?: string;
  report_received_date?: string;
  recommendation?: string;
  approved_date?: string;
  next_action?: string;
}

export interface FormalInvestigation {
  formal_id: string;
  investigation_id: string;
  assigned_officers?: string;
  recommendation?: string;
  report_received_date?: string;
  approved_date?: string;
  next_action?: string;
}

export interface Document {
  document_id: string;
  case_id: string;
  uploaded_by?: string;
  document_type?: string;
  file_name: string;
  file_url: string;
  uploaded_at?: string;
}

export interface Notification {
  notification_id: string;
  user_id: string;
  title: string;
  message: string;
  is_read?: boolean;
  created_at?: string;
}

export interface AuditLog {
  audit_id: string;
  user_id?: string;
  action: string;
  table_name?: string;
  record_id?: string;
  created_at?: string;
}

export interface WorkflowHistory {
  history_id: string;
  case_id: string;
  previous_status?: string;
  new_status?: string;
  changed_by?: string;
  remarks?: string;
  changed_at?: string;
}

export interface CaseLetter {
  case_letter_id: string;
  case_id: string;
  letter_id: string;
  linked_by?: string;
  linked_at?: string;
}

/** Predefined Standard Role Mapping */
export const ROLE_MAP: Record<number, string> = {
  1: 'Admin',
  2: 'System Administrator',
  3: 'Daily Mail Reporter',
  4: 'Subject Officer',
  5: 'Investigation Branch Administrator',
};

/** Predefined Case Status Mapping */
export const CASE_STATUS_MAP: Record<number, string> = {
  1: 'New',
  2: 'Assigned',
  3: 'Preliminary Investigation',
  4: 'Investigation Ongoing',
  5: 'Charge Sheet',
  6: 'Formal Investigation',
  7: 'Closed',
  8: 'Court',
};
