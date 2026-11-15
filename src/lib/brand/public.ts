import "server-only";
import { isCloudConfigured } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/server";
import { readEntitlement } from "./effective";

/**
 * La mention « Créé avec Décollage » d'une boutique publiée doit-elle être masquée ?
 * Décidé uniquement côté serveur, au rendu, avec la clé service_role (jamais exposée) :
 *   boutiques.proprietaire_id -> profiles.plan + brand_entitlements.enabled -> decideWhiteLabel (même règle que /api/brand).
 * Renvoie un simple booléen : ni l'identifiant du propriétaire ni sa formule ne sortent d'ici.
 * FAIL-CLOSED : au moindre doute (pas de clé, erreur de lecture, ligne absente) -> false, donc la mention reste affichée.
 * Le slug ne sert qu'à retrouver la boutique ; il est validé et la boutique doit être publiée.
 */
export async function marqueBlancheBoutique(slug: string): Promise<boolean> {
  try {
    if (!isCloudConfigured() || !/^[a-z0-9-]{3,40}$/.test(slug)) return false;
    const admin = createAdminClient();
    const b = await admin.from("boutiques").select("proprietaire_id").eq("slug", slug).eq("statut", "publiee").maybeSingle();
    const owner = (b.data as { proprietaire_id?: unknown } | null)?.proprietaire_id;
    if (b.error || typeof owner !== "string" || !owner) return false;
    const ent = await readEntitlement(admin, owner); // même source que /api/brand (effective.ts)
    return ent.ok && ent.entitled;
  } catch {
    return false;
  }
}
