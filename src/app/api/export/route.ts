import "server-only";
import { TEMPLATE_BY_ID } from "@/data/templates";
import { generateNextProject } from "@/lib/codegen";
import { getEffectiveBrand } from "@/lib/brand/effective";
import { applyBrandToConfig, siteBrandFrom, type SiteBrand } from "@/lib/brand/site-brand";
import { isCloudConfigured } from "@/lib/env";
import { checkProject, projectFiles, slug } from "@/lib/export";
import { originOk } from "@/lib/origin";
import { can, normalizePlan, type Feature } from "@/lib/plans";
import { adminClient, clientIp, dbTooMany, tooMany } from "@/lib/boutique/api";
import { getUser } from "@/lib/supabase/server";
import type { Plan, Project } from "@/lib/types";
import { zip } from "@/lib/zip";

// POST /api/export : génère l'archive CÔTÉ SERVEUR, après avoir lu la formule RÉELLE du compte (table profiles).
// Jamais de formule fournie par le navigateur : le corps de la requête n'en accepte aucune (schéma strict).
// Voir docs/SECURITE-FONCTIONS-PAYANTES.md.

/** Taille maximale du corps de la requête : 2 Mo (un projet courant pèse quelques dizaines de Ko ; au-delà, c'est un abus). */
export const EXPORT_BODY_MAX_BYTES = 2_000_000;
/** Limite de débit par compte : 10 exports par minute et 30 par heure (mémoire, puis base `limite_debit` si Supabase est configuré). */
export const EXPORT_RATE = { perMinute: 10, perHour: 30 };

const json = (body: unknown, status = 200) => Response.json(body, { status, headers: { "cache-control": "no-store" } });

async function readBody(req: Request): Promise<{ ok: true; body: unknown } | { ok: false; res: Response }> {
  const tooBig = { ok: false as const, res: json({ error: "Requête trop volumineuse.", code: "too_large" }, 413) };
  const declared = Number(req.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > EXPORT_BODY_MAX_BYTES) return tooBig;
  if (!(req.headers.get("content-type") ?? "").toLowerCase().startsWith("application/json")) return { ok: false, res: json({ error: "Format de requête invalide.", code: "content_type" }, 415) };
  const reader = req.body?.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  if (reader) {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > EXPORT_BODY_MAX_BYTES) {
        await reader.cancel().catch(() => undefined);
        return tooBig;
      }
      chunks.push(value);
    }
  }
  try {
    return { ok: true, body: JSON.parse(new TextDecoder().decode(Buffer.concat(chunks))) };
  } catch {
    return { ok: false, res: json({ error: "Requête invalide.", code: "invalid_json" }, 400) };
  }
}

type ExportKind = "next" | "archive" | "landing";
const FEATURE: Record<ExportKind, Feature> = { next: "exportFichiers", archive: "exportFichiers", landing: "exportFichiers" };

/** Schéma strict : exactement { kind, project }. Toute autre clé (par exemple « plan ») est refusée. */
export function parseExportRequest(body: unknown): { ok: true; kind: ExportKind; project: Project } | { ok: false; error: string } {
  if (!body || typeof body !== "object" || Array.isArray(body)) return { ok: false, error: "Requête invalide." };
  const b = body as Record<string, unknown>;
  const extra = Object.keys(b).filter((k) => k !== "kind" && k !== "project");
  if (extra.length) return { ok: false, error: `Champ non autorisé : ${extra[0]}.` };
  if (b.kind !== "next" && b.kind !== "archive" && b.kind !== "landing") return { ok: false, error: "Type d'export invalide." };
  const p = b.project as Project | undefined;
  if (!p || typeof p !== "object") return { ok: false, error: "Projet manquant." };
  if (typeof p.id !== "string" || !/^[A-Za-z0-9_-]{4,64}$/.test(p.id)) return { ok: false, error: "Identifiant de projet invalide." };
  const c = p.config as Project["config"] | undefined;
  if (c && typeof c === "object") {
    if (typeof c.nom !== "string" || c.nom.trim().length < 1 || c.nom.length > 80) return { ok: false, error: "Nom de projet invalide (1 à 80 caractères)." };
    if (typeof c.templateId !== "string") return { ok: false, error: "Modèle invalide." };
  }
  const err = checkProject(p);
  if (err) return { ok: false, error: err };
  return { ok: true, kind: b.kind, project: p };
}

