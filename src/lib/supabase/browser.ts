import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

// Ces variables sont publiques par conception (clé « anon » soumise aux règles RLS).
const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const cloudEnabled = Boolean(URL && KEY);

let client: SupabaseClient | null = null;

/** Client navigateur, ou null si Supabase n'est pas configuré (mode local). */
export function getBrowserClient(): SupabaseClient | null {
  if (!cloudEnabled) return null;
  client ??= createBrowserClient(URL!, KEY!);
  return client;
}
