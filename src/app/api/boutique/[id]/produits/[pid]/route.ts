import { authorizeOwner, dbError, invalid, isId, json, notFound, readJson } from "@/lib/boutique/api";
import { validateProduit } from "@/lib/boutique/validate";

type Ctx = { params: Promise<{ id: string; pid: string }> };

/** Modifie un produit (champs partiels). Désactiver (actif: false) le retire du catalogue public sans le supprimer. */
export async function PATCH(req: Request, { params }: Ctx) {
  const o = await authorizeOwner(req, true);
  if (o instanceof Response) return o;
  const { id, pid } = await params;
  if (!isId(id) || !isId(pid)) return notFound();
  const body = await readJson(req);
  if (!body.ok) return body.res;
  const v = validateProduit(body.body, true);
  if (!v.ok) return invalid(v.errors);
  const { data, error } = await o.supabase.from("produits").update(v.value).eq("id", pid).eq("boutique_id", id).select("*, variantes(*)");
  if (error) return dbError(error);
  if (!data?.length) return notFound();
  return json({ produit: data[0] });
}

/** Supprime un produit et ses variantes (les commandes déjà passées gardent leur copie du titre et du prix). */
export async function DELETE(req: Request, { params }: Ctx) {
  const o = await authorizeOwner(req, true);
  if (o instanceof Response) return o;
  const { id, pid } = await params;
  if (!isId(id) || !isId(pid)) return notFound();
  const { data, error } = await o.supabase.from("produits").delete().eq("id", pid).eq("boutique_id", id).select("id");
  if (error) return dbError(error);
  if (!data?.length) return notFound();
  return json({ ok: true });
}
