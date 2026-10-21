// Modèle de données de Décollage. Tout est déterministe : aucune donnée n'est générée par une IA.

export type CategoryId =
  | "productivite" | "createurs" | "etudiants" | "ecommerce" | "freelances" | "pme"
  | "marketing" | "finance" | "organisation" | "education" | "pro" | "local";

export type Audience = "particuliers" | "etudiants" | "createurs" | "freelances" | "entreprises" | "associations";
export type Revenue = "gratuit" | "abonnement" | "paiement-unique" | "freemium" | "commission";
export type TechLevel = "no-code" | "low-code" | "code";
export type Budget = 0 | 1 | 2; // 0 : moins de 50 €, 1 : 50–300 €, 2 : plus de 300 €
export type Difficulty = 1 | 2 | 3;

export type TemplateId =
  | "rendez-vous" | "abonnement" | "annuaire" | "liste-attente" | "boutique" | "reservations"
  | "suivi-gains" | "crm" | "taches" | "formation" | "ressources" | "documents"
  | "projets" | "portail-client" | "formulaires" | "tickets";

export type ModuleId =
  | "auth" | "profil" | "formulaires" | "dashboard" | "recherche" | "detail" | "favoris" | "donnees"
  | "abonnement" | "facturation" | "notifications" | "parametres" | "admin" | "export-csv"
  | "graphiques" | "historique" | "acces-libre";

export type Idea = {
  id: string;
  nom: string;
  categorie: CategoryId;
  description: string;
  probleme: string;
  cible: string;
  public: Audience;
  exemple: string;
  modele: Revenue;
  mvp: string[];
  difficulte: Difficulty;
  semaines: number; // temps de construction indicatif
  budget: Budget;
  competences: string[];
  niveau: TechLevel;
  risques: string[];
  concurrence: string;
  validation: string;
  template: TemplateId;
};

export type PageKind =
  | "dashboard" | "liste" | "tableau" | "calendrier" | "kanban" | "grille" | "formulaire" | "detail"
  | "connexion" | "profil" | "tarifs" | "facturation" | "parametres" | "admin" | "graphique"
  | "historique" | "notifications" | "cours" | "editeur" | "accueil"
  | "panier" | "mois" | "waitlist" | "objectifs" | "relances" | "timeline" | "certificat" | "conversation" | "resultats" | "carte";

/** Pages des architectures (src/data/archetypes.ts) : site public et écrans de l'espace utilisateur. */
export type ArchPageKind =
  | "site-home" | "site-features" | "site-pricing" | "site-login" | "site-signup"
  | "ws-list" | "ws-board" | "ws-timeline" | "fi-overview" | "fi-ledger" | "fi-analysis" | "fi-goals"
  | "le-courses" | "le-player" | "le-cards" | "le-progress" | "crm-split" | "crm-pipeline" | "crm-followup"
  | "st-library" | "st-editor" | "co-products" | "co-orders" | "co-sales" | "settings";

export type PageDef = { id: string; titre: string; kind: PageKind | ArchPageKind; nav: boolean };

/** Types de pages qu'une idée peut ajouter à n'importe quel modèle (ils fonctionnent avec toutes les données). */
export type ExtraKind = "carte" | "conversation" | "mois" | "kanban" | "relances";

export type ModuleDef = {
  id: ModuleId;
  nom: string;
  description: string;
  groupe: "Comptes" | "Données" | "Revenus" | "Pilotage";
  deps: ModuleId[];
  conflits: ModuleId[];
  /** Modèles de revenus avec lesquels le module n'a pas de sens. */
  revenusIncompatibles: Revenue[];
  pages: PageDef[];
  reglages: { id: string; label: string; options: string[] }[];
};

export type Entity = { nom: string; pluriel: string; champs: string[]; exemples: string[][] };

export type TemplateDef = {
  id: TemplateId;
  version: number;
  nom: string;
  accroche: string;
  description: string;
  glyph: string; // 2 lettres affichées dans la vignette
  premium: boolean;
  pages: PageDef[];
  modules: { requis: ModuleId[]; defaut: ModuleId[] };
  roles: string[];
  entite: Entity;
  revenu: Revenue;
  prix: number;
  copy: {
    heroTitre: string;
    heroSous: string;
    features: [string, string][];
    etapes: [string, string][];
    avantages: string[];
    faq: [string, string][];
    cta: string;
  };
  /** Tâches propres au modèle, rangées par étape de la feuille de route. */
  taches: Partial<Record<RoadmapStepId, RoadmapTaskDef[]>>;
  tagsLancement: string[];
};

export type RoadmapStepId =
  | "probleme" | "entretiens" | "mvp" | "ecrans" | "construction" | "tests" | "legal" | "paiements" | "deploiement" | "premiers";

export type RoadmapTaskDef = {
  id: string;
  titre: string;
  description: string;
  checklist: string[];
  duree: string;
  ressources: string[];
};

