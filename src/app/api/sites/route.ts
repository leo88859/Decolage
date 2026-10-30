import { isCloudConfigured } from "@/lib/env";
import { normalizePlan, PLANS, prixCourt } from "@/lib/plans";
import { slugError, validateSiteData } from "@/lib/publish";
import { createAdminClient, getUser } from "@/lib/supabase/server";

/** Écritures dans `sites` : toujours par le serveur (clé service_role) après les contrôles ci-dessous. La RLS interdit l'écriture directe depuis le navigateur (migration 0002). */
function writer() {
  try {
    return createAdminClient();
  } catch {
    return null;
  }
}
const NO_WRITER = "La mise en ligne n'est pas entièrement configurée sur ce site (clé serveur manquante).";

const json = (body: unknown, status = 200) => Response.json(body, { status, headers: { "cache-control": "no-store" } });

/** Publie (ou met à jour) le site d'un projet. */
export async function POST(req: Request) {
  if (!isCloudConfigured()) return json({ error: "La mise en ligne n'est pas encore activée sur ce site." }, 503);
  const { supabase, user } = await getUser();
  if (!user) return json({ error: "Connecte-toi pour publier." }, 401);

  let body: { projectId?: unknown; slug?: unknown; data?: unknown };
  try {
    body = await req.json();
  } catch {
    return json({ error: "Requête invalide." }, 400);
  }
  const projectId = typeof body.projectId === "string" && /^[a-z0-9]{4,32}$/.test(body.projectId) ? body.projectId : null;
  const slug = typeof body.slug === "string" ? body.slug.trim().toLowerCase() : "";
  if (!projectId) return json({ error: "Projet invalide." }, 400);
  const sErr = slugError(slug);
  if (sErr) return json({ error: sErr }, 400);
  const v = validateSiteData(body.data);
  if (!v.ok) return json({ error: v.error }, 400);

  // Limite de sites publiés selon la formule (lue côté serveur, jamais depuis le navigateur).
  const [{ data: profile }, { data: mine }] = await Promise.all([
    supabase.from("profiles").select("plan").eq("id", user.id).maybeSingle(),
    supabase.from("sites").select("slug, project_id").eq("user_id", user.id),
  ]);
  const plan = normalizePlan(profile?.plan);
  const existing = (mine ?? []).find((s) => s.project_id === projectId);
  if ((!existing && (mine ?? []).length >= PLANS[plan].maxSites) || PLANS[plan].maxSites === 0) {
    return json({
      error: PLANS[plan].maxSites === 0
        ? `La mise en ligne est incluse dans les offres payantes (à partir de ${prixCourt("solo")}/mois).`
        : `Ta formule ${PLANS[plan].nom} permet ${PLANS[plan].maxSites} site${PLANS[plan].maxSites > 1 ? "s" : ""} en ligne. Dépublie un site ou choisis une offre supérieure.`,
    }, 403);
  }

  const admin = writer();
  if (!admin) return json({ error: NO_WRITER }, 503);
  const now = new Date().toISOString();
  const row = { slug, user_id: user.id, project_id: projectId, data: v.data, updated_at: now };
  const res = existing
    ? await admin.from("sites").update(row).eq("user_id", user.id).eq("project_id", projectId)
    : await admin.from("sites").insert({ ...row, published_at: now });
  if (res.error) {
    if (res.error.code === "23505") return json({ error: "Cette adresse est déjà prise. Choisis-en une autre." }, 409);
    return json({ error: "Publication impossible pour le moment." }, 500);
  }
  return json({ slug, url: `/s/${slug}`, updatedAt: now });
}

/** Statut de publication d'un projet. */
export async function GET(req: Request) {
  if (!isCloudConfigured()) return json({ site: null });
  const { supabase, user } = await getUser();
  if (!user) return json({ site: null });
  const projectId = new URL(req.url).searchParams.get("projectId") ?? "";
  const { data } = await supabase.from("sites").select("slug, published_at, updated_at").eq("user_id", user.id).eq("project_id", projectId).maybeSingle();
  return json({ site: data ?? null });
}

/** Retire un site de la publication (ses inscrits sont supprimés avec lui). */
export async function DELETE(req: Request) {
  if (!isCloudConfigured()) return json({ error: "Non disponible." }, 503);
  const { user } = await getUser();
  if (!user) return json({ error: "Connecte-toi." }, 401);
  const projectId = new URL(req.url).searchParams.get("projectId") ?? "";
  const admin = writer();
  if (!admin) return json({ error: NO_WRITER }, 503);
  const { error } = await admin.from("sites").delete().eq("user_id", user.id).eq("project_id", projectId);
  if (error) return json({ error: "Impossible de dépublier pour le moment." }, 500);
  return json({ ok: true });
}
