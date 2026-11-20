import { authorizeOwner, dbError, invalid, isId, json, notFound, ownedBoutique, readJson } from "@/lib/boutique/api";
import { REF_RE } from "@/lib/boutique/validate";

const REFS_MAX = 50;

/**
 * Annule PLUSIEURS de mes commandes « nouvelle » d'un coup : corps { refs: ["CMD-…", …] } (1 à 50 références).
 * Seules les commandes « nouvelle » de MA boutique sont annulées ; les autres (confirmée, prête, terminée, déjà annulée,
 * inconnue) sont renvoyées dans `ignorees` et ne sont JAMAIS modifiées. Le stock est remis par le déclencheur de la base au
 * passage à « annulee » : une seule fois par commande, car le filtre sur le statut « nouvelle » empêche toute seconde annulation
 * (un appel répété renvoie les mêmes références dans `ignorees`). Tout ou rien : une erreur de la base n'annule aucune commande.
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const o = await authorizeOwner(req, true);
  if (o instanceof Response) return o;
  const { id } = await params;
  if (!isId(id)) return notFound();
  const body = await readJson(req);
  if (!body.ok) return body.res;
  const b = typeof body.body === "object" && body.body !== null && !Array.isArray(body.body) ? (body.body as Record<string, unknown>) : null;
  if (!b) return invalid({ _: "Objet JSON attendu." });
  const extra = Object.keys(b).filter((k) => k !== "refs");
  if (extra.length) return invalid(Object.fromEntries(extra.map((k) => [k, "Champ inconnu."])));
  if (!Array.isArray(b.refs) || b.refs.length < 1 || b.refs.length > REFS_MAX) return invalid({ refs: `Entre 1 et ${REFS_MAX} références attendues.` });
  if (!b.refs.every((r): r is string => typeof r === "string" && REF_RE.test(r))) return invalid({ refs: "Référence de commande invalide." });
  const refs = [...new Set(b.refs)];

  const boutique = await ownedBoutique(o, id);
  if (boutique.failed) return json({ error: "Lecture impossible pour le moment.", code: "server" }, 500);
  if (!boutique.row) return notFound();

  const { data, error } = await o.supabase
    .from("commandes")
    .update({ statut: "annulee" })
    .eq("boutique_id", id)
    .eq("statut", "nouvelle")
    .in("ref", refs)
    .select("ref");
  if (error) return dbError(error);
  const annulees = (data ?? []).map((r: { ref: string }) => r.ref);
  const faites = new Set(annulees);
  return json({ annulees, ignorees: refs.filter((r) => !faites.has(r)) });
}
