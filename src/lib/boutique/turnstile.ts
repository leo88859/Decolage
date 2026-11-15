// Cloudflare Turnstile (anti-robot, facultatif) : vérification du jeton CÔTÉ SERVEUR.
//
// Variables d'environnement (aucune valeur dans le dépôt) :
//   NEXT_PUBLIC_TURNSTILE_SITE_KEY : clé publique du widget (navigateur).
//   TURNSTILE_SECRET_KEY           : clé secrète de vérification (serveur uniquement, jamais envoyée au navigateur).
//
// Trois états possibles, décidés UNIQUEMENT par la présence des deux clés :
//   - AUCUNE clé     : protection désactivée (facultative). La commande passe sans jeton. C'est le comportement local.
//   - DEUX clés      : protection active. Jeton absent = refus, jeton invalide ou expiré = refus,
//                      Cloudflare indisponible = refus temporaire (503). Jamais de passage non vérifié.
//   - UNE SEULE clé  : CONFIGURATION INCOMPLÈTE. Les commandes sont bloquées (erreur 500 « configuration_turnstile »).
//                      Une seule clé ne doit JAMAIS laisser croire que la protection est active alors qu'elle ne vérifie rien
//                      (clé publique seule : widget affiché, vérification ignorée ; clé secrète seule : widget absent, toutes les
//                      commandes refusées sans explication).

const VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";
const TIMEOUT_MS = 5000;
const TOKEN_MAX = 2048; // longueur maximale documentée d'un jeton Turnstile

export type EtatTurnstile = "desactive" | "actif" | "configuration_incomplete";

export type TurnstileResult =
  | { ok: true; skipped: boolean }
  | { ok: false; reason: "absent" | "invalide" | "indisponible" | "configuration" };

/** État de la protection, selon la présence des deux clés. Aucune valeur de clé n'est renvoyée. */
export function etatTurnstile(env: NodeJS.ProcessEnv = process.env): EtatTurnstile {
  const secret = Boolean(env.TURNSTILE_SECRET_KEY?.trim());
  const publique = Boolean(env.NEXT_PUBLIC_TURNSTILE_SITE_KEY?.trim());
  if (!secret && !publique) return "desactive";
  if (secret && publique) return "actif";
  return "configuration_incomplete";
}

/** true seulement quand les DEUX clés sont présentes (protection réellement active). */
export const turnstileActif = (): boolean => etatTurnstile() === "actif";

export async function verifierTurnstile(token: unknown, ip: string, fetchImpl: typeof fetch = fetch): Promise<TurnstileResult> {
  const etat = etatTurnstile();
  if (etat === "desactive") return { ok: true, skipped: true };
  if (etat === "configuration_incomplete") return { ok: false, reason: "configuration" };
  const secret = process.env.TURNSTILE_SECRET_KEY!.trim();
  if (typeof token !== "string" || token.trim() === "") return { ok: false, reason: "absent" };
  if (token.length > TOKEN_MAX) return { ok: false, reason: "invalide" };
  const form = new URLSearchParams({ secret, response: token });
  if (ip && ip !== "local") form.set("remoteip", ip);
  try {
    const res = await fetchImpl(VERIFY_URL, { method: "POST", body: form, signal: AbortSignal.timeout(TIMEOUT_MS) });
    if (!res.ok) return { ok: false, reason: "indisponible" };
    const data = (await res.json().catch(() => null)) as { success?: unknown; "error-codes"?: unknown } | null;
    if (data?.success === true) return { ok: true, skipped: false };
    // Erreurs de configuration ou de service chez Cloudflare : refus temporaire plutôt qu'un jeton déclaré « invalide ».
    const codes = Array.isArray(data?.["error-codes"]) ? (data!["error-codes"] as unknown[]) : [];
    if (codes.some((c) => c === "internal-error" || c === "missing-input-secret" || c === "invalid-input-secret")) return { ok: false, reason: "indisponible" };
    // Jeton expiré ou déjà utilisé (timeout-or-duplicate), jeton incorrect : refus de CE jeton.
    return { ok: false, reason: "invalide" };
  } catch {
    return { ok: false, reason: "indisponible" };
  }
}
