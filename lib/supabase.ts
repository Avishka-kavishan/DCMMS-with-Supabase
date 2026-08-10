import { createClient } from "@supabase/supabase-js";
import { logAuditEventServer } from "@/lib/db-actions";

export const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
export const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

// Supabase is completely disabled — System operates 100% on local PostgreSQL
export const isSupabaseConfigured = false;

if (typeof window !== "undefined") {
  console.log("DCMMS Database Mode: Local PostgreSQL (Supabase Disabled)");
}

export const supabase: {
  auth: {
    getSession: () => Promise<{ data: { session: any }; error: any }>;
    signOut: () => Promise<{ error: any }>;
    onAuthStateChange: (callback: any) => { data: { subscription: { unsubscribe: () => void } } };
    signInWithPassword: (credentials: any) => Promise<{ data: any; error: any }>;
    signUp: (credentials: any) => Promise<{ data: any; error: any }>;
  };
  from: (table: string) => any;
  channel: (name: string) => any;
  removeChannel: (channel: any) => void;
} = {
  auth: {
    getSession: async () => ({ data: { session: null }, error: null }),
    signOut: async () => ({ error: null }),
    onAuthStateChange: (callback: any) => ({ data: { subscription: { unsubscribe: () => {} } } }),
    signInWithPassword: async () => ({ data: { user: null, session: null }, error: null }),
    signUp: async () => ({ data: { user: null, session: null }, error: null }),
  },
  from: () => ({
    select: () => ({ order: () => Promise.resolve({ data: [], error: null }), single: () => Promise.resolve({ data: null, error: null }), eq: () => Promise.resolve({ data: [], error: null }), or: () => Promise.resolve({ data: [], error: null }) }),
    upsert: () => Promise.resolve({ data: null, error: null }),
    insert: () => Promise.resolve({ data: null, error: null }),
    update: () => Promise.resolve({ data: null, error: null }),
    delete: () => Promise.resolve({ data: null, error: null }),
  }),
  channel: () => ({
    on: function() { return this; },
    subscribe: () => {},
  }),
  removeChannel: () => {},
};

export function subscribeToTables(
  channelName: string,
  tables: string[],
  onChange: () => void
) {
  return () => {};
}

/**
 * Log system audit events directly to PostgreSQL via Prisma server action
 */
export async function logAuditEvent(
  action: string,
  entityType?: string,
  entityId?: string,
  details?: Record<string, any>,
  performedBy?: string
) {
  try {
    const username = performedBy || (typeof window !== "undefined" ? localStorage.getItem("dcmms_username") || "system_user" : "system_user");
    await logAuditEventServer(action, entityType, entityId, details, username);
  } catch (err) {
    console.warn("Failed to log local audit event:", err);
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

