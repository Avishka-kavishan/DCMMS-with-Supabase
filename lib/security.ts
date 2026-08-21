import { supabase, isSupabaseConfigured } from "./supabase";
import {
  recordSessionLoginServer,
  recordSessionLogoutServer,
  forceLogoutSessionServer,
  checkSessionStatusServer,
  getActiveSessionsServer,
  getSessionHistoryServer,
  recordAuditLogServer,
  getAuditLogsServer,
} from "./db-actions";

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

const SESSIONS_REF = "__SECURITY_SESSIONS_DATA__";
const AUDIT_LOGS_REF = "__SECURITY_AUDIT_LOGS_DATA__";

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

// Fetch Active Sessions
export async function getActiveSessions(): Promise<UserSession[]> {
  try {
    const res = await getActiveSessionsServer();
    if (res.success && res.data && res.data.length > 0) {
      return res.data;
    }
  } catch (e) {
    console.warn("PostgreSQL getActiveSessionsServer failed, falling back:", e);
  }

  if (isSupabaseConfigured) {
    try {
      const { data, error } = await supabase
        .from("dcmms_sessions")
        .select("*")
        .eq("status", "active");

      if (!error && data) {
        return data.map((s: any) => ({
          id: s.id,
          user_id: s.user_id || "",
          username: s.username || s.user_id || "User",
          email: s.email || `${s.user_id}@moe.gov.lk`,
          login_time: s.login_time || new Date().toISOString(),
          status: s.status || "active",
          ip_address: s.ip_address || "127.0.0.1"
        }));
      }
    } catch (e) {
      console.warn("Supabase fetch active sessions failed:", e);
    }
  }

  const local = getLocalData<UserSession>(SESSIONS_REF, []);
  return local.filter(s => s.status === "active");
}

// Fetch Session History
export async function getSessionHistory(): Promise<UserSession[]> {
  try {
    const res = await getSessionHistoryServer();
    if (res.success && res.data && res.data.length > 0) {
      return res.data;
    }
  } catch (e) {
    console.warn("PostgreSQL getSessionHistoryServer failed, falling back:", e);
  }

  if (isSupabaseConfigured) {
    try {
      const { data, error } = await supabase
        .from("dcmms_sessions")
        .select("*")
        .order("login_time", { ascending: false });

      if (!error && data) {
        return data.map((s: any) => ({
          id: s.id,
          user_id: s.user_id || "",
          username: s.username || s.user_id || "User",
          email: s.email || `${s.user_id}@moe.gov.lk`,
          login_time: s.login_time || new Date().toISOString(),
          logout_time: s.logout_time,
          duration: s.duration,
          status: s.status || "logged_out",
          ip_address: s.ip_address || "127.0.0.1"
        }));
      }
    } catch (e) {
      console.warn("Supabase fetch session history failed:", e);
    }
  }

  return getLocalData<UserSession>(SESSIONS_REF, []);
}

// Fetch Audit Logs
export async function getAuditLogs(): Promise<AuditLog[]> {
  try {
    const res = await getAuditLogsServer();
    if (res.success && res.data && res.data.length > 0) {
      return res.data;
    }
  } catch (e) {
    console.warn("PostgreSQL getAuditLogsServer failed, falling back:", e);
  }

  if (isSupabaseConfigured) {
    try {
      const { data, error } = await supabase
        .from("dcmms_audit_logs")
        .select("*")
        .order("timestamp", { ascending: false });

      if (!error && data) {
        return data.map((a: any) => {
          let detailsText = a.details || "";
          if (typeof detailsText === "object") {
            try {
              detailsText = JSON.stringify(detailsText);
            } catch (e) {}
          }
          return {
            id: a.id || `audit-${Date.now()}`,
            timestamp: a.timestamp || new Date().toISOString(),
            user_id: a.user_id || null,
            username: a.user_id || a.username || "System",
            email: a.email || `${a.user_id || "system"}@moe.gov.lk`,
            action: a.action || "System Event",
            details: detailsText
          };
        });
      }
    } catch (e) {
      console.warn("Supabase fetch audit logs failed:", e);
    }
  }

  const logs = getLocalData<AuditLog>(AUDIT_LOGS_REF, []);
  return logs.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
}

// Log standard user login
export async function logLogin(userId: string, username: string, email: string) {
  const newSession: UserSession = {
    id: `sess-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`,
    user_id: userId,
    username,
    email,
    login_time: new Date().toISOString(),
    status: "active",
    ip_address: "192.168.1." + Math.floor(Math.random() * 254 + 1),
  };

  // 1. PostgreSQL Direct Server Action
  try {
    await recordSessionLoginServer({
      id: newSession.id,
      user_id: userId,
      username,
      email,
      login_time: newSession.login_time,
      ip_address: newSession.ip_address,
    });
  } catch (e) {
    console.warn("PostgreSQL session insert failed:", e);
  }

  // 2. Supabase fallback if configured
  if (isSupabaseConfigured) {
    try {
      await supabase.from("dcmms_sessions").insert({
        id: newSession.id,
        user_id: userId,
        username,
        email,
        login_time: newSession.login_time,
        status: "active",
        ip_address: newSession.ip_address,
      });
    } catch (e) {
      console.warn("Supabase insert session failed:", e);
    }
  }

  // 3. Backup to localStorage
  const local = getLocalData<UserSession>(SESSIONS_REF, []);
  local.push(newSession);
  setLocalData(SESSIONS_REF, local);

  // 4. Write login audit log
  await logAuditEvent(userId, username, email, "User Logged In", `User ${username} (${email}) logged in successfully.`);

  if (typeof window !== "undefined") {
    localStorage.setItem("dcmms_current_session_id", newSession.id);
  }

  return newSession;
}

