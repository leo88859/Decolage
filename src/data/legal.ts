// Informations légales de l'éditeur, utilisées par les pages légales, le pied de page et le contact.
//
// RÈGLE : rien n'est inventé. Un champ laissé vide ("") n'est tout simplement pas affiché sur les pages.
// Remplis ces champs avec les vraies informations de l'éditeur : elles apparaissent alors toutes seules.

export const LEGAL = {
  /** Nom commercial du service. */
  marque: "Décollage",
  /** Éditeur : prénom et nom de l'entrepreneur individuel (ou raison sociale). */
  editeur: "Léoedition",
  /** Statut juridique, par ex. « Entrepreneur individuel (EI) ». */
  statut: "",
  /** Numéro SIRET (ou SIREN) ; laisser vide tant que l'immatriculation n'est pas confirmée. */
  siret: "",
  /** Adresse postale (domicile ou domiciliation commerciale). */
  adresse: "123 Rue de l'Exemple, 75000 Paris, France",
  /** Adresse e-mail de contact dédiée. */
  email: "leo2roub@gmail.com",
  /** Numéro de téléphone (à vérifier : semble requis pour un éditeur professionnel). */
  telephone: "",
  /** Directeur de la publication (prénom et nom). */
  directeurPublication: "",
  /** Contact du support (e-mail ou page). À défaut, l'adresse e-mail ci-dessus est utilisée. */
  contactSupport: "",
  /** Adresse du site. */
  site: "https://decollage.vercel.app",
  /** Mention de TVA. */
  tva: "",
  /** Médiateur de la consommation (obligatoire pour vendre à des particuliers) : nom et site. */
  mediateur: { nom: "", site: "" },
  /** Hébergeur. Nom et site viennent du code (déploiement Vercel) ; l'adresse n'est affichée que si elle est renseignée. */
  hebergeur: { nom: "Vercel Inc.", site: "https://vercel.com", adresse: "" },
};

/** Les pages légales, dans l'ordre d'affichage (navigation, pied de page, Paramètres, tests). */
export const LEGAL_PAGES = [
  { href: "/mentions-legales", label: "Mentions légales", doc: "mentions" },
  { href: "/confidentialite", label: "Confidentialité", doc: "confidentialite" },
  { href: "/cookies", label: "Cookies", doc: "cookies" },
  { href: "/cgu", label: "Conditions d'utilisation", doc: "cgu" },
  { href: "/cgv", label: "Conditions de vente", doc: "cgv" },
  { href: "/remboursement", label: "Remboursement", doc: "remboursement" },
  { href: "/accessibilite", label: "Accessibilité", doc: "accessibilite" },
  { href: "/contact", label: "Contact", doc: "contact" },
] as const;

export type LegalDoc = (typeof LEGAL_PAGES)[number]["doc"];

/**
 * Version de chaque document : une date au format AAAA-MM-JJ, à changer à chaque modification de fond.
 * (Sert à afficher la date de mise à jour et à retrouver quelle version une personne a acceptée.)
 */
export const VERSIONS: Record<LegalDoc, string> = {
  mentions: "2026-10-29",
  confidentialite: "2026-10-29",
  cookies: "2026-10-29",
  cgu: "2026-10-29",
  cgv: "2026-10-29",
  remboursement: "2026-10-29",
  accessibilite: "2026-10-29",
  contact: "2026-10-29",
};

const MOIS = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];
/** « 2026-10-29 » devient « 29 octobre 2026 ». */
export function dateFr(iso: string): string {
  const [a, m, j] = iso.split("-").map(Number);
  return `${j === 1 ? "1er" : j} ${MOIS[m - 1]} ${a}`;
}

/** Contact effectif du support : l'adresse dédiée si elle existe, sinon l'e-mail de l'éditeur. */
export const supportContact = () => LEGAL.contactSupport || LEGAL.email;

/** Liens produit du pied de page (routes existantes, vérifiées par un test). */
export const FOOTER_PRODUCT_LINKS = [
  { href: "/creer", label: "Créer" },
  { href: "/#offres", label: "Offres" },
  { href: "/idees", label: "Idées" },
  { href: "/guide", label: "Guide" },
  { href: "/tableau-de-bord", label: "Mes projets" },
] as const;
