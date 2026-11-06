import { json, notFound } from "@/lib/boutique/api";
import { marqueBlancheBoutique } from "@/lib/brand/public";
import { isCloudConfigured } from "@/lib/env";
import { createPublicClient } from "@/lib/supabase/server";
import { colonneThemeAbsente } from "@/lib/boutique/themes";
import type { BoutiquePub } from "@/components/vitrine/logic";

/** Seuil « stock bas » (miroir de la vue SQL variantes_publiques, migration 0007). */
const STOCK_BAS = 5;
type VariantePublique = { id: string; produit_id?: string; nom: string; position: number; disponible: boolean; stock_bas: boolean };

/**
 * Catalogue PUBLIC d'une boutique publiée (aucune connexion). Lu avec la clé anonyme : la RLS ne laisse voir que
 * les boutiques publiées et leurs produits actifs. Un brouillon répond 404.
 * Stock : le public ne reçoit JAMAIS la quantité exacte, seulement `disponible` et `stock_bas` (booléens). Ils viennent de la
 * vue variantes_publiques (migration 0007). Tant que la migration n'est pas exécutée, repli sur l'ancienne lecture des
 * variantes, dont le stock est converti en booléens avant la réponse (jamais renvoyé).
 */
export async function GET(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (!isCloudConfigured()) return json({ error: "Non disponible.", code: "demo" }, 503);
  if (!/^[a-z0-9-]{3,40}$/.test(slug)) return notFound();
  const db = createPublicClient();
  const COLONNES = "id, slug, nom, description, couleur_principale, couleur_accent, logo, adresse, whatsapp, email, telephone, modes, published_at";
  const lire = (colonnes: string) => db.from("boutiques").select(colonnes).eq("slug", slug).eq("statut", "publiee").maybeSingle<BoutiquePub>();
  let { data: b, error } = await lire(`${COLONNES}, theme`);
  // Migration 0009 pas encore exécutée : la vitrine s'affiche quand même, en thème classique.
  if (colonneThemeAbsente(error)) ({ data: b, error } = await lire(COLONNES));
  if (error) return json({ error: "Lecture impossible pour le moment.", code: "server" }, 500);
  if (!b) return notFound();
  const [cats, prods, vues, marqueBlanche] = await Promise.all([
    db.from("categories").select("id, nom, position").eq("boutique_id", b.id).order("position").order("nom"),
    db.from("produits").select("id, categorie_id, titre, description, prix_centimes, images, position").eq("boutique_id", b.id).order("position").order("created_at"),
    db.from("variantes_publiques").select("id, produit_id, nom, position, disponible, stock_bas").eq("boutique_id", b.id).order("position"),
    marqueBlancheBoutique(slug), // booléen décidé côté serveur (fail-closed : false = mention affichée)
  ]);
  if (cats.error || prods.error) return json({ error: "Lecture impossible pour le moment.", code: "server" }, 500);
  let variantes: VariantePublique[] = [];
  if (!vues.error) {
    variantes = (vues.data ?? []) as VariantePublique[];
  } else {
    // Repli (migration 0007 pas encore exécutée) : ancienne lecture, le stock est converti puis écarté.
    const old = await db.from("variantes").select("id, produit_id, nom, stock, position").eq("boutique_id", b.id).eq("actif", true);
    if (old.error) return json({ error: "Lecture impossible pour le moment.", code: "server" }, 500);
    variantes = (old.data ?? []).map((v) => ({ id: v.id, produit_id: v.produit_id, nom: v.nom, position: v.position, disponible: v.stock > 0, stock_bas: v.stock > 0 && v.stock <= STOCK_BAS }));
  }
  const produits = (prods.data ?? []).map((p) => ({
    ...p,
    variantes: variantes
      .filter((v) => v.produit_id === p.id)
      .sort((x, y) => x.position - y.position)
      .map((v) => ({ id: v.id, nom: v.nom, position: v.position, disponible: v.disponible, stock_bas: v.stock_bas })),
  }));
  return Response.json({ boutique: b, categories: cats.data ?? [], produits, marque_blanche: marqueBlanche === true }, { headers: { "cache-control": "public, max-age=15, stale-while-revalidate=60" } });
}
