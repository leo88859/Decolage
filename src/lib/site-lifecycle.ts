import type { SupabaseClient } from "@supabase/supabase-js";
import { PLANS } from "@/lib/plans";
import type { Plan } from "@/lib/types";

// Cycle de vie des sites publiés selon la formule du propriétaire (audit I-7).
// À la résiliation, les sites au-delà de la limite de la formule sont SUSPENDUS (colonne
// sites.suspended_at, migration 0002) : ils ne sont plus servis et n'acceptent plus d'inscription,
// mais leur contenu et leur liste d'attente sont conservés. Si l'abonnement reprend, ils sont réactivés.

type SiteRef = { slug: string; published_at: string };

/** Répartit les sites : les plus anciens restent actifs dans la limite de `maxSites`, les autres sont suspendus. */
export function splitSites(sites: SiteRef[], maxSites: number): { keep: string[]; suspend: string[] } {
  const sorted = [...sites].sort((a, b) => a.published_at.localeCompare(b.published_at) || a.slug.localeCompare(b.slug));
  const n = Number.isFinite(maxSites) ? Math.max(0, maxSites) : sorted.length;
  return { keep: sorted.slice(0, n).map((s) => s.slug), suspend: sorted.slice(n).map((s) => s.slug) };
}

/**
 * Applique la formule aux sites d'un utilisateur. Ne lève jamais d'erreur : si la migration 0002
 * n'est pas encore exécutée (colonne absente), l'opération est ignorée et journalisée sans donnée personnelle.
 */
export async function syncSitesWithPlan(admin: SupabaseClient, userId: string, plan: Plan): Promise<{ ok: boolean; suspended: number; restored: number }> {
  try {
    const { data, error } = await admin.from("sites").select("slug, published_at").eq("user_id", userId);
    if (error || !data) throw new Error(error?.message ?? "lecture impossible");
    const { keep, suspend } = splitSites(data as SiteRef[], PLANS[plan].maxSites);
    if (suspend.length) {
      const r = await admin.from("sites").update({ suspended_at: new Date().toISOString() }).eq("user_id", userId).in("slug", suspend);
      if (r.error) throw new Error(r.error.message);
    }
    if (keep.length) {
      const r = await admin.from("sites").update({ suspended_at: null }).eq("user_id", userId).in("slug", keep);
      if (r.error) throw new Error(r.error.message);
    }
    return { ok: true, suspended: suspend.length, restored: keep.length };
  } catch (e) {
    console.error(`[sites] synchronisation avec la formule non appliquée (migration 0002 exécutée ?) : ${(e as Error).message}`);
    return { ok: false, suspended: 0, restored: 0 };
  }
}
