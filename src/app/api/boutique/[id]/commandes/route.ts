import { authorizeOwner, json, notFound, ownedBoutique } from "@/lib/boutique/api";
import { STATUTS_COMMANDE } from "@/lib/boutique/types";

/** Commandes de ma boutique, les plus récentes d'abord (200 au maximum). Filtre facultatif : ?statut=nouvelle */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const o = await authorizeOwner(req, false);
  if (o instanceof Response) return o;
  const { id } = await params;
  const statut = new URL(req.url).searchParams.get("statut");
  if (statut !== null && !(STATUTS_COMMANDE as readonly string[]).includes(statut)) return json({ error: "Statut inconnu.", code: "invalid" }, 400);
  const b = await ownedBoutique(o, id);
  if (b.failed) return json({ error: "Lecture impossible pour le moment.", code: "server" }, 500);
  if (!b.row) return notFound();
  let q = o.supabase
    .from("commandes")
    .select("id, ref, boutique_id, client_nom, client_email, client_telephone, adresse_livraison, note, mode, statut, total_centimes, paiement, created_at, lignes_commande(produit_titre, variante_nom, prix_unitaire_centimes, quantite)")
    .eq("boutique_id", id);
  if (statut) q = q.eq("statut", statut);
  const { data, error } = await q.order("created_at", { ascending: false }).limit(200);
  if (error) return json({ error: "Lecture impossible pour le moment.", code: "server" }, 500);
  return json({ commandes: data ?? [] });
}
