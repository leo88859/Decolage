import { appUrl } from "@/lib/env";

// Contrôle d'origine commun (défense CSRF) pour les routes d'écriture authentifiées par cookies.
// Règle : méthode non sûre (POST, PUT, PATCH, DELETE) => l'en-tête Origin (ou, à défaut, l'origine du Referer)
// doit être celle de l'application : adresse de la requête elle-même ou NEXT_PUBLIC_APP_URL (localhost par défaut en dev).
// Origin « null » ou absent ET Referer absent : refus. Les URL de prévisualisation Vercel ne sont PAS acceptées
// (aucune route ne les accepte aujourd'hui). Exclus volontairement : webhook Stripe (signature) et waitlist publique.
// Les routes /api/boutique et /api/brand gardent leur propre copie (même règle sans repli Referer) : voir docs/LIMITES-SERVEUR.md.

const UNSAFE = new Set(["POST", "PUT", "PATCH", "DELETE"]);

function toOrigin(value: string | null): string | null {
  if (!value || value === "null") return null;
  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
}

/** Vrai si la requête vient bien de notre propre application. */
export function originOk(req: Request): boolean {
  const candidate = req.headers.get("origin") !== null ? toOrigin(req.headers.get("origin")) : toOrigin(req.headers.get("referer"));
  if (!candidate) return false;
  const allowed = new Set<string>();
  const own = toOrigin(req.url);
  if (own) allowed.add(own);
  const configured = toOrigin(appUrl());
  if (configured) allowed.add(configured);
  return allowed.has(candidate);
}

/** Réponse 403 à renvoyer si une écriture ne vient pas de notre application ; null sinon (méthodes sûres : toujours null). */
export function originGuard(req: Request): Response | null {
  if (!UNSAFE.has(req.method.toUpperCase())) return null;
  if (originOk(req)) return null;
  return Response.json({ error: "Requête refusée (origine inattendue).", code: "origin" }, { status: 403, headers: { "cache-control": "no-store" } });
}
