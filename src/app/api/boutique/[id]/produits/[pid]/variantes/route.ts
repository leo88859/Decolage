import { authorizeOwner, dbError, invalid, isId, json, notFound, readJson } from "@/lib/boutique/api";
import { validateVariante } from "@/lib/boutique/validate";

/** Ajoute une variante (taille, couleur…) avec son stock à un produit. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string; pid: string }> }) {
  const o = await authorizeOwner(req, true);
  if (o instanceof Response) return o;
  const { id, pid } = await params;
  if (!isId(id) || !isId(pid)) return notFound();
  const body = await readJson(req);
  if (!body.ok) return body.res;
  const v = validateVariante(body.body);
  if (!v.ok) return invalid(v.errors);
  // La base vérifie que le produit appartient à la boutique ET que la boutique est la mienne (clé étrangère + RLS).
  const { data, error } = await o.supabase.from("variantes").insert({ ...v.value, produit_id: pid, boutique_id: id }).select("*").single();
  if (error) return dbError(error);
  return json({ variante: data }, 201);
}
