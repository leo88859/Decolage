import { json, notFound } from "@/lib/boutique/api";
import { isCloudConfigured } from "@/lib/env";
import { createPublicClient } from "@/lib/supabase/server";

/**
 * Catalogue PUBLIC d'une boutique publiée (aucune connexion). Lu avec la clé anonyme : la RLS ne laisse voir que
 * les boutiques publiées, leurs produits actifs et leurs variantes actives. Un brouillon répond 404.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (!isCloudConfigured()) return json({ error: "Non disponible.", code: "demo" }, 503);
  if (!/^[a-z0-9-]{3,40}$/.test(slug)) return notFound();
  const db = createPublicClient();
  const { data: b, error } = await db
    .from("boutiques")
    .select("id, slug, nom, description, couleur_principale, couleur_accent, logo, adresse, whatsapp, email, telephone, modes, published_at")
    .eq("slug", slug)
    .eq("statut", "publiee")
    .maybeSingle();
  if (error) return json({ error: "Lecture impossible pour le moment.", code: "server" }, 500);
  if (!b) return notFound();
  const [cats, prods] = await Promise.all([
    db.from("categories").select("id, nom, position").eq("boutique_id", b.id).order("position").order("nom"),
    db.from("produits").select("id, categorie_id, titre, description, prix_centimes, images, position, variantes(id, nom, stock, position)").eq("boutique_id", b.id).order("position").order("created_at"),
  ]);
  if (cats.error || prods.error) return json({ error: "Lecture impossible pour le moment.", code: "server" }, 500);
  const produits = (prods.data ?? []).map((p) => ({
    ...p,
    variantes: [...(p.variantes ?? [])].sort((x, y) => x.position - y.position).map((v) => ({ ...v, disponible: v.stock > 0 })),
  }));
  return Response.json({ boutique: b, categories: cats.data ?? [], produits }, { headers: { "cache-control": "public, max-age=15, stale-while-revalidate=60" } });
}
