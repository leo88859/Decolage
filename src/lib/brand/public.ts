import "server-only";
import { isCloudConfigured } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/server";
import { getEffectiveBrand, readEntitlement } from "./effective";
import { fallbackFaviconDataUrl, siteBrandFrom } from "./site-brand";

/**
 * La mention « Créé avec Décollage » d'une boutique publiée doit-elle être masquée ?
 * Décidé uniquement côté serveur, au rendu, avec la clé service_role (jamais exposée) :
 *   boutiques.proprietaire_id -> profiles.plan + brand_entitlements.enabled -> decideWhiteLabel (même règle que /api/brand).
 * Renvoie un simple booléen : ni l'identifiant du propriétaire ni sa formule ne sortent d'ici.
 * FAIL-CLOSED : au moindre doute (pas de clé, erreur de lecture, ligne absente) -> false, donc la mention reste affichée.
 * Le slug ne sert qu'à retrouver la boutique ; il est validé et la boutique doit être publiée.
 */
export async function marqueBlancheBoutique(slug: string): Promise<boolean> {
  return (await marqueBoutique(slug)).entitled;
}

/** Identité publique d'une boutique en marque blanche : uniquement ce qui s'affiche (aucun identifiant, aucune formule). */
export type MarquePublique = { nom: string; couleur_principale: string | null; couleur_accent: string | null; logo: string | null; icone: string };

/**
 * Droit ET identité de marque du propriétaire d'une boutique publiée (même règle que marqueBlancheBoutique, une seule lecture).
 * `marque` n'est non nul que si le droit est actif ET qu'une marque est enregistrée. Fail-closed : au moindre doute { entitled: false, marque: null }.
 */
export async function marqueBoutique(slug: string): Promise<{ entitled: boolean; marque: MarquePublique | null }> {
  const refus = { entitled: false, marque: null };
  try {
    if (!isCloudConfigured() || !/^[a-z0-9-]{3,40}$/.test(slug)) return refus;
    const admin = createAdminClient();
    const b = await admin.from("boutiques").select("proprietaire_id").eq("slug", slug).eq("statut", "publiee").maybeSingle();
    const owner = (b.data as { proprietaire_id?: unknown } | null)?.proprietaire_id;
    if (b.error || typeof owner !== "string" || !owner) return refus;
    const ent = await readEntitlement(admin, owner); // même source que /api/brand (effective.ts)
    if (!ent.ok || !ent.entitled) return refus;
    // Droit acquis : la mention est masquée même si la lecture de l'identité échoue (la boutique garde alors ses propres couleurs).
    const sb = siteBrandFrom(await getEffectiveBrand(admin, owner).catch(() => null));
    return { entitled: true, marque: sb ? { nom: sb.name, couleur_principale: sb.primary ?? null, couleur_accent: sb.accent ?? null, logo: sb.logo, icone: sb.favicon ?? fallbackFaviconDataUrl(sb) } : null };
  } catch {
    return refus;
  }
}
