import { appUrl } from "@/lib/env";

// Contrôle d'origine commun (défense CSRF) pour toutes les routes d'écriture authentifiées par cookies
// (/api/sites, /api/account, /api/stripe/*, /api/legal/accept, /api/boutique/**, /api/brand/**). Voir docs/CONTROLE-ORIGINE.md.
//
// Règle : méthode non sûre (POST, PUT, PATCH, DELETE) => l'en-tête Origin doit être EXACTEMENT une origine autorisée.
//  - Origine autorisée = adresse de la requête elle-même, NEXT_PUBLIC_APP_URL, puis (facultatif) la liste blanche
//    ALLOWED_ORIGINS et le motif d'aperçus Vercel ALLOWED_VERCEL_PREVIEW (voir plus bas). Rien d'autre.
//  - Origin « null » ou illisible : refus. Origin absent : repli sur l'origine du Referer, SAUF si `referer: false`
//    (routes boutique et marque blanche, historiquement plus strictes).
//  - Comparaison de l'origine entière (schéma + hôte + port) : jamais de comparaison partielle ni de suffixe libre.
// Exclus volontairement : webhook Stripe (signature) et waitlist publique.

const UNSAFE = new Set(["POST", "PUT", "PATCH", "DELETE"]);

function toOrigin(value: string | null): string | null {
  if (!value || value === "null") return null;
  try {
    const o = new URL(value).origin;
    return o === "null" ? null : o;
  } catch {
    return null;
  }
}

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);

/**
 * Liste blanche d'origines EXACTES (séparées par des virgules). Chaque entrée doit être de la forme `https://hote[:port]`
 * (http seulement pour localhost / 127.0.0.1 / [::1]), sans chemin, sans identifiants, sans joker. Les entrées invalides sont ignorées
 * (jamais acceptées « à peu près »).
 */
export function parseAllowedOrigins(raw: string | undefined | null): { origins: string[]; ignored: string[] } {
  const origins: string[] = [];
  const ignored: string[] = [];
  for (const part of (raw ?? "").split(",")) {
    const entry = part.trim();
    if (!entry) continue;
    let ok = false;
    if (!entry.includes("*")) {
      try {
        const u = new URL(entry);
        const secure = u.protocol === "https:" || (u.protocol === "http:" && LOCAL_HOSTS.has(u.hostname));
        ok = secure && !u.username && !u.password && entry === u.origin && u.hostname.length > 0;
      } catch {
        ok = false;
      }
    }
    if (ok) origins.push(entry);
    else ignored.push(entry);
  }
  return { origins, ignored };
}

/**
 * Motif d'aperçus Vercel, DÉSACTIVÉ par défaut. Forme exigée : `projet-*-equipe.vercel.app` (un seul joker, entouré de tirets,
 * avec un préfixe ET un suffixe d'équipe littéraux). `projet-*.vercel.app` est REFUSÉ : n'importe qui peut créer un projet Vercel
 * nommé `projet-xxx` dans son propre compte. Le nom du projet et le nom d'équipe réels sont à valider dans Vercel, pas à deviner.
 * Renvoie null si le motif est absent ou invalide (=> aucun aperçu accepté).
 */
export function parsePreviewPattern(raw: string | undefined | null): { prefix: string; suffix: string } | null {
  const v = (raw ?? "").trim().toLowerCase();
  const m = /^([a-z0-9]+(?:-[a-z0-9]+)*)-\*-([a-z0-9]+(?:-[a-z0-9]+)*)\.vercel\.app$/.exec(v);
  if (!m) return null;
  return { prefix: m[1], suffix: m[2] };
}

/** Vrai si `origin` est EXACTEMENT `https://<prefix>-<milieu>-<suffix>.vercel.app` (un seul libellé de domaine, pas de port). */
export function matchesPreview(origin: string, pattern: { prefix: string; suffix: string } | null): boolean {
  if (!pattern) return false;
  let u: URL;
  try {
    u = new URL(origin);
  } catch {
    return false;
  }
  if (u.protocol !== "https:" || u.port || u.username || u.password || origin !== u.origin) return false;
  if (!u.hostname.endsWith(".vercel.app")) return false;
  const label = u.hostname.slice(0, -".vercel.app".length);
  if (label.length > 63 || label.includes(".")) return false;
  const head = `${pattern.prefix}-`;
  const tail = `-${pattern.suffix}`;
  if (!label.startsWith(head) || !label.endsWith(tail) || label.length <= head.length + tail.length) return false;
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(label.slice(head.length, label.length - tail.length));
}

const warned = new Set<string>();
function warnOnce(key: string, message: string) {
  if (warned.has(key)) return;
  warned.add(key);
  console.warn(message);
}

/** Vrai si la requête vient bien de notre application (ou d'une origine explicitement autorisée par la configuration). */
export function originOk(req: Request, options: { referer?: boolean } = {}): boolean {
  const originHeader = req.headers.get("origin");
  let candidate: string | null;
  if (originHeader !== null) {
    // En-tête Origin : exactement une origine (les navigateurs n'y ajoutent ni chemin ni « / » final).
    candidate = toOrigin(originHeader);
    if (candidate !== originHeader) return false;
  } else if (options.referer !== false) {
    candidate = toOrigin(req.headers.get("referer"));
  } else {
    return false;
  }
  if (!candidate) return false;
  const own = toOrigin(req.url);
  if (own && candidate === own) return true;
  const configured = toOrigin(appUrl());
  if (configured && candidate === configured) return true;

  const list = parseAllowedOrigins(process.env.ALLOWED_ORIGINS);
  for (const bad of list.ignored) warnOnce(`o:${bad}`, `[origine] ALLOWED_ORIGINS : entrée ignorée (https://hote[:port] exact attendu) : ${bad}`);
  if (list.origins.includes(candidate)) return true;

  const rawPreview = process.env.ALLOWED_VERCEL_PREVIEW;
  const pattern = parsePreviewPattern(rawPreview);
  if (rawPreview?.trim() && !pattern) warnOnce(`p:${rawPreview}`, "[origine] ALLOWED_VERCEL_PREVIEW ignoré : forme attendue « projet-*-equipe.vercel.app »");
  return matchesPreview(candidate, pattern);
}

/** Réponse 403 à renvoyer si une écriture ne vient pas de notre application ; null sinon (méthodes sûres : toujours null). */
export function originGuard(req: Request, options: { referer?: boolean } = {}): Response | null {
  if (!UNSAFE.has(req.method.toUpperCase())) return null;
  if (originOk(req, options)) return null;
  return Response.json({ error: "Requête refusée (origine inattendue).", code: "origin" }, { status: 403, headers: { "cache-control": "no-store" } });
}
