import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { SupabaseClient } from "@supabase/supabase-js";
import { readSupabaseConfig } from "./config";

export async function getSupabaseServerClient(): Promise<SupabaseClient | null> {
  const config = readSupabaseConfig();
  if (!config) {
    return null;
  }

  const cookieStore = await cookies();
  return createServerClient(config.url, config.anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        } catch {
          // Server Components cannot always mutate cookies. The proxy owns
          // refresh writes; this client still reads the current session.
        }
      },
    },
  });
}
