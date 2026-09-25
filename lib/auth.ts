export type UserRole =
  | "admin"
  | "subject_officer"
  | "investigation_officer"
  | "system_admin"
  | "assistant_secretary_discipline"
  | "assistant_secretary_investigation"
  | "senior_assistant_secretary"
  | "additional_secretary"
  | "chief_clerk"
  | "chief_clerk_discipline"
  | "chief_clerk_investigation";

export interface UserProfile {
  id: string;
  full_name: string;
  role: UserRole;
  raw_role?: string;
  email?: string;
  employee_no?: string;
}

export function normalizeRole(roleStr?: string): UserRole {
  if (!roleStr) return "additional_secretary";
  const lower = roleStr.toLowerCase().trim();
  if (lower.includes("system") || lower === "system_admin") return "system_admin";
  
  // Chief Clerk - Investigation Branch (ශාඛා ප්‍රධානී - විමර්ශන අංශය)
  if (
    (lower.includes("chief") || lower.includes("clerk") || lower.includes("clack") || lower.includes("ශාඛා ප්‍රධානී") || lower.includes("ශාඛා ප්රධානී") || lower.includes("chief_clerk")) &&
    (lower.includes("investigation") || lower.includes("විමර්ශන") || lower.includes("inv"))
  ) {
    return "chief_clerk_investigation";
  }

  // Chief Clerk - Discipline Branch (ශාඛා ප්‍රධානී - විනය අංශය)
  if (
    lower.includes("chief") ||
    lower.includes("clerk") ||
    lower.includes("clack") ||
    lower.includes("ශාඛා ප්‍රධානී") ||
    lower.includes("ශාඛා ප්රධානී") ||
    lower === "chief_clerk" ||
    lower === "chief_clerk_discipline"
  ) {
    return "chief_clerk_discipline";
  }

  // Specific secretary & investigation roles
  if (lower.includes("investigation branch") || (lower.includes("assistant secretary") && lower.includes("investigation"))) {
    return "assistant_secretary_investigation";
  }
  if (lower.includes("deputy") || lower.includes("senior assistant") || lower.includes("senior_assistant_secretary") || lower.includes("නියෝජ්‍ය ලේකම්")) {
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
  // Former daily_mail role — map to additional_secretary for backward compatibility
  if (lower.includes("daily") || lower.includes("mail") || lower === "daily_mail") return "additional_secretary";
  return "additional_secretary";
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

  // Chief Clerk - Investigation Branch (ශාඛා ප්‍රධානී - විමර්ශන අංශය)
  if (
    (lower.includes("chief") || lower.includes("clerk") || lower.includes("clack") || lower.includes("ශාඛා ප්‍රධානී") || lower.includes("ශාඛා ප්රධානී") || lower === "chief_clerk_investigation") &&
    (lower.includes("investigation") || lower.includes("විමර්ශන") || lower.includes("inv"))
  ) {
    return t ? t("roleChiefClerkInvestigation", "Chief Clerk - Investigation Branch (ශාඛා ප්‍රධානී - විමර්ශන අංශය)") : "Chief Clerk - Investigation Branch (ශාඛා ප්‍රධානී - විමර්ශන අංශය)";
  }

  // Chief Clerk - Discipline Branch (ශාඛා ප්‍රධානී - විනය අංශය)
  if (
    lower.includes("chief") ||
    lower.includes("clerk") ||
    lower.includes("clack") ||
    lower.includes("ශාඛා ප්‍රධානී") ||
    lower.includes("ශාඛා ප්රධානී") ||
    lower === "chief_clerk" ||
    lower === "chief_clerk_discipline"
  ) {
    return t ? t("roleChiefClerkDiscipline", "Chief Clerk - Discipline Branch (ශාඛා ප්‍රධානී - විනය අංශය)") : "Chief Clerk - Discipline Branch (ශාඛා ප්‍රධානී - විනය අංශය)";
  }

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

  // Deputy Secretary / Senior Assistant Secretary
  if (lower.includes("deputy") || lower.includes("senior assistant") || lower === "senior_assistant_secretary" || lower === "deputy_secretary" || lower.includes("නියෝජ්‍ය ලේකම්")) {
    return t ? t("roleSnrAsstSec", "Deputy Secretary / Senior Assistant Secretary (නියෝජ්‍ය ලේකම්)") : "Deputy Secretary / Senior Assistant Secretary (නියෝජ්‍ය ලේකම්)";
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


  // Discipline Branch Administrator / Admin
  if (lower.includes("branch") || lower.includes("discipline") || lower.includes("administrator") || lower === "admin") {
    return t ? t("roleAdmin", "Discipline Branch Administrator") : "Discipline Branch Administrator";
  }

  return roleStr;
}

/**
 * Returns the dynamic button label for adding letters based on the user's role:
 * - Additional Secretary: "අතිලේ වෙත ලැබෙන ලිපි එක් කරන්න"
 * - Senior Assistant Secretary: "ජෙසලේ වෙත ලැබෙන ලිපි එක් කරන්න"
 * - Assistant Secretary Investigation Branch: "විමර්ශන අංශය වෙත ලැබෙන ලිපි එක් කරන්න"
 * - Assistant Secretary Discipline Branch: "විනය අංශය වෙත ලැබෙන ලිපි එක් කරන්න"
 */
export function getAddLetterButtonLabel(
  roleStr?: string,
  rawRoleStr?: string,
  t?: any
): string {
  const norm = normalizeRole(roleStr || rawRoleStr);
  const rawLower = `${roleStr || ""} ${rawRoleStr || ""}`.toLowerCase();

  // Chief Clerk - Investigation Branch (ශාඛා ප්‍රධානී - විමර්ශන අංශය)
  if (
    norm === "chief_clerk_investigation" ||
    (rawLower.includes("chief") && (rawLower.includes("investigation") || rawLower.includes("විමර්ශන"))) ||
    (rawLower.includes("ශාඛා ප්‍රධානී") && rawLower.includes("විමර්ශන"))
  ) {
    return t
      ? t("addLetterRoleChiefClerkInv", "විමර්ශන ශාඛා ප්‍රධානී වෙත ලැබෙන ලිපි එක් කරන්න")
      : "විමර්ශන ශාඛා ප්‍රධානී වෙත ලැබෙන ලිපි එක් කරන්න";
  }

  // Chief Clerk - Discipline Branch (ශාඛා ප්‍රධානී - විනය අංශය)
  if (
    norm === "chief_clerk" ||
    norm === "chief_clerk_discipline" ||
    rawLower.includes("chief") ||
    rawLower.includes("clerk") ||
    rawLower.includes("clack") ||
    rawLower.includes("ශාඛා ප්‍රධානී") ||
    rawLower.includes("ශාඛා ප්රධානී")
  ) {
    return t
      ? t("addLetterRoleChiefClerkDisc", "විනය ශාඛා ප්‍රධානී වෙත ලැබෙන ලිපි එක් කරන්න")
      : "විනය ශාඛා ප්‍රධානී වෙත ලැබෙන ලිපි එක් කරන්න";
  }

  // 1. Assistant Secretary Investigation Branch
  if (
    norm === "assistant_secretary_investigation" ||
    (rawLower.includes("investigation") && (rawLower.includes("assistant") || rawLower.includes("secretary") || rawLower.includes("branch")))
  ) {
    return t
      ? t("addLetterRoleAsstSecInvestigation", "විමර්ශන අංශය වෙත ලැබෙන ලිපි එක් කරන්න")
      : "විමර්ශන අංශය වෙත ලැබෙන ලිපි එක් කරන්න";
  }
  
  // 2. Deputy Secretary / Senior Assistant Secretary
  if (
    norm === "senior_assistant_secretary" ||
    rawLower.includes("deputy") ||
    rawLower.includes("senior assistant") ||
    rawLower.includes("senior_assistant") ||
    rawLower.includes("නියෝජ්‍ය") ||
    rawLower.includes("ජෙසලේ")
  ) {
    return t
      ? t("addLetterRoleSnrAsstSec", "නියෝජ්‍ය ලේකම් / ජෙසලේ වෙත ලැබෙන ලිපි එක් කරන්න")
      : "නියෝජ්‍ය ලේකම් / ජෙසලේ වෙත ලැබෙන ලිපි එක් කරන්න";
  }

  // 3. Assistant Secretary Discipline Branch
  if (
    norm === "assistant_secretary_discipline" ||
    (rawLower.includes("discipline") && (rawLower.includes("assistant") || rawLower.includes("secretary") || rawLower.includes("branch")))
  ) {
    return t
      ? t("addLetterRoleAsstSecDiscipline", "විනය අංශය වෙත ලැබෙන ලිපි එක් කරන්න")
      : "විනය අංශය වෙත ලැබෙන ලිපි එක් කරන්න";
  }

  // 4. Additional Secretary
  if (
    norm === "additional_secretary" ||
    rawLower.includes("additional") ||
    rawLower.includes("අතිලේ")
  ) {
    return t
      ? t("addLetterRoleAddSec", "අතිලේ වෙත ලැබෙන ලිපි එක් කරන්න")
      : "අතිලේ වෙත ලැබෙන ලිපි එක් කරන්න";
  }

  // Discipline fallback
  if (rawLower.includes("discipline")) {
    return t
      ? t("addLetterRoleAsstSecDiscipline", "විනය අංශය වෙත ලැබෙන ලිපි එක් කරන්න")
      : "විනය අංශය වෙත ලැබෙන ලිපි එක් කරන්න";
  }

  // Default fallback
  return t
    ? t("addLetterRoleAddSec", "අතිලේ වෙත ලැබෙන ලිපි එක් කරන්න")
    : "අතිලේ වෙත ලැබෙන ලිපි එක් කරන්න";
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
      role: normalizeRole(storedRole || "additional_secretary"),
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
    case "chief_clerk":
    case "chief_clerk_discipline":
      return "/admin";
    case "subject_officer":
      return "/subject";
    case "investigation_officer":
    case "assistant_secretary_investigation":
    case "chief_clerk_investigation":
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


