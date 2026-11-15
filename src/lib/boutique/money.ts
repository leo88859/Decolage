// Montants de la boutique : toujours en centimes ENTIERS (jamais de nombre à virgule), en euros à l'affichage seulement.

export const PRIX_MAX_CENTIMES = 99_999_999; // ~ 1 million d'euros : même plafond que la base
export const QUANTITE_MAX = 99;
/** Articles au total dans une commande (miroir de la base, migration 0010). */
export const QUANTITE_TOTALE_MAX = 50;
/** Quantité par article : 10 par défaut, réglable par la boutique jusqu'à QUANTITE_MAX (migration 0010). */
export const QUANTITE_ARTICLE_DEFAUT = 10;
/** Commandes « nouvelle » en attente par contact, et simultanées par boutique (migration 0010). */
export const COMMANDES_ATTENTE_CONTACT_MAX = 2;
export const COMMANDES_NOUVELLES_BOUTIQUE_MAX = 50;
/** Commandes par adresse IP (route API, limite partagée en base). */
export const COMMANDES_IP_MINUTE_MAX = 3;
export const COMMANDES_IP_HEURE_MAX = 10;
/** Délai avant annulation automatique d'une commande « nouvelle » : heures, 48 par défaut (migration 0010, CHECK 6 à 168). */
export const DELAI_EXPIRATION_DEFAUT_H = 48;
export const DELAI_EXPIRATION_MIN_H = 6;
export const DELAI_EXPIRATION_MAX_H = 168;

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
