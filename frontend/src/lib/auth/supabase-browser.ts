"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { readSupabaseConfig } from "./config";

let browserClient: SupabaseClient | null = null;

export function getSupabaseBrowserClient(): SupabaseClient | null {
  if (typeof window === "undefined") {
    return null;
  }
  if (browserClient) {
    return browserClient;
  }
  const config = readSupabaseConfig();
  if (!config) {
    return null;
  }
  browserClient = createBrowserClient(config.url, config.anonKey);
  return browserClient;
}
