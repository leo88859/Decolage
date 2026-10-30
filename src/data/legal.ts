// Informations légales de l'éditeur, utilisées par les pages légales, le pied de page et le contact.
//
// RÈGLE : rien n'est inventé. Un champ laissé vide ("") s'affiche « à compléter » sur les pages
// (composant V) et apparaît dans le bandeau « éléments à compléter avant publication ».
// Remplis ces champs avec les vraies informations de l'éditeur avant d'ouvrir les ventes au public ;
// le bandeau disparaît tout seul quand tout est rempli.

export const LEGAL = {
  /** Nom commercial du service. */
  marque: "Décollage",
  /** Éditeur : prénom et nom de l'entrepreneur individuel (ou raison sociale). À COMPLÉTER. */
  editeur: "Léoedition",
  /** Statut juridique, par ex. « Entrepreneur individuel (EI) ». À COMPLÉTER (à confirmer). */
  statut: "",
  /** Numéro SIRET (ou SIREN) ; laisser vide tant que l'immatriculation n'est pas confirmée. À COMPLÉTER. */
  siret: "",
  /** Adresse postale (domicile ou domiciliation commerciale). À COMPLÉTER. */
  adresse: "123 Rue de l'Exemple, 75000 Paris, France",
  /** Adresse e-mail de contact dédiée. À COMPLÉTER. */
  email: "leo2roub@gmail.com",
  /** Numéro de téléphone (à vérifier : semble requis pour un éditeur professionnel). À COMPLÉTER. */
  telephone: "",
  /** Directeur de la publication (prénom et nom). À COMPLÉTER. */
  directeurPublication: "",
  /** Contact du support (e-mail ou page). À COMPLÉTER ; à défaut, l'adresse e-mail ci-dessus est utilisée. */
  contactSupport: "",
  /** Adresse du site. Vide tant qu'elle n'est pas confirmée (voir PROPOSITIONS.site). */
  site: "https://decollage.vercel.app",
  /** Mention de TVA. Vide tant qu'elle n'est pas confirmée (voir PROPOSITIONS.tva). */
  tva: "",
  /** Médiateur de la consommation (obligatoire pour vendre à des particuliers) : nom et site. À COMPLÉTER. */
  mediateur: { nom: "", site: "" },
  /** Hébergeur. Nom et site viennent du code (déploiement Vercel) ; l'adresse est à confirmer (PROPOSITIONS). */
  hebergeur: { nom: "Vercel Inc.", site: "https://vercel.com", adresse: "" },
};

/**
 * Valeurs PROPOSÉES, non confirmées : elles s'affichent toujours avec la mention « à confirmer »
 * (composant P). Pour les valider, recopie-les dans LEGAL.
 */
export const PROPOSITIONS = {
  site: "https://decollage.vercel.app",
  /** Valable seulement si l'éditeur est en franchise en base de TVA (micro-entreprise sous le seuil). */
  tva: "TVA non applicable, art. 293 B du CGI",
  /** Adresse de Vercel Inc. trouvée dans l'ancienne version du site, non revérifiée. */
  hebergeurAdresse: "440 N Barranca Ave #4133, Covina, CA 91723, États-Unis",
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

export type ChampManquant = { cle: string; label: string; pages: string; note?: string };

/** Contact effectif du support : l'adresse dédiée si elle existe, sinon l'e-mail de l'éditeur. */
export const supportContact = () => LEGAL.contactSupport || LEGAL.email;

/**
 * Liste des éléments encore à compléter avant publication. Vide quand tout est renseigné
 * (le bandeau n'est alors pas affiché). Rien n'est inventé : on liste seulement ce qui manque.
 */
export function champsManquants(l: typeof LEGAL = LEGAL): ChampManquant[] {
  const liste: ChampManquant[] = [];
  const ajoute = (ok: boolean, cle: string, label: string, pages: string, note?: string) => { if (!ok) liste.push({ cle, label, pages, note }); };
  ajoute(!!l.editeur, "editeur", "Prénom et nom (ou raison sociale) de l'éditeur", "Mentions légales, CGV, Confidentialité");
  ajoute(!!l.statut, "statut", "Statut juridique", "Mentions légales, CGV", "à confirmer, par ex. entrepreneur individuel");
  ajoute(!!l.siret, "siret", "Numéro SIRET", "Mentions légales, CGV", "seulement une fois l'immatriculation confirmée");
  ajoute(!!l.adresse, "adresse", "Adresse postale (domicile ou domiciliation)", "Mentions légales, CGV, Contact");
  ajoute(!!l.email, "email", "Adresse e-mail de contact", "Toutes les pages légales, Contact");
  ajoute(!!l.telephone, "telephone", "Numéro de téléphone", "Mentions légales, Contact", "à vérifier : semble requis pour un éditeur professionnel");
  ajoute(!!l.directeurPublication, "directeurPublication", "Directeur de la publication", "Mentions légales");
  ajoute(!!(l.contactSupport || l.email), "contactSupport", "Contact du support", "Contact, Remboursement");
  ajoute(!!l.site, "site", "Adresse officielle du site", "Mentions légales, CGU, CGV", `proposition : ${PROPOSITIONS.site}`);
  ajoute(!!l.tva, "tva", "Mention de TVA", "Mentions légales, CGV", `proposition : ${PROPOSITIONS.tva} (seulement si franchise en base)`);
  ajoute(!!l.mediateur.nom, "mediateur", "Médiateur de la consommation (nom et site)", "CGV, Remboursement");
  ajoute(!!l.hebergeur.adresse, "hebergeurAdresse", "Adresse de l'hébergeur", "Mentions légales", `proposition : ${PROPOSITIONS.hebergeurAdresse}`);
  return liste;
}

/** Liens produit du pied de page (routes existantes, vérifiées par un test). */
export const FOOTER_PRODUCT_LINKS = [
  { href: "/creer", label: "Créer" },
  { href: "/#offres", label: "Offres" },
  { href: "/idees", label: "Idées" },
  { href: "/guide", label: "Guide" },
  { href: "/tableau-de-bord", label: "Mes projets" },
] as const;
