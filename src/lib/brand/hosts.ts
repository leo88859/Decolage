// Résolution d'un nom d'hôte vers une marque (domaines personnalisés).
// Fonction PURE, testée, et NON BRANCHÉE : proxy.ts ne l'appelle pas. Voir docs/DOMAINES-PERSONNALISES.md.

export type BrandDomainRow = { host: string; user_id: string; verified: boolean; active: boolean };

/**
 * Normalise l'en-tête Host : minuscules, sans port, sans point final.
 * Renvoie null si ce n'est pas un nom de domaine ASCII plausible (adresse IP, caractères
 * inattendus, liste d'hôtes, étiquette vide ou trop longue). Les domaines internationaux
 * doivent être fournis en punycode (xn--...).
 */
export function normalizeHost(raw: string | null | undefined): string | null {
  if (typeof raw !== "string") return null;
  let h = raw.trim().toLowerCase();
  if (!h || h.length > 260) return null;
  if (h.startsWith("[")) return null; // IPv6
  h = h.replace(/:\d{1,5}$/, "").replace(/\.$/, "");
  if (!h || h.length > 253) return null;
  if (!/^[a-z0-9.-]+$/.test(h)) return null;
  const labels = h.split(".");
  if (labels.length < 2) return null;
  if (labels.some((l) => l.length < 1 || l.length > 63 || l.startsWith("-") || l.endsWith("-"))) return null;
  if (/^\d+$/.test(labels[labels.length - 1]!)) return null; // adresse IPv4
  return h;
}

/** Retourne la ligne du domaine seulement s'il est vérifié ET actif ; sinon null (aucun repli). */
export function resolveBrandFromHost(host: string | null | undefined, table: readonly BrandDomainRow[]): BrandDomainRow | null {
  const h = normalizeHost(host);
  if (!h) return null;
  const row = table.find((r) => normalizeHost(r.host) === h);
  return row && row.verified === true && row.active === true ? row : null;
}
