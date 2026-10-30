import { authorizeOwner, dbError, invalid, json, readJson } from "@/lib/boutique/api";
import { validateBoutique } from "@/lib/boutique/validate";

// Mes boutiques. Les écritures passent par la session du commerçant : la RLS et les limites de formule de la base s'appliquent.

/** Liste mes boutiques. */
export async function GET(req: Request) {
  const o = await authorizeOwner(req, false);
  if (o instanceof Response) return o;
  const { data, error } = await o.supabase.from("boutiques").select("*").eq("proprietaire_id", o.userId).order("created_at");
  if (error) return json({ error: "Lecture impossible pour le moment.", code: "server" }, 500);
  return json({ boutiques: data ?? [] });
}

/** Crée une boutique (brouillon par défaut). Le propriétaire est TOUJOURS celui de la session. */
export async function POST(req: Request) {
  const o = await authorizeOwner(req, true);
  if (o instanceof Response) return o;
  const body = await readJson(req);
  if (!body.ok) return body.res;
  const v = validateBoutique(body.body);
  if (!v.ok) return invalid(v.errors);
  const { data, error } = await o.supabase.from("boutiques").insert({ ...v.value, proprietaire_id: o.userId }).select("*").single();
  if (error) return dbError(error);
  return json({ boutique: data }, 201);
}
