import { createClient } from "@supabase/supabase-js";

function requiredEnv(name: string) {
  const value = process.env[name];

  if (!value) {
    throw new Error(`Missing environment variable: ${name}`);
  }

  return value;
}

export const supabase = createClient(
  requiredEnv("EXPO_PUBLIC_SUPABASE_URL"),
  requiredEnv("EXPO_PUBLIC_SUPABASE_ANON_KEY"),
  {
    auth: {
      flowType: "pkce",
      detectSessionInUrl: false
    }
  }
);
