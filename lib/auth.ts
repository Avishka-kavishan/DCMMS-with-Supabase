import { supabase } from "./supabase";

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
}

/** Returns the currently signed-in user's profile (id, full_name, role), or null. */
export async function getCurrentProfile(): Promise<UserProfile | null> {
  // Guard: cannot access auth session during static build (no browser)
  if (typeof window === "undefined") return null;

  // Check for active simulated session (offline fallback mode)
  if (typeof window !== "undefined") {
    const simSession = localStorage.getItem("dcmms_simulated_session");
    if (simSession) {
      try {
        return JSON.parse(simSession) as UserProfile;
      } catch (e) {
        console.error("Failed to parse simulated session:", e);
      }
    }
  }

  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.user) return null;

  // 1. Try Supabase dcmms_profiles table
  const { data, error } = await supabase
    .from("dcmms_profiles")
    .select("id, full_name, role")
    .eq("id", session.user.id)
    .single();

  if (!error && data) return data as UserProfile;

  // 2. Fallback & Auto-heal: use auth metadata
  const userMeta = session.user.user_metadata;
  const authFullName = userMeta?.full_name || session.user.email?.split("@")[0] || "User";
  const authRole = (userMeta?.role as UserRole) || "subject_officer";

  // Auto-heal: Insert missing profile row into dcmms_profiles table
  try {
    await supabase.from("dcmms_profiles").upsert({
      id: session.user.id,
      full_name: authFullName,
      email: session.user.email || null,
      role: authRole,
    });
  } catch (err) {
    console.error("Auto-heal profile insertion failed:", err);
  }

  // Check if there's a matching custom profile in localStorage
  if (typeof window !== "undefined") {
    const stored = localStorage.getItem("dcmms_custom_profiles");
    if (stored) {
      try {
        const list = JSON.parse(stored);
        // Match by name (case-insensitive) from auth metadata
        const match = list.find(
          (p: any) =>
            p.fullName?.toLowerCase() === authFullName.toLowerCase() ||
            p.email?.toLowerCase() === session.user.email?.toLowerCase()
        );
        if (match) {
          return {
            id: session.user.id,
            full_name: match.fullName,
            role: match.role as UserRole,
          };
        }
      } catch (e) {
        console.error("Failed to parse dcmms_custom_profiles", e);
      }
    }
  }

  // 3. Last resort: build profile from auth metadata
  return {
    id: session.user.id,
    full_name: authFullName,
    role: authRole,
  };
}

/** Returns the dashboard route for the given role. */
export function dashboardPath(role: UserRole): string {
  switch (role) {
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

/** Sign out and return to home. */
export async function signOut() {
  if (typeof window !== "undefined") {
    localStorage.removeItem("dcmms_simulated_session");
  }
  await supabase.auth.signOut();
}
