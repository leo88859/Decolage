import { authorizeOwner, dbError, invalid, isId, json, notFound, readJson } from "@/lib/boutique/api";
import { validateStatut, REF_RE } from "@/lib/boutique/validate";

/**
 * Change le statut d'une de mes commandes. Passages autorisés : nouvelle > confirmee > prete > terminee ;
 * annulee possible avant terminee (le stock est alors remis). Seul le statut est modifiable.
 */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string; ref: string }> }) {
  const o = await authorizeOwner(req, true);
  if (o instanceof Response) return o;
  const { id, ref } = await params;
  if (!isId(id) || !REF_RE.test(ref)) return notFound();
  const body = await readJson(req);
  if (!body.ok) return body.res;
  const v = validateStatut(body.body);
  if (!v.ok) return invalid(v.errors);
  const { data, error } = await o.supabase.from("commandes").update({ statut: v.value.statut }).eq("ref", ref).eq("boutique_id", id).select("ref, statut, paiement, updated_at");
  if (error) return dbError(error);
  if (!data?.length) return notFound();
  return json({ commande: data[0] });
}
