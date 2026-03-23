"use client";

import { createBrowserClient } from "@supabase/ssr";
import { requireSupabaseConfig } from "./env";

export function createClient() {
  const config = requireSupabaseConfig();

  return createBrowserClient(config.url, config.publishableKey);
}
