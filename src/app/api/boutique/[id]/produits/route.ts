import { authorizeOwner, dbError, fonctionAbsente, invalid, json, notFound, ownedBoutique, readJson } from "@/lib/boutique/api";
import { validateProduit } from "@/lib/boutique/validate";

/**
 * Crée un produit avec ses variantes (par défaut une variante « Unique » à stock 0). Prix en centimes entiers.
 * Une seule fonction SQL atomique (boutique_creer_produit, migration 0007) avec les droits du commerçant : tout ou rien,
 * jamais de produit sans variante, plafonds et validation des images appliqués par la base.
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const o = await authorizeOwner(req, true);
  if (o instanceof Response) return o;
  const { id } = await params;
  const body = await readJson(req);
  if (!body.ok) return body.res;
  const v = validateProduit(body.body);
  if (!v.ok) return invalid(v.errors);
  const b = await ownedBoutique(o, id);
  if (b.failed) return json({ error: "Lecture impossible pour le moment.", code: "server" }, 500);
  if (!b.row) return notFound();

  const { variantes, ...produit } = v.value;
  const atomique = await o.supabase.rpc("boutique_creer_produit", { p_boutique: id, p_produit: produit, p_variantes: variantes ?? null });
  if (!atomique.error) return json({ produit: atomique.data }, 201);
  if (!fonctionAbsente(atomique.error)) return dbError(atomique.error);

  // Repli (migration 0007 pas encore exécutée) : ancien chemin en deux écritures, avec nettoyage en cas d'échec.
  const { data: p, error } = await o.supabase.from("produits").insert({ ...produit, boutique_id: id }).select("*").single();
  if (error) return dbError(error);
  const rows = (variantes ?? [{ nom: "Unique", stock: 0 }]).map((x, i) => ({ stock: 0, position: i, ...x, produit_id: p.id, boutique_id: id }));
  const { data: vs, error: e2 } = await o.supabase.from("variantes").insert(rows).select("*");
  if (e2) {
    await o.supabase.from("produits").delete().eq("id", p.id); // pas de produit sans variante
    return dbError(e2);
  }
  return json({ produit: { ...p, variantes: vs } }, 201);
}
