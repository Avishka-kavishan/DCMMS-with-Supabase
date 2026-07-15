import { supabase, isSupabaseConfigured } from "./supabase";

export interface UserSession {
  id: string;
  user_id: string;
  username: string;
  email: string;
  login_time: string;
  logout_time?: string;
  duration?: number; // in seconds
  status: "active" | "logged_out" | "forced_logged_out";
  ip_address?: string;
}

export interface AuditLog {
  id: string;
  timestamp: string;
  user_id: string | null;
  username: string;
  email: string;
  action: string;
  details: string;
}

const SESSIONS_ROW_ID = "00000000-0000-0000-0000-000000000001";
const AUDIT_LOGS_ROW_ID = "00000000-0000-0000-0000-000000000002";

// Helper to get local data safely
function getLocalData<T>(key: string, defaultValue: T[]): T[] {
  if (typeof window === "undefined") return defaultValue;
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : defaultValue;
  } catch (e) {
    console.error(`Failed to read ${key} from localStorage`, e);
    return defaultValue;
  }
}

// Helper to set local data safely
function setLocalData<T>(key: string, data: T[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(key, JSON.stringify(data));
  } catch (e) {
    console.error(`Failed to write ${key} to localStorage`, e);
  }
}

// Fetch from DB or local storage fallback
async function fetchFromDbOrLocal<T>(rowId: string, localKey: string, defaultValue: T[]): Promise<T[]> {
  if (isSupabaseConfigured) {
    try {
      const { data, error } = await supabase
        .from("dcmms_profiles")
        .select("full_name")
        .eq("id", rowId)
        .single();
      
      if (!error && data?.full_name) {
        return JSON.parse(data.full_name) as T[];
      }
    } catch (e) {
      console.warn("Supabase fetch failed, falling back to local storage:", e);
    }
  }
  return getLocalData<T>(localKey, defaultValue);
}

// Save to DB and local storage fallback
async function saveToDbAndLocal<T>(rowId: string, localKey: string, data: T[]): Promise<void> {
  // Always update local storage first
  setLocalData(localKey, data);

  if (isSupabaseConfigured) {
    try {
      await supabase.from("dcmms_profiles").upsert({
        id: rowId,
        full_name: JSON.stringify(data),
        role: "admin", // satisfying the dcmms_profiles_role_check constraint
      });
    } catch (e) {
      console.warn("Supabase upsert failed:", e);
    }
  }
}

