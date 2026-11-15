import { authorizeOwner, colonne0010Absente, dbError, invalid, json, readJson, sans0010 } from "@/lib/boutique/api";
import { validateBoutique } from "@/lib/boutique/validate";
import { colonneThemeAbsente } from "@/lib/boutique/themes";
import { etatTurnstile } from "@/lib/boutique/turnstile";

// Mes boutiques. Les écritures passent par la session du commerçant : la RLS et les limites de formule de la base s'appliquent.

/** Liste mes boutiques. */
export async function GET(req: Request) {
  const o = await authorizeOwner(req, false);
  if (o instanceof Response) return o;
  const { data, error } = await o.supabase.from("boutiques").select("*").eq("proprietaire_id", o.userId).order("created_at");
  if (error) return json({ error: "Lecture impossible pour le moment.", code: "server" }, 500);
  // État de la protection anti-robot, par boutique (aucune valeur de clé n'est renvoyée).
  const protection = etatTurnstile();
  return json({ boutiques: (data ?? []).map((b) => ({ ...b, protection_anti_robot: protection })) });
}

/** Crée une boutique (brouillon par défaut). Le propriétaire est TOUJOURS celui de la session. */
export async function POST(req: Request) {
  const o = await authorizeOwner(req, true);
  if (o instanceof Response) return o;
  const body = await readJson(req);
  if (!body.ok) return body.res;
  const v = validateBoutique(body.body);
  if (!v.ok) return invalid(v.errors);
  const creer = (champs: typeof v.value) => o.supabase.from("boutiques").insert({ ...champs, proprietaire_id: o.userId }).select("*").single();
  let champs = v.value;
  let { data, error } = await creer(champs);
  // Migration 0009 pas encore exécutée : la boutique est créée sans le thème (elle reste en thème classique).
  if (colonneThemeAbsente(error)) {
    const sansTheme = { ...champs };
    delete sansTheme.theme;
    champs = sansTheme;
    ({ data, error } = await creer(champs));
  }
  // Migration 0010 pas encore exécutée : la boutique est créée sans les réglages d'expiration (48 h et 10 par article par défaut).
  if (colonne0010Absente(error)) {
    champs = sans0010(champs);
    ({ data, error } = await creer(champs));
  }
  if (error) return dbError(error);
  return json({ boutique: data }, 201);
}
