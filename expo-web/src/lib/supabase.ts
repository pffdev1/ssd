import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

export const hasSupabaseEnv = Boolean(supabaseUrl && supabaseAnonKey);
export const supabaseEnvError = hasSupabaseEnv
  ? null
  : "Faltan variables publicas de Supabase (EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY).";

export const supabase = createClient(
  hasSupabaseEnv ? (supabaseUrl as string) : "https://placeholder.supabase.co",
  hasSupabaseEnv
    ? (supabaseAnonKey as string)
    : "placeholder-placeholder-placeholder-placeholder",
  {
    auth: {
      flowType: "pkce",
      detectSessionInUrl: false
    }
  }
);
