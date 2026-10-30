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

// ─── Sites ET boutiques : une seule limite (maxSites) pour les deux ───────────────────────────
// Comportement choisi (documenté dans docs/LIMITES-SERVEUR.md) : à la rétrogradation ou la résiliation,
// on ne supprime RIEN. Parmi les sites publiés et les boutiques publiées, les plus anciennement publiés restent
// en ligne dans la limite de la formule ; les autres sont SUSPENDUS (suspended_at) : introuvables publiquement
// (404), contenu et commandes conservés, republication possible après réabonnement. Gratuit : tout est suspendu.
// Au réabonnement, les éléments suspendus qui rentrent dans la nouvelle limite sont réactivés (même règle que les
// sites depuis la migration 0002) ; un brouillon, lui, ne devient jamais public tout seul.

export type Publication = { kind: "site" | "boutique"; key: string; published_at: string };

export function splitPublications(pubs: Publication[], maxSites: number): { keep: Publication[]; suspend: Publication[] } {
  const sorted = [...pubs].sort((a, b) => a.published_at.localeCompare(b.published_at) || a.kind.localeCompare(b.kind) || a.key.localeCompare(b.key));
  const n = Number.isFinite(maxSites) ? Math.max(0, maxSites) : sorted.length;
  return { keep: sorted.slice(0, n), suspend: sorted.slice(n) };
}

/** Vrai si l'erreur de base signifie « table ou colonne absente » (migration pas encore exécutée), pas une panne passagère. */
export function isMissingSchema(e: { code?: string; message?: string } | null | undefined): boolean {
  if (!e) return false;
  if (e.code && ["42P01", "42703", "PGRST204", "PGRST205"].includes(e.code)) return true;
  return /does not exist|schema cache|n'existe pas/i.test(e.message ?? "");
}

/**
 * Applique la formule aux sites et aux boutiques publiés d'un utilisateur. Ne lève jamais d'erreur : l'échec est
 * signalé par `ok: false` (journalisé sans donnée personnelle) et l'APPELANT doit en tenir compte — le webhook Stripe
 * répond alors une erreur pour que Stripe rejoue l'événement (la synchronisation est idempotente : un rejeu complète
 * la suspension manquante).
 */
export async function syncPublicationsWithPlan(admin: SupabaseClient, userId: string, plan: Plan): Promise<{ ok: boolean; suspended: number; restored: number }> {
  try {
    const sites = await admin.from("sites").select("slug, published_at").eq("user_id", userId);
    if (sites.error || !sites.data) throw new Error(sites.error?.message ?? "lecture des sites impossible");
    // Boutiques : migration 0005/0006 peut manquer ; on continue alors avec les sites seuls.
    const shops = await admin.from("boutiques").select("id, published_at").eq("proprietaire_id", userId).eq("statut", "publiee");
    if (shops.error) {
      // Migration absente : on continue avec les sites seuls. Toute autre erreur (panne passagère) : échec, pour ne jamais laisser une boutique en ligne par erreur.
      if (!isMissingSchema(shops.error)) throw new Error(`lecture des boutiques impossible : ${shops.error.message}`);
      console.error(`[boutiques] table absente pour la synchronisation (migrations 0005/0006 exécutées ?) : ${shops.error.message}`);
    }
    const pubs: Publication[] = [
      ...(sites.data as SiteRef[]).map((s) => ({ kind: "site" as const, key: s.slug, published_at: s.published_at })),
      ...((shops.error ? [] : (shops.data ?? [])) as { id: string; published_at: string | null }[]).map((b) => ({ kind: "boutique" as const, key: b.id, published_at: b.published_at ?? "9999" })),
    ];
    const { keep, suspend } = splitPublications(pubs, PLANS[plan].maxSites);
    const now = new Date().toISOString();
    const set = async (kind: Publication["kind"], list: Publication[], value: string | null) => {
      if (!list.length) return;
      const keys = list.filter((p) => p.kind === kind).map((p) => p.key);
      if (!keys.length) return;
      const r = kind === "site"
        ? await admin.from("sites").update({ suspended_at: value }).eq("user_id", userId).in("slug", keys)
        : await admin.from("boutiques").update({ suspended_at: value }).eq("proprietaire_id", userId).in("id", keys);
      if (r.error) throw new Error(r.error.message);
    };
    // Toutes les suspensions d'abord, puis les réactivations : la base (migration 0008) refuse de réactiver au-delà
    // de la limite, donc on libère la place avant de la reprendre (sites et boutiques confondus).
    for (const kind of ["site", "boutique"] as const) await set(kind, suspend, now);
    for (const kind of ["site", "boutique"] as const) await set(kind, keep, null);
    return { ok: true, suspended: suspend.length, restored: keep.length };
  } catch (e) {
    console.error(`[publications] synchronisation avec la formule non appliquée (migrations 0002/0006 exécutées ?) : ${(e as Error).message}`);
    return { ok: false, suspended: 0, restored: 0 };
  }
}