// Log standard user login
export async function logLogin(userId: string, username: string, email: string) {
  const newSession: UserSession = {
    id: `sess-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    user_id: userId,
    username,
    email,
    login_time: new Date().toISOString(),
    status: "active",
    ip_address: "192.168.1." + Math.floor(Math.random() * 254 + 1), // Simulated IP
  };

  const sessions = await fetchFromDbOrLocal<UserSession>(SESSIONS_ROW_ID, "dcmms_user_sessions", []);
  
  // Close any existing active sessions for this user first
  sessions.forEach(s => {
    if (s.user_id === userId && s.status === "active") {
      s.status = "logged_out";
      s.logout_time = new Date().toISOString();
      s.duration = Math.round((new Date(s.logout_time).getTime() - new Date(s.login_time).getTime()) / 1000);
    }
  });

  sessions.push(newSession);
  await saveToDbAndLocal<UserSession>(SESSIONS_ROW_ID, "dcmms_user_sessions", sessions);

  // Write login audit log
  await logAuditEvent(userId, username, email, "User Logged In", `User ${username} (${email}) logged in successfully.`);

  // Keep track of current session id for quick lookup during logout
  if (typeof window !== "undefined") {
    localStorage.setItem("dcmms_current_session_id", newSession.id);
  }

  return newSession;
}

// Log standard user logout
export async function logLogout(userId: string) {
  const currentSessionId = typeof window !== "undefined" ? localStorage.getItem("dcmms_current_session_id") : null;
  const sessions = await fetchFromDbOrLocal<UserSession>(SESSIONS_ROW_ID, "dcmms_user_sessions", []);
  
  let targetSession = sessions.find(s => s.status === "active" && (currentSessionId ? s.id === currentSessionId : s.user_id === userId));
  
  // If not found by specific id, fall back to any active session for this user
  if (!targetSession) {
    targetSession = sessions.find(s => s.user_id === userId && s.status === "active");
  }

  if (targetSession) {
    targetSession.status = "logged_out";
    targetSession.logout_time = new Date().toISOString();
    targetSession.duration = Math.round((new Date(targetSession.logout_time).getTime() - new Date(targetSession.login_time).getTime()) / 1000);
    
    await saveToDbAndLocal<UserSession>(SESSIONS_ROW_ID, "dcmms_user_sessions", sessions);

    // Audit log
    await logAuditEvent(userId, targetSession.username, targetSession.email, "User Logged Out", `User ${targetSession.username} logged out.`);
  }

  if (typeof window !== "undefined") {
    localStorage.removeItem("dcmms_current_session_id");
  }
}

// Log failed login attempt
export async function logFailedLogin(email: string, reason: string) {
  const username = email.split("@")[0] || "Unknown";
  await logAuditEvent(null, username, email, "Failed Login Attempt", `Failed login attempt for email: ${email}. Reason: ${reason}`);
}

// Write to system audit logs
export async function logAuditEvent(userId: string | null, username: string, email: string, action: string, details: string) {
  const newAudit: AuditLog = {
    id: `audit-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    timestamp: new Date().toISOString(),
    user_id: userId,
    username,
    email,
    action,
    details,
  };

  const logs = await fetchFromDbOrLocal<AuditLog>(AUDIT_LOGS_ROW_ID, "dcmms_audit_logs", []);
  logs.push(newAudit);
  await saveToDbAndLocal<AuditLog>(AUDIT_LOGS_ROW_ID, "dcmms_audit_logs", logs);

  return newAudit;
}

// Fetch active sessions
export async function getActiveSessions(): Promise<UserSession[]> {
  const sessions = await fetchFromDbOrLocal<UserSession>(SESSIONS_ROW_ID, "dcmms_user_sessions", []);
  return sessions.filter(s => s.status === "active");
}

// Fetch all session histories
export async function getSessionHistory(): Promise<UserSession[]> {
  return await fetchFromDbOrLocal<UserSession>(SESSIONS_ROW_ID, "dcmms_user_sessions", []);
}

// Fetch all audit logs
export async function getAuditLogs(): Promise<AuditLog[]> {
  const logs = await fetchFromDbOrLocal<AuditLog>(AUDIT_LOGS_ROW_ID, "dcmms_audit_logs", []);
  return logs.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
}

// Force logout a specific user session
export async function forceLogoutUser(sessionId: string, adminName: string) {
  const sessions = await fetchFromDbOrLocal<UserSession>(SESSIONS_ROW_ID, "dcmms_user_sessions", []);
  const target = sessions.find(s => s.id === sessionId);
  
  if (target) {
    target.status = "forced_logged_out";
    target.logout_time = new Date().toISOString();
    target.duration = Math.round((new Date(target.logout_time).getTime() - new Date(target.login_time).getTime()) / 1000);
    
    await saveToDbAndLocal<UserSession>(SESSIONS_ROW_ID, "dcmms_user_sessions", sessions);

    // Audit log
    await logAuditEvent(
      target.user_id,
      target.username,
      target.email,
      "Forced Logout",
      `Session ${sessionId} was terminated by System Administrator ${adminName}.`
    );
  }
}

// Check if current session for user is forced logged out
export async function checkSessionStatus(userId: string): Promise<boolean> {
  if (typeof window === "undefined") return false;
  const currentSessionId = localStorage.getItem("dcmms_current_session_id");
  if (!currentSessionId) return false;

  const sessions = await fetchFromDbOrLocal<UserSession>(SESSIONS_ROW_ID, "dcmms_user_sessions", []);
  const current = sessions.find(s => s.id === currentSessionId);
  return current?.status === "forced_logged_out";
}
