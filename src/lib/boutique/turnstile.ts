// Cloudflare Turnstile (anti-robot, facultatif) : vérification du jeton CÔTÉ SERVEUR.
//
// Variables d'environnement (aucune valeur dans le dépôt) :
//   NEXT_PUBLIC_TURNSTILE_SITE_KEY : clé publique du widget (navigateur).
//   TURNSTILE_SECRET_KEY           : clé secrète de vérification (serveur uniquement, jamais envoyée au navigateur).
//
// Comportement :
//   - Turnstile est ACTIVÉ dès que TURNSTILE_SECRET_KEY est défini. Alors : jeton absent = refus, jeton invalide = refus,
//     jeton valide = autorisé, service Cloudflare injoignable ou en erreur = refus temporaire (on ne laisse jamais passer
//     une commande non vérifiée quand la protection est demandée).
//   - NON CONFIGURÉ (pas de clé secrète) : la vérification est ignorée, la commande est acceptée sans jeton. C'est le
//     comportement local/développement ; les autres limites (IP, contact, champ piège) restent actives.
//   - Les DEUX clés sont nécessaires : sans clé publique, le widget ne s'affiche pas et toutes les commandes seraient refusées (jeton absent).

const VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";
const TIMEOUT_MS = 5000;
const TOKEN_MAX = 2048; // longueur maximale documentée d'un jeton Turnstile

export type TurnstileResult =
  | { ok: true; skipped: boolean }
  | { ok: false; reason: "absent" | "invalide" | "indisponible" };

export const turnstileActif = (): boolean => Boolean(process.env.TURNSTILE_SECRET_KEY?.trim());

export async function verifierTurnstile(token: unknown, ip: string, fetchImpl: typeof fetch = fetch): Promise<TurnstileResult> {
  const secret = process.env.TURNSTILE_SECRET_KEY?.trim();
  if (!secret) return { ok: true, skipped: true };
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
    return { ok: false, reason: "invalide" };
  } catch {
    return { ok: false, reason: "indisponible" };
  }
}
