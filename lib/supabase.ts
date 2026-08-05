import { createClient } from "@supabase/supabase-js";

export const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
export const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

export const isSupabaseConfigured = !!(
  supabaseUrl &&
  supabaseAnonKey &&
  supabaseUrl !== "your_supabase_project_url" &&
  supabaseAnonKey !== "your_supabase_anon_key"
);

const isBrowser = typeof window !== "undefined";

// During static export (SSG/SSR build), Supabase auth storage must be
// disabled to prevent build-time crashes on GitHub Pages.
export const supabase = createClient(
  isSupabaseConfigured ? supabaseUrl : "https://placeholder-url.supabase.co",
  isSupabaseConfigured ? supabaseAnonKey : "placeholder-key",
  {
    auth: {
      // Only persist session in the browser, not during build
      persistSession: isBrowser,
      // Use localStorage only when available
      storage: isBrowser ? window.localStorage : undefined,
      autoRefreshToken: isBrowser,
      detectSessionInUrl: isBrowser,
    },
  }
);

// Standardized real-time listener subscription helper
export function subscribeToTables(
  channelName: string,
  tables: string[],
  onChange: () => void
) {
  if (!isSupabaseConfigured) return () => {};

  let channel = supabase.channel(channelName);
  tables.forEach((table) => {
    channel = channel.on(
      "postgres_changes",
      { event: "*", schema: "public", table },
      () => {
        onChange();
      }
    );
  });

  channel.subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}

/**
 * Log system audit events directly to dcmms_audit_logs table in Supabase
 */
export async function logAuditEvent(
  action: string,
  entityType?: string,
  entityId?: string,
  details?: Record<string, any>,
  performedBy?: string
) {
  if (!isSupabaseConfigured) return;
  try {
    const username = performedBy || (typeof window !== "undefined" ? localStorage.getItem("dcmms_username") || "system_user" : "system_user");
    await supabase.from("dcmms_audit_logs").insert([
      {
        user_id: username,
        action: action,
        entity_type: entityType || null,
        entity_id: entityId || null,
        details: details ? JSON.stringify(details) : null,
        timestamp: new Date().toISOString()
      }
    ]);
  } catch (err) {
    console.error("Failed to write audit log:", err);
  }
}

/**
 * Record active session to dcmms_sessions table in Supabase
 */
export async function recordSession(userId: string, role?: string) {
  if (!isSupabaseConfigured) return;
  try {
    await supabase.from("dcmms_sessions").insert([
      {
        user_id: userId,
        role: role || "User",
        login_time: new Date().toISOString(),
        is_active: true
      }
    ]);
  } catch (err) {
    console.error("Failed to record session:", err);
  }
}

