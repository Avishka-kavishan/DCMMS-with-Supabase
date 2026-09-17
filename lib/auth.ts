export type UserRole =
  | "admin"
  | "daily_mail"
  | "subject_officer"
  | "investigation_officer"
  | "system_admin"
  | "assistant_secretary_discipline"
  | "assistant_secretary_investigation"
  | "senior_assistant_secretary"
  | "additional_secretary";

export interface UserProfile {
  id: string;
  full_name: string;
  role: UserRole;
  raw_role?: string;
  email?: string;
  employee_no?: string;
}

export function normalizeRole(roleStr?: string): UserRole {
  if (!roleStr) return "daily_mail";
  const lower = roleStr.toLowerCase().trim();
  if (lower.includes("system") || lower === "system_admin") return "system_admin";
  
  // Specific secretary & investigation roles
  if (lower.includes("investigation branch") || (lower.includes("assistant secretary") && lower.includes("investigation"))) {
    return "assistant_secretary_investigation";
  }
  if (lower.includes("senior assistant") || lower.includes("senior_assistant_secretary")) {
    return "senior_assistant_secretary";
  }
  if (lower.includes("additional secretary") || lower.includes("additional_secretary")) {
    return "additional_secretary";
  }
  if (
    lower.includes("assistant secretary discipline") || 
    (lower.includes("assistant secretary") && lower.includes("discipline")) ||
    lower.includes("assistant_secretary_discipline")
  ) {
    return "assistant_secretary_discipline";
  }

  // General branch / admin
  if (lower.includes("branch") || lower.includes("administrator") || lower === "admin") return "admin";
  if (lower.includes("subject") || lower === "subject_officer") return "subject_officer";
  if (lower.includes("investigation") || lower === "investigation_officer") return "investigation_officer";
  if (lower.includes("daily") || lower.includes("mail") || lower === "daily_mail") return "daily_mail";
  return "daily_mail";
}

/**
 * Returns the localized display name for a role based on the role string.
 */
export function getRoleDisplayName(
  roleStr?: string,
  t?: any
): string {
  if (!roleStr) {
    return t ? t("roleAdmin", "Discipline Branch Administrator") : "Discipline Branch Administrator";
  }
  const lower = roleStr.toLowerCase().trim();

  // Assistant Secretary Discipline Branch
  if (
    lower.includes("assistant secretary discipline") ||
    (lower.includes("assistant secretary") && lower.includes("discipline")) ||
    lower === "assistant_secretary_discipline"
  ) {
    return t ? t("roleAsstSecDiscipline", "Assistant Secretary Discipline Branch") : "Assistant Secretary Discipline Branch";
  }

  // Assistant Secretary Investigation Branch
  if (
    lower.includes("assistant secretary investigation") ||
    (lower.includes("assistant secretary") && lower.includes("investigation")) ||
    (lower.includes("investigation branch") && lower.includes("assistant")) ||
    lower === "assistant_secretary_investigation"
  ) {
    return t ? t("roleAsstSecInvestigation", "Assistant Secretary Investigation Branch") : "Assistant Secretary Investigation Branch";
  }

  // Senior Assistant Secretary
  if (lower.includes("senior assistant") || lower === "senior_assistant_secretary") {
    return t ? t("roleSnrAsstSec", "Senior Assistant Secretary") : "Senior Assistant Secretary";
  }

  // Additional Secretary
  if (lower.includes("additional secretary") || lower === "additional_secretary") {
    return t ? t("roleAddSec", "Additional Secretary") : "Additional Secretary";
  }

  // System Administrator
  if (lower.includes("system") || lower === "system_admin") {
    return t ? t("sysAdmin", "System Administrator") : "System Administrator";
  }

  // Investigation Administrator / Investigation Officer
  if (lower.includes("investigation")) {
    return t ? t("roleInvestigationAdmin", "Investigation Branch Administrator") : "Investigation Branch Administrator";
  }

  // Subject Officer
  if (lower.includes("subject")) {
    return t ? t("roleSubject", "Subject Officer") : "Subject Officer";
  }

  // Daily Mail Officer / Daily Mail Reporter
  if (lower.includes("daily") || lower.includes("mail")) {
    return t ? t("roleDailyMail", "Daily Mail Officer") : "Daily Mail Officer";
  }

  // Discipline Branch Administrator / Admin
  if (lower.includes("branch") || lower.includes("discipline") || lower.includes("administrator") || lower === "admin") {
    return t ? t("roleAdmin", "Discipline Branch Administrator") : "Discipline Branch Administrator";
  }

  return roleStr;
}

/** Returns the currently signed-in user's profile (id, full_name, role, raw_role, email), or null. */
export async function getCurrentProfile(): Promise<UserProfile | null> {
  if (typeof window === "undefined") return null;

  // 1. Check for active local session
  const simSession = localStorage.getItem("dcmms_simulated_session");
  if (simSession) {
    try {
      const parsed = JSON.parse(simSession);
      if (parsed && (parsed.full_name || parsed.fullName || parsed.role)) {
        return {
          id: parsed.id || "local-user",
          full_name: parsed.full_name || parsed.fullName || "User",
          role: normalizeRole(parsed.role),
          raw_role: parsed.raw_role || parsed.role || "",
          email: parsed.email || "",
          employee_no: parsed.employee_no || "",
        };
      }
    } catch (e) {
      console.error("Failed to parse local session:", e);
    }
  }

  // 2. Check for stored local credentials
  const storedUsername = localStorage.getItem("dcmms_username") || localStorage.getItem("dcmms_current_user");
  const storedRole = localStorage.getItem("dcmms_user_role");

  if (storedUsername) {
    return {
      id: `usr-${storedUsername.toLowerCase().replace(/[^a-z0-9]/g, "_")}`,
      full_name: storedUsername,
      role: normalizeRole(storedRole || "daily_mail"),
      raw_role: storedRole || "",
    };
  }

  return null;
}

/** Returns the dashboard route for the given role. */
export function dashboardPath(role: string): string {
  if (!role) return "/";
  const normalized = normalizeRole(role);
  
  switch (normalized) {
    case "admin":
    case "assistant_secretary_discipline":
    case "senior_assistant_secretary":
    case "additional_secretary":
      return "/admin";
    case "daily_mail":
      return "/daily-mail";
    case "subject_officer":
      return "/subject";
    case "investigation_officer":
    case "assistant_secretary_investigation":
      return "/investigation";
    case "system_admin":
      return "/system-admin";
    default:
      return "/";
  }
}

import { logLogout } from "./security";

/** Sign out and return to login. */
export async function signOut() {
  if (typeof window !== "undefined") {
    try {
      const profile = await getCurrentProfile();
      if (profile?.id) {
        await logLogout(profile.id);
      }
    } catch (e) {
      console.warn("Failed to log logout event:", e);
    }
    localStorage.removeItem("dcmms_simulated_session");
    localStorage.removeItem("dcmms_username");
    localStorage.removeItem("dcmms_user_role");
    localStorage.removeItem("dcmms_current_user");
    localStorage.removeItem("dcmms_current_session_id");
    localStorage.removeItem("dcmms_last_activity");
  }
}


