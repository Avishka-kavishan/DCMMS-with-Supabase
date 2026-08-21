export type UserRole =
  | "admin"
  | "daily_mail"
  | "subject_officer"
  | "investigation_officer"
  | "system_admin";

export interface UserProfile {
  id: string;
  full_name: string;
  role: UserRole;
  email?: string;
  employee_no?: string;
}

export function normalizeRole(roleStr?: string): UserRole {
  if (!roleStr) return "daily_mail";
  const lower = roleStr.toLowerCase().trim();
  if (lower.includes("system") || lower === "system_admin") return "system_admin";
  if (lower.includes("branch") || lower.includes("administrator") || lower === "admin") return "admin";
  if (lower.includes("subject") || lower === "subject_officer") return "subject_officer";
  if (lower.includes("investigation") || lower === "investigation_officer") return "investigation_officer";
  if (lower.includes("daily") || lower.includes("mail") || lower === "daily_mail") return "daily_mail";
  return "daily_mail";
}

/** Returns the currently signed-in user's profile (id, full_name, role, email), or null. */
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
      return "/admin";
    case "daily_mail":
      return "/daily-mail";
    case "subject_officer":
      return "/subject";
    case "investigation_officer":
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