export type TaskStatus = "a-faire" | "en-cours" | "termine";

export type VisualStyle = "moderne" | "minimal" | "audacieux" | "neon" | "pastel" | "luxe";
export type Police = "systeme" | "arrondie" | "elegante" | "geometrique" | "mono";
export type LandingLayout = "centre" | "split" | "editorial";

export type Config = {
  templateId: TemplateId;
  templateVersion: number;
  nom: string;
  description: string;
  cible: string;
  couleurs: { primaire: string; accent: string };
  initiales: string;
  logo: string; // data URL d'une image, ou vide
  style: VisualStyle;
  /** Police du SaaS (absente sur les anciens projets = police système). */
  police?: Police;
  /** Design choisi (mise en page, tableau de bord, animations). Absent = design historique. */
  design?: string;
  /** Pages ajoutées d'après les fonctions demandées dans l'idée (carte, messagerie…). */
  extras?: ExtraKind[];
  modules: ModuleId[];
  reglages: Record<string, string>;
  roles: string[];
  pages: Record<string, boolean>; // pages du modèle désactivées = false
  revenu: Revenue;
  prix: number;
  domaine: string;
};

export type LandingSectionType = "hero" | "features" | "etapes" | "avantages" | "tarifs" | "faq" | "cta";

export type LandingSection = {
  id: string;
  type: LandingSectionType;
  visible: boolean;
  titre: string;
  texte: string;
  items: { titre: string; texte: string }[];
};

export type Landing = { layout: LandingLayout; sections: LandingSection[]; boutonPrincipal: string; boutonSecondaire: string; edited: boolean };

export type Offer = { id: string; nom: string; prix: number; periode: "mois" | "an" | "unique"; features: string[] };

export type Pricing = {
  modele: Revenue;
  offres: Offer[];
  calc: { clients: number; fraisPct: number; fraisFixe: number; hebergement: number; autres: number };
};

export type ValidationAnswers = Record<string, string>;

export type LaunchItem = { date: string; priorite: "haute" | "moyenne" | "basse"; status: TaskStatus; notes: string };

export type Metric = { date: string; visiteurs: number; inscrits: number; actifs: number; payants: number };

export type Project = {
  id: string;
  createdAt: string;
  updatedAt: string;
  ideaId: string | null;
  config: Config;
  landing: Landing;
  validation: ValidationAnswers;
  roadmap: Record<string, { status: TaskStatus; notes: string; checks: boolean[] }>;
  pricing: Pricing;
  launch: { date: string; items: Record<string, LaunchItem> };
  metrics: Metric[];
  activity: { date: string; label: string }[];
  /** Étapes cochées du guide de mise en production (absent sur les anciens projets). */
  guide?: Record<string, boolean>;
  /** Contenu personnalisé (rempli par l'IA ou par les modèles) : remplace les données d'exemple du modèle. */
  contenu?: Contenu;
  /** Données saisies dans l'application du projet (ajouts, modifications, suppressions). */
  appData?: AppState;
};

/** État enregistré d'une application générée. Toujours vérifié par `cleanAppData` avant usage. */
export type AppState = {
  v: 1;
  rows: { id: number; v: string[]; fav?: boolean; day?: number }[];
  next?: number;
  lessons?: boolean[];
  goals?: { nom: string; cible: number; actuel: number }[];
  doneRel?: number[];
  cart?: Record<string, number>;
  msgs?: { me: boolean; t: string; at: string }[];
  notes?: Record<string, string>;
  orders?: { id: number; pid: number; nom: string; qte: number; total: number; client: string; statut: string; date: string }[];
  nextOrder?: number;
};

/** Tout ce qui est « rempli » à partir de l'idée de l'utilisateur. */
export type Contenu = {
  source: "modele";
  /** Type de SaaS pour lequel le contenu a été rempli : ignoré si le modèle change ensuite. */
  type: TemplateId;
  secteur: string;
  idee: string;
  entite: { nom: string; pluriel: string; champs: string[] };
  lignes: string[][];
  statuts: string[];
  kpis: [string, number, string, number][];
  serie: string;
  fonctionnalites: [string, string][];
  copy: { heroTitre: string; heroSous: string; etapes: [string, string][]; avantages: string[]; faq: [string, string][]; cta: string };
};

export type Plan = "gratuit" | "solo" | "pro" | "illimite";

export type Prefs = { motion?: "auto" | "reduite"; densite?: "confort" | "compacte" };

export type AppData = {
  version: 2;
  projects: Project[];
  favorites: string[];
  plan: Plan;
  /** Designs mis en favori dans la galerie. */
  designFavs?: string[];
  /** Cases cochées des guides « Apprendre » quand elles ne sont liées à aucun projet. */
  parcours?: Record<string, boolean>;
  prefs?: Prefs;
};
