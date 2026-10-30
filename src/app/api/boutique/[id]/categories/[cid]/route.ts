import { authorizeOwner, dbError, invalid, isId, json, notFound, readJson } from "@/lib/boutique/api";
import { validateCategorie } from "@/lib/boutique/validate";

type Ctx = { params: Promise<{ id: string; cid: string }> };

/** Renomme / repositionne une catégorie. */
export async function PATCH(req: Request, { params }: Ctx) {
  const o = await authorizeOwner(req, true);
  if (o instanceof Response) return o;
  const { id, cid } = await params;
  if (!isId(id) || !isId(cid)) return notFound();
  const body = await readJson(req);
  if (!body.ok) return body.res;
  const v = validateCategorie(body.body, true);
  if (!v.ok) return invalid(v.errors);
  // La RLS limite déjà aux catégories de MES boutiques ; on borne aussi à la boutique de l'adresse.
  const { data, error } = await o.supabase.from("categories").update(v.value).eq("id", cid).eq("boutique_id", id).select("*");
  if (error) return dbError(error);
  if (!data?.length) return notFound();
  return json({ categorie: data[0] });
}

/** Supprime une catégorie (ses produits restent, sans catégorie). */
export async function DELETE(req: Request, { params }: Ctx) {
  const o = await authorizeOwner(req, true);
  if (o instanceof Response) return o;
  const { id, cid } = await params;
  if (!isId(id) || !isId(cid)) return notFound();
  const { data, error } = await o.supabase.from("categories").delete().eq("id", cid).eq("boutique_id", id).select("id");
  if (error) return dbError(error);
  if (!data?.length) return notFound();
  return json({ ok: true });
}
