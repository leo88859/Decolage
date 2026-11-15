// Consentement à la liste d'attente d'un site publié. Texte et version partagés par la page publique (landing.ts) et la route
// d'inscription, pour que la version enregistrée en base corresponde toujours au texte réellement affiché.
// Version à changer à CHAQUE modification du texte ci-dessous.
export const WAITLIST_CONSENT_VERSION = "2026-11-15";
/** Nom du champ coché dans le formulaire HTML. */
export const WAITLIST_CONSENT_FIELD = "consentement";

/** Texte de la case à cocher. `nom` = nom du site ou du produit, qui désigne ici l'éditeur à qui l'adresse est destinée. */
export function waitlistConsentText(nom: string): string {
  return `J’accepte que mon adresse e-mail soit transmise à l’éditeur de « ${nom} », propriétaire de ce site. Il la reçoit pour pouvoir me prévenir du lancement de ce produit, et pour rien d’autre. Ce site est hébergé par Décollage, qui ne m’écrit pas.`;
}

/** Vrai seulement si la case a été cochée (valeur envoyée par le navigateur : « oui », « on » ou « 1 »). */
export function hasConsent(raw: unknown): boolean {
  return typeof raw === "string" && ["oui", "on", "1", "true"].includes(raw.trim().toLowerCase());
}
