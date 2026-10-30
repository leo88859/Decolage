import { adminClient, clientIp, json, originOk, readJson, tooMany, notFound } from "@/lib/boutique/api";
import { REF_RE } from "@/lib/boutique/validate";
import { isCloudConfigured } from "@/lib/env";

/**
 * Suivi d'une commande par le client : { ref, jeton } (le jeton secret n'est donné qu'à la création de la commande).
 * POST pour que le jeton ne se retrouve pas dans une adresse d'historique. Mauvais couple = 404 (rien n'est révélé).
 */
export async function POST(req: Request) {
  if (!isCloudConfigured()) return json({ error: "Non disponible.", code: "demo" }, 503);
  if (!originOk(req)) return json({ error: "Requête refusée (origine inattendue).", code: "origin" }, 403);
  if (tooMany(clientIp(req), 20, 60_000, "suivi")) return json({ error: "Trop de tentatives.", code: "rate_limit" }, 429);
  const body = await readJson(req);
  if (!body.ok) return body.res;
  const b = (typeof body.body === "object" && body.body !== null ? body.body : {}) as Record<string, unknown>;
  if (typeof b.ref !== "string" || !REF_RE.test(b.ref) || typeof b.jeton !== "string" || !/^[0-9a-f]{64}$/.test(b.jeton)) return notFound();
  const admin = adminClient();
  if (!admin) return json({ error: "Non configuré.", code: "server" }, 503);
  const { data, error } = await admin.rpc("boutique_suivre_commande", { p_ref: b.ref, p_jeton: b.jeton });
  if (error) return json({ error: "Lecture impossible pour le moment.", code: "server" }, 500);
  if (!data) return notFound();
  return json({ commande: data });
}
