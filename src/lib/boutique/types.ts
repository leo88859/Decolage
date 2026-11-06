// Types de la boutique V1 (réponses de l'API /api/boutique). Les noms de champs sont ceux des colonnes SQL.

export const MODES = ["retrait", "livraison", "contact"] as const;
export type Mode = (typeof MODES)[number];

export const STATUTS_BOUTIQUE = ["brouillon", "publiee"] as const;
export type StatutBoutique = (typeof STATUTS_BOUTIQUE)[number];

export const STATUTS_COMMANDE = ["nouvelle", "confirmee", "prete", "terminee", "annulee"] as const;
export type StatutCommande = (typeof STATUTS_COMMANDE)[number];

/** Passages autorisés (miroir du trigger SQL commande_transition ; la base reste l'autorité). */
export const TRANSITIONS: Record<StatutCommande, readonly StatutCommande[]> = {
  nouvelle: ["confirmee", "annulee"],
  confirmee: ["prete", "annulee"],
  prete: ["terminee", "annulee"],
  terminee: [],
  annulee: [],
};

export const STATUT_LABEL: Record<StatutCommande, string> = {
  nouvelle: "Nouvelle", confirmee: "Confirmée", prete: "Prête", terminee: "Terminée", annulee: "Annulée",
};
/** Le paiement n'a pas lieu en ligne : une commande n'est JAMAIS « payée » dans cette version. */
export const PAIEMENT_LABEL = "Non payée (commande sans paiement en ligne)";

export type Boutique = {
  id: string;
  slug: string;
  nom: string;
  description: string;
  couleur_principale: string;
  couleur_accent: string;
  logo: string | null;
  adresse: string;
  whatsapp: string | null;
  email: string | null;
  telephone: string | null;
  modes: Mode[];
  statut: StatutBoutique;
  published_at: string | null;
  /** Thème de la vitrine (migration 0009 ; absent avant elle = « classique »). */
  theme?: string;
  /** Posé par le serveur quand la formule ne permet plus de garder la boutique en ligne (migration 0006). */
  suspended_at?: string | null;
  created_at: string;
  updated_at: string;
};
export type Categorie = { id: string; boutique_id: string; nom: string; position: number };
export type Variante = { id: string; produit_id: string; nom: string; stock: number; actif: boolean; position: number };
export type Produit = {
  id: string;
  boutique_id: string;
  categorie_id: string | null;
  titre: string;
  description: string;
  prix_centimes: number;
  images: string[];
  actif: boolean;
  position: number;
  variantes: Variante[];
};
export type LigneCommande = { produit_titre: string; variante_nom: string; prix_unitaire_centimes: number; quantite: number };
export type Commande = {
  id: string;
  ref: string;
  boutique_id: string;
  client_nom: string;
  client_email: string | null;
  client_telephone: string | null;
  adresse_livraison: string;
  note: string;
  mode: Mode;
  statut: StatutCommande;
  total_centimes: number;
  paiement: "non_payee";
  created_at: string;
  lignes_commande: LigneCommande[];
};