/** Formule du compte : lue en base, jamais fournie par le navigateur. En mode local (sans Supabase), voir le document de sécurité. */
async function serverPlan(): Promise<{ ok: true; plan: Plan; userId: string; db: ReturnType<typeof adminClient> } | { ok: false; res: Response }> {
  if (!isCloudConfigured()) {
    // Mode démonstration local : aucun compte, aucune base. Refusé en production ; en développement, démonstration complète.
    if (process.env.NODE_ENV === "production") return { ok: false, res: json({ error: "L'export n'est pas disponible : Supabase n'est pas configuré sur ce site.", code: "non_configure" }, 503) };
    return { ok: true, plan: "illimite", userId: "local", db: null };
  }
  const { supabase, user } = await getUser();
  if (!user) return { ok: false, res: json({ error: "Connecte-toi pour exporter.", code: "non_connecte" }, 401) };
  const { data: profile, error } = await supabase.from("profiles").select("plan").eq("id", user.id).maybeSingle();
  if (error) return { ok: false, res: json({ error: "Impossible de vérifier ta formule pour le moment.", code: "formule_indisponible" }, 503) };
  return { ok: true, plan: normalizePlan(profile?.plan), userId: user.id, db: adminClient() };
}

/**
 * Identité de marque blanche à appliquer à l'export, ou null. Droit calculé côté serveur (formule du compte + option) ;
 * FAIL-CLOSED : base absente, lecture en échec, droit refusé ou rien d'enregistré -> null (export habituel, avec la mention Décollage).
 */
async function exportBrand(auth: { userId: string; db: ReturnType<typeof adminClient> }): Promise<SiteBrand | null> {
  if (!auth.db) return null;
  try {
    return siteBrandFrom(await getEffectiveBrand(auth.db, auth.userId));
  } catch {
    return null;
  }
}

export async function POST(req: Request) {
  if (!originOk(req, { referer: false })) return json({ error: "Requête refusée (origine inattendue).", code: "origin" }, 403);
  const auth = await serverPlan();
  if (!auth.ok) return auth.res;

  if (tooMany(auth.userId, EXPORT_RATE.perMinute, 60_000, "export-min") || tooMany(auth.userId, EXPORT_RATE.perHour, 3_600_000, "export-h")) {
    return json({ error: "Trop d'exports. Réessaie dans une minute.", code: "rate_limit" }, 429);
  }
  if (auth.db && ((await dbTooMany(auth.db, "export", auth.userId, EXPORT_RATE.perHour, 3600)) || (await dbTooMany(auth.db, "export-ip", clientIp(req), EXPORT_RATE.perHour * 2, 3600)))) {
    return json({ error: "Trop d'exports. Réessaie plus tard.", code: "rate_limit" }, 429);
  }

  const read = await readBody(req);
  if (!read.ok) return read.res;
  const parsed = parseExportRequest(read.body);
  if (!parsed.ok) return json({ error: parsed.error, code: "invalid" }, 400);

  if (!can(auth.plan, FEATURE[parsed.kind])) {
    return json({ error: "Les exports de fichiers sont inclus dans les offres payantes.", code: "formule" }, 403);
  }
  if (TEMPLATE_BY_ID[parsed.project.config.templateId].premium && !can(auth.plan, "modelesPremium")) {
    return json({ error: "Ce modèle est réservé aux offres payantes.", code: "modele_premium" }, 403);
  }

  const marque = await exportBrand(auth);
  const name = slug(applyBrandToConfig(parsed.project.config, marque).nom) || "mon-saas";
  const files = parsed.kind === "next"
    ? generateNextProject(parsed.project, undefined, marque).map((f) => ({ name: `${name}/${f.name}`, content: f.content }))
    : parsed.kind === "landing"
      ? projectFiles(parsed.project, marque).filter((f) => f.name === "index.html" || f.name === "style.css")
      : projectFiles(parsed.project, marque);
  const bytes = zip(files);
  const file = parsed.kind === "next" ? `${name}-nextjs.zip` : parsed.kind === "landing" ? `${name}-landing.zip` : `${name}.zip`;
  return new Response(Buffer.from(bytes), {
    status: 200,
    headers: {
      "content-type": "application/zip",
      "content-disposition": `attachment; filename="${file}"`,
      "content-length": String(bytes.byteLength),
      "cache-control": "no-store",
      "x-content-type-options": "nosniff",
    },
  });
}
