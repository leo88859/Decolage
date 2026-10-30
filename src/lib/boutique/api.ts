import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { isCloudConfigured } from "@/lib/env";
import { originOk as sharedOriginOk } from "@/lib/origin";
import { createAdminClient, getUser } from "@/lib/supabase/server";
import { UUID_RE } from "./validate";

// Outils communs aux routes /api/boutique/** : réponses, contrôle d'origine, corps JSON borné, session, erreurs Postgres.

export const json = (body: unknown, status = 200) => Response.json(body, { status, headers: { "cache-control": "no-store" } });
export const BODY_MAX_BYTES = 64_000;

/** Contrôle d'origine commun (src/lib/origin.ts), SANS repli sur le Referer : une écriture sans en-tête Origin reste refusée ici. */
export const originOk = (req: Request): boolean => sharedOriginOk(req, { referer: false });

export async function readJson(req: Request): Promise<{ ok: true; body: unknown } | { ok: false; res: Response }> {
  const declared = Number(req.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > BODY_MAX_BYTES) return { ok: false, res: json({ error: "Requête trop volumineuse." }, 413) };
  if (!(req.headers.get("content-type") ?? "").toLowerCase().startsWith("application/json")) return { ok: false, res: json({ error: "Format de requête invalide." }, 415) };
  const reader = req.body?.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  if (reader) {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > BODY_MAX_BYTES) {
        await reader.cancel().catch(() => undefined);
        return { ok: false, res: json({ error: "Requête trop volumineuse." }, 413) };
      }
      chunks.push(value);
    }
  }
  try {
    return { ok: true, body: JSON.parse(new TextDecoder().decode(Buffer.concat(chunks))) };
  } catch {
    return { ok: false, res: json({ error: "Requête invalide." }, 400) };
  }
}

export const invalid = (errors: Record<string, string>) => json({ error: "Certains champs sont invalides.", code: "invalid", errors }, 400);
export const notFound = () => json({ error: "Introuvable.", code: "not_found" }, 404);
export const isId = (s: string) => UUID_RE.test(s);

export type Owner = { userId: string; supabase: SupabaseClient };

/** Configuration, origine (écritures), session. Les écritures passent par le client de la SESSION : la RLS s'applique. */
export async function authorizeOwner(req: Request, mutating: boolean): Promise<Owner | Response> {
  if (!isCloudConfigured()) return json({ error: "Mode démonstration : la boutique n'est pas disponible sans Supabase.", code: "demo" }, 503);
  if (mutating && !originOk(req)) return json({ error: "Requête refusée (origine inattendue).", code: "origin" }, 403);
  const { supabase, user } = await getUser();
  if (!user) return json({ error: "Connecte-toi.", code: "auth" }, 401);
  return { userId: user.id, supabase };
}

type PgError = { code?: string; message?: string; hint?: string } | null;

/** Traduit une erreur Postgres en réponse claire (sans jamais renvoyer le texte brut de la base). */
export function dbError(e: NonNullable<PgError>): Response {
  if (e.hint === "publication_formule") return json({ error: "La publication en ligne n'est pas incluse dans la formule Découverte. Ta boutique reste enregistrée en brouillon et tu peux la préparer : passe à Solo pour la publier.", code: "publication_formule" }, 403);
  if (e.hint === "limite_boutiques" || e.hint === "limite_sites") return json({ error: "Ta formule ne permet pas d'aller plus loin. Passe à une offre supérieure ou dépublie un site.", code: e.hint }, 403);
  if (e.hint === "plafond_produits" || e.hint === "plafond_variantes" || e.hint === "plafond_categories") return json({ error: "Tu as atteint le nombre maximum autorisé (500 produits par boutique, 2000 par compte, 50 variantes par produit, 50 catégories par boutique).", code: e.hint }, 403);
  if (e.hint === "statut_invalide") return json({ error: "Ce changement de statut n'est pas possible.", code: "statut_invalide" }, 409);
  if (e.code === "23505") return json({ error: "Cet élément existe déjà (adresse ou nom déjà utilisé).", code: "duplicate" }, 409);
  if (e.code === "42501") return json({ error: "Action non autorisée.", code: "forbidden" }, 403);
  if (e.code === "23503" || e.code === "23514" || e.code === "22P02" || e.code === "22003" || e.code === "22023") return json({ error: "Valeur refusée par la base.", code: "invalid" }, 400);
  return json({ error: "Opération impossible pour le moment.", code: "server" }, 500);
}

export function adminClient(): SupabaseClient | null {
  try {
    return createAdminClient();
  } catch {
    return null;
  }
}

// Limite par adresse IP (au mieux : la mémoire n'est pas partagée entre instances), comme la liste d'attente.
const hits = new Map<string, number[]>();
export function tooMany(ip: string, max: number, windowMs = 60_000, bucket = "") {
  const key = `${bucket}|${ip}`;
  const now = Date.now();
  const recent = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
  recent.push(now);
  hits.set(key, recent);
  if (hits.size > 5000) hits.clear();
  return recent.length > max;
}
/** La fonction SQL appelée n'existe pas encore : migration 0007 pas exécutée (le code reste alors compatible). */
export const fonctionAbsente = (e: { code?: string; message?: string } | null | undefined) =>
  Boolean(e) && (e!.code === "PGRST202" || e!.code === "42883" || /could not find the function|does not exist/i.test(e!.message ?? ""));

/**
 * Limite de débit PARTAGÉE (en base, migration 0007) : fonctionne entre plusieurs instances Vercel, contrairement à tooMany.
 * Renvoie true si la limite est dépassée. Si la fonction est absente ou la base en panne, renvoie false : la limite en
 * mémoire (tooMany), toujours appliquée avant, reste la seule protection. La clé n'est stockée que hachée.
 */
export async function dbTooMany(db: SupabaseClient, seau: string, cle: string, max: number, fenetreSecondes: number): Promise<boolean> {
  try {
    const { data, error } = await db.rpc("limite_debit", { p_seau: seau, p_cle: cle, p_max: max, p_fenetre_s: fenetreSecondes });
    return !error && data === true;
  } catch {
    return false;
  }
}

export const clientIp = (req: Request) => req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
export const resetRateLimit = () => hits.clear();

/** Boutique du propriétaire connecté (la RLS laisse aussi lire les boutiques publiées des autres : on filtre donc ici). */
export async function ownedBoutique(o: Owner, id: string): Promise<{ row: Record<string, unknown> | null; failed: boolean }> {
  if (!isId(id)) return { row: null, failed: false };
  const { data, error } = await o.supabase.from("boutiques").select("*").eq("id", id).eq("proprietaire_id", o.userId).maybeSingle();
  if (error) return { row: null, failed: true };
  return { row: (data as Record<string, unknown> | null) ?? null, failed: false };
}
