// Montants de la boutique : toujours en centimes ENTIERS (jamais de nombre à virgule), en euros à l'affichage seulement.

export const PRIX_MAX_CENTIMES = 99_999_999; // ~ 1 million d'euros : même plafond que la base
export const QUANTITE_MAX = 99;

export const isCentimes = (n: unknown): n is number => typeof n === "number" && Number.isInteger(n) && n >= 0 && n <= PRIX_MAX_CENTIMES;

/** « 12,50 » ou « 12.5 » ou « 12 » -> 1250. Renvoie null si ce n'est pas un montant valide (2 décimales au plus). */
export function eurosEnCentimes(saisie: string): number | null {
  const m = /^(\d{1,8})(?:[.,](\d{1,2}))?$/.exec(saisie.trim());
  if (!m) return null;
  const c = Number(m[1]) * 100 + Number((m[2] ?? "").padEnd(2, "0") || 0);
  return isCentimes(c) ? c : null;
}

/** 1250 -> « 12,50 € » (espace insécable avant le symbole, comme Intl en français). */
export function formatEuros(centimes: number): string {
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(centimes / 100);
}

export type LigneCalcul = { prix_unitaire_centimes: number; quantite: number };

/** Total d'un panier en centimes (estimation d'affichage : le vrai total est recalculé par la base à la commande). */
export function totalCentimes(lignes: readonly LigneCalcul[]): number {
  return lignes.reduce((s, l) => s + l.prix_unitaire_centimes * l.quantite, 0);
}
