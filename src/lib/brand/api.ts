import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { appUrl, isCloudConfigured } from "@/lib/env";
import { createAdminClient, getUser } from "@/lib/supabase/server";
import { isAllowListed } from "./access";
import { BODY_MAX_BYTES, DEFAULT_BRAND, type Brand, type BrandState } from "./types";
import { validateBrand } from "./validate";

// Logique commune des routes /api/brand et /api/brand/restore.
// Règles : session obligatoire, droit vérifié à CHAQUE appel, user_id toujours pris de la session,
// Origin contrôlé sur les écritures, corps borné, aucune confirmation avant écriture ET relecture réussies.

export const json = (body: unknown, status = 200) => Response.json(body, { status, headers: { "cache-control": "no-store" } });

export type BrandRow = {
  user_id: string;
  name: string;
  color_primary: string;
  color_secondary: string;
  color_accent: string;
  color_surface: string;
  color_text: string;
  logo_data: string | null;
  favicon_data: string | null;
  version: number;
  previous: unknown;
  updated_at: string;
};

export type Ctx = { userId: string; supabase: SupabaseClient };

export const rowToBrand = (r: BrandRow): Brand => ({
  name: r.name,
  primary: r.color_primary,
  secondary: r.color_secondary,
  accent: r.color_accent,
  surface: r.color_surface,
  text: r.color_text,
  logo: r.logo_data,
  favicon: r.favicon_data,
});

const brandToColumns = (b: Brand) => ({
  name: b.name,
  color_primary: b.primary,
  color_secondary: b.secondary,
  color_accent: b.accent,
  color_surface: b.surface,
  color_text: b.text,
  logo_data: b.logo,
  favicon_data: b.favicon,
});

function originOk(req: Request): boolean {
  const origin = req.headers.get("origin");
  if (!origin || origin === "null") return false;
  let own = "";
  try {
    own = new URL(req.url).origin;
  } catch {
    // URL illisible : seule l'adresse publique configurée peut correspondre.
  }
  return origin === own || origin === appUrl();
}

/**
 * Vérifie, dans l'ordre : configuration, Origin (écritures), session, droit.
 * Renvoie le contexte, ou la réponse d'erreur à retourner telle quelle.
 */
export async function authorize(req: Request, mutating: boolean): Promise<Ctx | Response> {
  if (!isCloudConfigured()) return json({ error: "Mode démonstration : la marque blanche n'est pas disponible sans Supabase.", code: "demo" }, 503);
  if (mutating && !originOk(req)) return json({ error: "Requête refusée (origine inattendue).", code: "origin" }, 403);
  const { supabase, user } = await getUser();
  if (!user) return json({ error: "Connecte-toi.", code: "auth" }, 401);

  let allowed = isAllowListed(user.id, process.env.WHITE_LABEL_USER_IDS);
  if (!allowed) {
    const { data, error } = await supabase.from("brand_entitlements").select("enabled").eq("user_id", user.id).maybeSingle();
    if (error) return json({ error: "Vérification du droit impossible pour le moment.", code: "server" }, 500);
    allowed = data?.enabled === true;
  }
  if (!allowed) return json({ error: "Fonction non activée sur ton compte.", code: "not_entitled" }, 403);
  return { userId: user.id, supabase };
}

/** Lit le corps JSON avec une limite stricte, sans jamais charger plus que BODY_MAX_BYTES. */
export async function readJson(req: Request): Promise<{ ok: true; body: unknown } | { ok: false; res: Response }> {
  const declared = Number(req.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > BODY_MAX_BYTES) return { ok: false, res: json({ error: "Requête trop volumineuse." }, 413) };
  if (!(req.headers.get("content-type") ?? "").toLowerCase().startsWith("application/json")) return { ok: false, res: json({ error: "Format de requête invalide." }, 415) };
  const chunks: Uint8Array[] = [];
  let total = 0;
  const reader = req.body?.getReader();
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
  const text = new TextDecoder().decode(Buffer.concat(chunks));
  try {
    return { ok: true, body: JSON.parse(text) };
  } catch {
    return { ok: false, res: json({ error: "Requête invalide." }, 400) };
  }
}

export async function loadRow(supabase: SupabaseClient, userId: string): Promise<{ row: BrandRow | null; failed: boolean }> {
  const { data, error } = await supabase.from("brand_configs").select("*").eq("user_id", userId).maybeSingle();
  if (error) return { row: null, failed: true };
  return { row: (data as BrandRow | null) ?? null, failed: false };
}

export function stateOf(row: BrandRow | null): BrandState {
  return {
    entitled: true,
    brand: row ? rowToBrand(row) : { ...DEFAULT_BRAND },
    saved: Boolean(row),
    version: row?.version ?? 0,
    updatedAt: row?.updated_at ?? null,
    canRestore: Boolean(row?.previous && validateBrand(row.previous).ok),
  };
}

const snapshot = (row: BrandRow) => ({ ...rowToBrand(row), version: row.version });

/**
 * Enregistre `next` pour l'utilisateur de la session. L'ancienne version est gardée dans `previous`.
 * Renvoie la réponse HTTP finale : « ok » seulement si l'écriture ET la relecture concordent.
 */
export async function persist(ctx: Ctx, next: Brand, current: BrandRow | null): Promise<Response> {
  let admin;
  try {
    admin = createAdminClient();
  } catch {
    return json({ error: "L'enregistrement n'est pas encore configuré sur ce site.", code: "server" }, 503);
  }
  const now = new Date().toISOString();
  const expected = (current?.version ?? 0) + 1;
  if (current) {
    const { data, error } = await admin
      .from("brand_configs")
      .update({ ...brandToColumns(next), version: expected, previous: snapshot(current), updated_at: now })
      .eq("user_id", ctx.userId)
      .eq("version", current.version)
      .select("version");
    if (error) return json({ error: "Enregistrement impossible pour le moment.", code: "server" }, 500);
    if (!data || data.length !== 1) return json({ error: "La marque a été modifiée ailleurs entre-temps : recharge la page.", code: "conflict" }, 409);
  } else {
    const { error } = await admin.from("brand_configs").insert({ user_id: ctx.userId, ...brandToColumns(next), version: 1, previous: null, updated_at: now });
    if (error) {
      if (error.code === "23505") return json({ error: "La marque a été modifiée ailleurs entre-temps : recharge la page.", code: "conflict" }, 409);
      return json({ error: "Enregistrement impossible pour le moment.", code: "server" }, 500);
    }
  }
  // Relecture : on n'annonce le succès que si la base contient bien ce qu'on vient d'écrire.
  const check = await loadRow(ctx.supabase, ctx.userId);
  if (check.failed || !check.row || check.row.version !== expected || check.row.name !== next.name) {
    return json({ error: "L'enregistrement n'a pas pu être confirmé. Recharge la page pour vérifier.", code: "unconfirmed" }, 500);
  }
  return json({ ok: true, ...stateOf(check.row) });
}
