export type SupabaseBrowserConfig = {
  readonly url: string;
  readonly anonKey: string;
};

export function readSupabaseConfig(
  environment: NodeJS.ProcessEnv = process.env,
): SupabaseBrowserConfig | null {
  const url = environment.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const anonKey = environment.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  if (!url || !anonKey) {
    return null;
  }
  return { url, anonKey };
}
