import "server-only";
import { createServerClient } from "@supabase/ssr";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { supabaseEnv, supabaseServiceKey } from "@/lib/env";

/** Client lié à la session (cookies) : soumis aux règles RLS. À créer à chaque requête. */
export async function createClient() {
  const { url, anonKey } = supabaseEnv();
  const cookieStore = await cookies();
  return createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // Appelé depuis un Server Component : le proxy rafraîchit la session.
        }
      },
    },
  });
}

/** Client anonyme sans cookies : pour les pages publiques (sites publiés, inscriptions). */
export function createPublicClient() {
  const { url, anonKey } = supabaseEnv();
  return createSupabaseClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
}

/** Client administrateur (service_role) : contourne RLS. Réservé aux webhooks Stripe. */
export function createAdminClient() {
  const { url } = supabaseEnv();
  return createSupabaseClient(url, supabaseServiceKey(), { auth: { persistSession: false, autoRefreshToken: false } });
}

/** Utilisateur connecté, vérifié par Supabase (jamais déduit du seul cookie). */
export async function getUser() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  return { supabase, user: data.user };
}
