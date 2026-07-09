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
