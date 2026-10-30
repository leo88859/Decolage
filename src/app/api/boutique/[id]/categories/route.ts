import { authorizeOwner, dbError, invalid, json, notFound, ownedBoutique, readJson } from "@/lib/boutique/api";
import { validateCategorie } from "@/lib/boutique/validate";

/** Ajoute une catégorie à ma boutique. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const o = await authorizeOwner(req, true);
  if (o instanceof Response) return o;
  const { id } = await params;
  const body = await readJson(req);
  if (!body.ok) return body.res;
  const v = validateCategorie(body.body);
  if (!v.ok) return invalid(v.errors);
  const b = await ownedBoutique(o, id);
  if (b.failed) return json({ error: "Lecture impossible pour le moment.", code: "server" }, 500);
  if (!b.row) return notFound();
  const { data, error } = await o.supabase.from("categories").insert({ ...v.value, boutique_id: id }).select("*").single();
  if (error) return dbError(error);
  return json({ categorie: data }, 201);
}
