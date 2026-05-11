import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const configuredSiteUrl = import.meta.env.VITE_SITE_URL;

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

function normalizeBaseUrl(url: string) {
  return url.endsWith("/") ? url : `${url}/`;
}

export function getSiteUrl() {
  if (configuredSiteUrl) {
    return normalizeBaseUrl(configuredSiteUrl);
  }
  if (typeof window !== "undefined") {
    return normalizeBaseUrl(window.location.origin);
  }
  return "http://localhost:8080/";
}

export function getOAuthRedirectUrl(nextPath = "/dashboard") {
  const callbackUrl = new URL("/auth/callback", getSiteUrl());
  callbackUrl.searchParams.set("next", nextPath.startsWith("/") ? nextPath : "/dashboard");
  return callbackUrl.toString();
}
