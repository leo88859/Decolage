import "server-only";
import { isCloudConfigured } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/server";
import { decideWhiteLabel } from "./decision";

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
    const [p, e] = await Promise.all([
      admin.from("profiles").select("plan").eq("id", owner).maybeSingle(),
      admin.from("brand_entitlements").select("enabled").eq("user_id", owner).maybeSingle(),
    ]);
    if (p.error || e.error || !p.data) return false;
    return decideWhiteLabel((p.data as { plan?: unknown }).plan, (e.data as { enabled?: unknown } | null)?.enabled);
  } catch {
    return false;
  }
}