// Log standard user logout
export async function logLogout(userId: string) {
  const currentSessionId = typeof window !== "undefined" ? localStorage.getItem("dcmms_current_session_id") : null;
  const now = new Date().toISOString();

  // 1. Calculate duration from local backup or session ID
  const local = getLocalData<UserSession>(SESSIONS_REF, []);
  const target = local.find(s => s.status === "active" && (currentSessionId ? s.id === currentSessionId : s.user_id === userId));
  let duration: number | undefined;
  if (target) {
    target.status = "logged_out";
    target.logout_time = now;
    duration = Math.round((new Date(now).getTime() - new Date(target.login_time).getTime()) / 1000);
    target.duration = duration;
    setLocalData(SESSIONS_REF, local);
  }

  // 2. PostgreSQL Direct Server Action
  try {
    await recordSessionLogoutServer(currentSessionId, userId, now, duration);
  } catch (e) {
    console.warn("PostgreSQL session logout update failed:", e);
  }

  // 3. Supabase fallback if configured
  if (isSupabaseConfigured) {
    try {
      let query = supabase.from("dcmms_sessions").update({
        status: "logged_out",
        logout_time: now,
        duration: duration || null,
      });
      if (currentSessionId) {
        query = query.eq("id", currentSessionId);
      } else {
        query = query.eq("user_id", userId).eq("status", "active");
      }
      await query;
    } catch (e) {
      console.warn("Supabase logout session update failed:", e);
    }
  }

  // 4. Audit Log
  const name = target?.username || userId;
  const userEmail = target?.email || `${userId}@moe.gov.lk`;
  await logAuditEvent(userId, name, userEmail, "User Logged Out", `User ${name} logged out.`);

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
    id: `audit-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`,
    timestamp: new Date().toISOString(),
    user_id: userId,
    username,
    email,
    action,
    details,
  };

  // 1. PostgreSQL Server Action
  try {
    await recordAuditLogServer(newAudit);
  } catch (e) {
    console.warn("PostgreSQL audit log failed:", e);
  }

  // 2. Supabase fallback if configured
  if (isSupabaseConfigured) {
    try {
      await supabase.from("dcmms_audit_logs").insert({
        id: newAudit.id,
        user_id: userId || username,
        username,
        email,
        action,
        details,
        timestamp: newAudit.timestamp
      });
    } catch (e) {
      console.warn("Supabase insert audit log failed:", e);
    }
  }

  // 3. LocalStorage backup
  const logs = getLocalData<AuditLog>(AUDIT_LOGS_REF, []);
  logs.push(newAudit);
  setLocalData(AUDIT_LOGS_REF, logs);

  return newAudit;
}

// Force logout a specific user session
export async function forceLogoutUser(sessionId: string, adminName: string) {
  const now = new Date().toISOString();

  // 1. PostgreSQL Server Action
  try {
    await forceLogoutSessionServer(sessionId, adminName);
  } catch (e) {
    console.warn("PostgreSQL force logout failed:", e);
  }

  // 2. Supabase fallback
  if (isSupabaseConfigured) {
    try {
      await supabase
        .from("dcmms_sessions")
        .update({
          status: "forced_logged_out",
          logout_time: now,
        })
        .eq("id", sessionId);
    } catch (e) {
      console.warn("Supabase force logout session update failed:", e);
    }
  }

  // 3. Local Storage backup
  const local = getLocalData<UserSession>(SESSIONS_REF, []);
  const target = local.find(s => s.id === sessionId);
  if (target) {
    target.status = "forced_logged_out";
    target.logout_time = now;
    target.duration = Math.round((new Date(now).getTime() - new Date(target.login_time).getTime()) / 1000);
    setLocalData(SESSIONS_REF, local);

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

  // 1. PostgreSQL Server Action Check
  try {
    const res = await checkSessionStatusServer(currentSessionId);
    if (res.success && res.isForced) {
      return true;
    }
  } catch (e) {}

  // 2. Supabase check
  if (isSupabaseConfigured) {
    try {
      const { data, error } = await supabase
        .from("dcmms_sessions")
        .select("status")
        .eq("id", currentSessionId)
        .single();

      if (!error && data) {
        return data.status === "forced_logged_out";
      }
    } catch (e) {}
  }

  // 3. Local Storage backup check
  const local = getLocalData<UserSession>(SESSIONS_REF, []);
  const current = local.find(s => s.id === currentSessionId);
  return current?.status === "forced_logged_out";
}
