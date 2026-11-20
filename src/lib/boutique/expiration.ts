import { DELAI_EXPIRATION_DEFAUT_H, DELAI_EXPIRATION_MAX_H, DELAI_EXPIRATION_MIN_H, QUANTITE_ARTICLE_DEFAUT, QUANTITE_MAX } from "./money";

// Calculs purs (testés) d'expiration des commandes « nouvelle » : mêmes règles que la base (migration 0010).
// L'heure d'expiration = date de création + délai ACTUEL de la boutique (la base utilise aussi le délai actuel au moment du passage).

/** Délai valide en heures (6 à 168), sinon 48 : une boutique sans la migration 0010 n'a pas de colonne. */
export function delaiValide(h: unknown): number {
  return typeof h === "number" && Number.isInteger(h) && h >= DELAI_EXPIRATION_MIN_H && h <= DELAI_EXPIRATION_MAX_H ? h : DELAI_EXPIRATION_DEFAUT_H;
}
/** Quantité maximale par article (1 à 99), sinon 10. */
export function quantiteMaxValide(q: unknown): number {
  return typeof q === "number" && Number.isInteger(q) && q >= 1 && q <= QUANTITE_MAX ? q : QUANTITE_ARTICLE_DEFAUT;
}

/** Date d'expiration d'une commande (ISO), ou null si la date de création est illisible. */
export function dateExpiration(createdAtIso: string, delaiH: unknown): string | null {
  const t = Date.parse(createdAtIso);
  return Number.isNaN(t) ? null : new Date(t + delaiValide(delaiH) * 3_600_000).toISOString();
}

/** Millisecondes restantes (négatif = déjà dépassée, en attente du prochain passage de la planification). */
export function restantMs(createdAtIso: string, delaiH: unknown, maintenant: number): number | null {
  const e = dateExpiration(createdAtIso, delaiH);
  return e === null ? null : Date.parse(e) - maintenant;
}

/** « 2 j 3 h », « 5 h 20 min », « 12 min », « expirée (annulation au prochain passage) ». Estimation arrondie à la minute. */
export function tempsRestantLabel(ms: number | null): string {
  if (ms === null) return "Date inconnue";
  if (ms <= 0) return "Expirée : annulation au prochain passage automatique";
  const min = Math.max(1, Math.ceil(ms / 60_000));
  const j = Math.floor(min / 1440);
  const h = Math.floor((min % 1440) / 60);
  const m = min % 60;
  if (j > 0) return `${j} j ${h} h`;
  if (h > 0) return `${h} h ${String(m).padStart(2, "0")} min`;
  return `${m} min`;
}

/** Message affiché à l'acheteur (délai réel de la boutique). */
export const texteExpirationAcheteur = (delaiH: unknown): string =>
  `Sans confirmation de la boutique sous ${delaiValide(delaiH)} heures, ta commande sera automatiquement annulée.`;
