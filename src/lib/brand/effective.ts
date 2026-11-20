import type { SupabaseClient } from "@supabase/supabase-js";
import { decideWhiteLabel } from "./decision";
import { DEFAULT_BRAND, type Brand } from "./types";
import { validateColor, validateFavicon, validateLogo, validateName } from "./validate";
import { COLOR_KEYS } from "./types";

// Configuration EFFECTIVE de marque blanche d'un compte : point d'entrée serveur unique.
//  - le droit = decideWhiteLabel(formule lue dans profiles, brand_entitlements.enabled) ; jamais le navigateur ;
//  - l'identité est celle enregistrée en base, revalidée champ par champ, avec valeurs de remplacement propres ;
//  - perdre le droit ne supprime RIEN : l'identité reste renvoyée, seul `entitled` passe à false
//    (c'est à l'appelant de décider du comportement commercial : mention « Créé avec Décollage », etc.).

export type EffectiveBrand = {
  /** Droit calculé côté serveur (formule ET option). */
  entitled: boolean;
  /** Une ligne brand_configs existe pour ce compte. */
  saved: boolean;
  /** Identité sûre : toujours complète et validée (valeurs par défaut sinon). */
  brand: Brand;
  version: number;
  updatedAt: string | null;
};

type StoredRow = Record<string, unknown> | null | undefined;

/** Identité sûre à partir d'une ligne brand_configs quelconque : champ invalide ou absent -> valeur par défaut. */
export function sanitizeStoredBrand(row: StoredRow): Brand {
  const r = row ?? {};
  const name = validateName(r.name);
  const col = (key: (typeof COLOR_KEYS)[number], column: string) => {
    const c = validateColor(r[column]);
    return c.ok ? c.value : DEFAULT_BRAND[key];
  };
  const logo = r.logo_data == null ? null : validateLogo(r.logo_data);
  const favicon = r.favicon_data == null ? null : validateFavicon(r.favicon_data);
  return {
    name: name.ok ? name.value : DEFAULT_BRAND.name,
    primary: col("primary", "color_primary"),
    secondary: col("secondary", "color_secondary"),
    accent: col("accent", "color_accent"),
    surface: col("surface", "color_surface"),
    text: col("text", "color_text"),
    logo: logo && logo.ok ? logo.value : null,
    favicon: favicon && favicon.ok ? favicon.value : null,
  };
}

/** Cœur pur (testable sans base) : formule + option + ligne enregistrée -> configuration effective. */
export function computeEffectiveBrand(input: { plan: unknown; optionActive: unknown; row: StoredRow }): EffectiveBrand {
  const { row } = input;
  return {
    entitled: decideWhiteLabel(input.plan, input.optionActive),
    saved: Boolean(row),
    brand: sanitizeStoredBrand(row),
    version: typeof row?.version === "number" ? row.version : 0,
    updatedAt: typeof row?.updated_at === "string" ? row.updated_at : null,
  };
}

export type Entitlement = { ok: true; entitled: boolean } | { ok: false };

/** Droit seul (formule + option), lu côté serveur. Erreur de lecture -> { ok: false } (fail-closed pour l'appelant). */
export async function readEntitlement(supabase: SupabaseClient, userId: string): Promise<Entitlement> {
  const [e, p] = await Promise.all([
    supabase.from("brand_entitlements").select("enabled").eq("user_id", userId).maybeSingle(),
    supabase.from("profiles").select("plan").eq("id", userId).maybeSingle(),
  ]);
  if (e.error || p.error) return { ok: false };
  return { ok: true, entitled: decideWhiteLabel((p.data as { plan?: unknown } | null)?.plan, (e.data as { enabled?: unknown } | null)?.enabled) };
}

/**
 * Configuration effective du compte `userId`. L'identifiant doit venir de la session serveur, jamais d'un corps de requête.
 * Renvoie null si une lecture échoue (l'appelant traite comme « droit refusé »).
 */
export async function getEffectiveBrand(supabase: SupabaseClient, userId: string): Promise<EffectiveBrand | null> {
  const [e, p, b] = await Promise.all([
    supabase.from("brand_entitlements").select("enabled").eq("user_id", userId).maybeSingle(),
    supabase.from("profiles").select("plan").eq("id", userId).maybeSingle(),
    supabase.from("brand_configs").select("*").eq("user_id", userId).maybeSingle(),
  ]);
  if (e.error || p.error || b.error) return null;
  return computeEffectiveBrand({
    plan: (p.data as { plan?: unknown } | null)?.plan,
    optionActive: (e.data as { enabled?: unknown } | null)?.enabled,
    row: b.data as StoredRow,
  });
}
