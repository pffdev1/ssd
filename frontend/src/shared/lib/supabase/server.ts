import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { getSupabaseConfig, requireSupabaseConfig } from "./env";

export function hasSupabaseConfig() {
  return Boolean(getSupabaseConfig());
}

export async function createClient() {
  const config = requireSupabaseConfig();
  const cookieStore = await cookies();

  return createServerClient(config.url, config.publishableKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // Server Components cannot persist cookies directly. Middleware handles refresh.
        }
      }
    }
  });
}
