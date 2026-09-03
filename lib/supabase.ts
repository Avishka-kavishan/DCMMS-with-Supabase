import { logAuditEventServer } from "@/lib/db-actions";

// Supabase is completely disabled — System operates 100% on local PostgreSQL via Prisma
export const isSupabaseConfigured = false;
export const supabaseUrl = "";
export const supabaseAnonKey = "";

if (typeof window !== "undefined") {
  console.log("DCMMS Database Mode: Pure Local PostgreSQL (Supabase Disabled)");
}

/**
 * Lightweight stub maintaining compatibility for components transitioning
 * away from Supabase to pure PostgreSQL Server Actions.
 */
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
    onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
    signInWithPassword: async () => ({ data: { user: null, session: null }, error: null }),
    signUp: async () => ({ data: { user: null, session: null }, error: null }),
  },
  from: () => ({
    select: () => ({
      order: () => Promise.resolve({ data: [], error: null }),
      single: () => Promise.resolve({ data: null, error: null }),
      eq: () => Promise.resolve({ data: [], error: null }),
      or: () => Promise.resolve({ data: [], error: null }),
      catch: () => Promise.resolve({ data: [], error: null }),
    }),
    upsert: () => Promise.resolve({ data: null, error: null }),
    insert: () => Promise.resolve({ data: null, error: null }),
    update: () => ({ eq: () => Promise.resolve({ data: null, error: null }) }),
    delete: () => ({ eq: () => Promise.resolve({ data: null, error: null }) }),
  }),
  channel: () => ({
    on: function () {
      return this;
    },
    subscribe: () => {},
  }),
  removeChannel: () => {},
};

export function subscribeToTables(
  _channelName: string,
  _tables: string[],
  _onChange: () => void
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
    const username =
      performedBy ||
      (typeof window !== "undefined"
        ? localStorage.getItem("dcmms_username") || "system_user"
        : "system_user");
    await logAuditEventServer(action, entityType, entityId, details, username);
  } catch (err) {
    console.warn("Failed to log local audit event:", err);
  }
}

/**
 * Record active session - no-op in pure PostgreSQL mode
 */
export async function recordSession(_userId: string, _role?: string) {
  // Session tracking is managed natively via localStorage & PostgreSQL AuditLog
  return;
}
