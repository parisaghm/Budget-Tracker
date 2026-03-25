import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const hasSupabaseEnv = Boolean(supabaseUrl && supabaseAnonKey);
export const supabaseEnvError = hasSupabaseEnv
  ? null
  : "Missing Supabase env vars. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.";

if (!hasSupabaseEnv) {
  console.warn(supabaseEnvError);
}

export const supabase = createClient(
  supabaseUrl ?? "https://placeholder.supabase.co",
  supabaseAnonKey ?? "placeholder-anon-key",
  {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
},
);
