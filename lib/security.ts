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

  // 1. LocalStorage update
  const sessions = getLocalData<UserSession>("dcmms_user_sessions", []);
  
  // Close any existing active sessions for this user first
  sessions.forEach(s => {
    if (s.user_id === userId && s.status === "active") {
      s.status = "logged_out";
      s.logout_time = new Date().toISOString();
      s.duration = Math.round((new Date(s.logout_time).getTime() - new Date(s.login_time).getTime()) / 1000);
    }
  });

  sessions.push(newSession);
  setLocalData("dcmms_user_sessions", sessions);

  // Write login audit log
  await logAuditEvent(userId, username, email, "User Logged In", `User ${username} (${email}) logged in successfully.`);

  // 2. Try Supabase write
  if (isSupabaseConfigured) {
    try {
      await supabase.from("dcmms_user_sessions").insert({
        id: newSession.id,
        user_id: newSession.user_id,
        username: newSession.username,
        email: newSession.email,
        login_time: newSession.login_time,
        status: newSession.status,
        ip_address: newSession.ip_address,
      });
    } catch (e) {
      // Fail silently, fallback is active
    }
  }

  // Keep track of current session id for quick lookup during logout
  if (typeof window !== "undefined") {
    localStorage.setItem("dcmms_current_session_id", newSession.id);
  }

  return newSession;
}

// Log standard user logout
export async function logLogout(userId: string) {
  const currentSessionId = typeof window !== "undefined" ? localStorage.getItem("dcmms_current_session_id") : null;
  const sessions = getLocalData<UserSession>("dcmms_user_sessions", []);
  
  let targetSession = sessions.find(s => s.status === "active" && (currentSessionId ? s.id === currentSessionId : s.user_id === userId));
  
  // If not found by specific id, fall back to any active session for this user
  if (!targetSession) {
    targetSession = sessions.find(s => s.user_id === userId && s.status === "active");
  }

  if (targetSession) {
    targetSession.status = "logged_out";
    targetSession.logout_time = new Date().toISOString();
    targetSession.duration = Math.round((new Date(targetSession.logout_time).getTime() - new Date(targetSession.login_time).getTime()) / 1000);
    
    setLocalData("dcmms_user_sessions", sessions);

    // Audit log
    await logAuditEvent(userId, targetSession.username, targetSession.email, "User Logged Out", `User ${targetSession.username} logged out.`);

    if (isSupabaseConfigured) {
      try {
        await supabase
          .from("dcmms_user_sessions")
          .update({
            status: "logged_out",
            logout_time: targetSession.logout_time,
            duration: targetSession.duration,
          })
          .eq("id", targetSession.id);
      } catch (e) {}
    }
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

  const logs = getLocalData<AuditLog>("dcmms_audit_logs", []);
  logs.push(newAudit);
  setLocalData("dcmms_audit_logs", logs);

  if (isSupabaseConfigured) {
    try {
      await supabase.from("dcmms_audit_logs").insert({
        id: newAudit.id,
        user_id: newAudit.user_id,
        username: newAudit.username,
        email: newAudit.email,
        action: newAudit.action,
        details: newAudit.details,
      });
    } catch (e) {}
  }

  return newAudit;
}

// Fetch active sessions
export function getActiveSessions(): UserSession[] {
  return getLocalData<UserSession>("dcmms_user_sessions", []).filter(s => s.status === "active");
}

// Fetch all session histories
export function getSessionHistory(): UserSession[] {
  return getLocalData<UserSession>("dcmms_user_sessions", []);
}

// Fetch all audit logs
export function getAuditLogs(): AuditLog[] {
  return getLocalData<AuditLog>("dcmms_audit_logs", []).sort((a, b) => b.timestamp.localeCompare(a.timestamp));
}

// Force logout a specific user session
export async function forceLogoutUser(sessionId: string, adminName: string) {
  const sessions = getLocalData<UserSession>("dcmms_user_sessions", []);
  const target = sessions.find(s => s.id === sessionId);
  
  if (target) {
    target.status = "forced_logged_out";
    target.logout_time = new Date().toISOString();
    target.duration = Math.round((new Date(target.logout_time).getTime() - new Date(target.login_time).getTime()) / 1000);
    
    setLocalData("dcmms_user_sessions", sessions);

    // Audit log
    await logAuditEvent(
      target.user_id,
      target.username,
      target.email,
      "Forced Logout",
      `Session ${sessionId} was terminated by System Administrator ${adminName}.`
    );

    if (isSupabaseConfigured) {
      try {
        await supabase
          .from("dcmms_user_sessions")
          .update({
            status: "forced_logged_out",
            logout_time: target.logout_time,
            duration: target.duration,
          })
          .eq("id", sessionId);
      } catch (e) {}
    }
  }
}

// Check if current session for user is forced logged out
export function checkSessionStatus(userId: string): boolean {
  if (typeof window === "undefined") return false;
  const currentSessionId = localStorage.getItem("dcmms_current_session_id");
  if (!currentSessionId) return false;

  const sessions = getLocalData<UserSession>("dcmms_user_sessions", []);
  const current = sessions.find(s => s.id === currentSessionId);
  return current?.status === "forced_logged_out";
}
