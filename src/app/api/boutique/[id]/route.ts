import { authorizeOwner, dbError, invalid, json, notFound, ownedBoutique, readJson } from "@/lib/boutique/api";
import { validateBoutique } from "@/lib/boutique/validate";
import { colonneThemeAbsente } from "@/lib/boutique/themes";

type Ctx = { params: Promise<{ id: string }> };

/** Ma boutique avec ses catégories, produits et variantes (stock compris). */
export async function GET(req: Request, { params }: Ctx) {
  const o = await authorizeOwner(req, false);
  if (o instanceof Response) return o;
  const { id } = await params;
  const b = await ownedBoutique(o, id);
  if (b.failed) return json({ error: "Lecture impossible pour le moment.", code: "server" }, 500);
  if (!b.row) return notFound();
  const [cats, prods] = await Promise.all([
    o.supabase.from("categories").select("*").eq("boutique_id", id).order("position").order("nom"),
    o.supabase.from("produits").select("*, variantes(*)").eq("boutique_id", id).order("position").order("created_at"),
  ]);
  if (cats.error || prods.error) return json({ error: "Lecture impossible pour le moment.", code: "server" }, 500);
  return json({ boutique: b.row, categories: cats.data ?? [], produits: prods.data ?? [] });
}

/** Modifie ma boutique (champs partiels). Passer statut à « publiee » la met en ligne (limite de formule appliquée). */
export async function PATCH(req: Request, { params }: Ctx) {
  const o = await authorizeOwner(req, true);
  if (o instanceof Response) return o;
  const { id } = await params;
  const body = await readJson(req);
  if (!body.ok) return body.res;
  const v = validateBoutique(body.body, true);
  if (!v.ok) return invalid(v.errors);
  const b = await ownedBoutique(o, id);
  if (b.failed) return json({ error: "Lecture impossible pour le moment.", code: "server" }, 500);
  if (!b.row) return notFound();
  const maj = (champs: typeof v.value) => o.supabase.from("boutiques").update(champs).eq("id", id).eq("proprietaire_id", o.userId).select("*");
  let { data, error } = await maj(v.value);
  // Migration 0009 pas encore exécutée : on enregistre le reste, sans le thème.
  if (colonneThemeAbsente(error) && "theme" in v.value) {
    const sansTheme = { ...v.value };
    delete sansTheme.theme;
    ({ data, error } = Object.keys(sansTheme).length ? await maj(sansTheme) : { data: [b.row], error: null });
  }
  if (error) return dbError(error);
  if (!data?.length) return notFound();
  return json({ boutique: data[0] });
}

/** Supprime ma boutique ET ses produits, variantes et commandes (irréversible : l'interface doit demander confirmation). */
export async function DELETE(req: Request, { params }: Ctx) {
  const o = await authorizeOwner(req, true);
  if (o instanceof Response) return o;
  const { id } = await params;
  const b = await ownedBoutique(o, id);
  if (b.failed) return json({ error: "Lecture impossible pour le moment.", code: "server" }, 500);
  if (!b.row) return notFound();
  const { data, error } = await o.supabase.from("boutiques").delete().eq("id", id).eq("proprietaire_id", o.userId).select("id");
  if (error) return dbError(error);
  if (!data?.length) return notFound();
  return json({ ok: true });
}
