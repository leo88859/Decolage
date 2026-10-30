import { authorizeOwner, dbError, invalid, isId, json, notFound, readJson } from "@/lib/boutique/api";
import { validateVariante } from "@/lib/boutique/validate";

type Ctx = { params: Promise<{ id: string; pid: string; vid: string }> };

/** Modifie une variante (nom, stock, actif, position). */
export async function PATCH(req: Request, { params }: Ctx) {
  const o = await authorizeOwner(req, true);
  if (o instanceof Response) return o;
  const { id, pid, vid } = await params;
  if (![id, pid, vid].every(isId)) return notFound();
  const body = await readJson(req);
  if (!body.ok) return body.res;
  const v = validateVariante(body.body, true);
  if (!v.ok) return invalid(v.errors);
  const { data, error } = await o.supabase.from("variantes").update(v.value).eq("id", vid).eq("produit_id", pid).eq("boutique_id", id).select("*");
  if (error) return dbError(error);
  if (!data?.length) return notFound();
  return json({ variante: data[0] });
}

/** Supprime une variante (les commandes passées gardent leur copie). */
export async function DELETE(req: Request, { params }: Ctx) {
  const o = await authorizeOwner(req, true);
  if (o instanceof Response) return o;
  const { id, pid, vid } = await params;
  if (![id, pid, vid].every(isId)) return notFound();
  const { data, error } = await o.supabase.from("variantes").delete().eq("id", vid).eq("produit_id", pid).eq("boutique_id", id).select("id");
  if (error) return dbError(error);
  if (!data?.length) return notFound();
  return json({ ok: true });
}
