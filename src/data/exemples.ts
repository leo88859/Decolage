import type { IdeeInput } from "@/components/DesignThumb";

/** Idées d'exemple, déjà analysées, pour montrer les designs avec de vraies données. */
export const EXEMPLES: Omit<IdeeInput, "design">[] = [
  { idee: "Une appli pour que les clients d'un coiffeur réservent en ligne", type: "rendez-vous", secteur: "coiffure", nom: "RésaCoiff" },
  { idee: "Une communauté payante pour les joueurs qui veulent progresser", type: "abonnement", secteur: "gaming", nom: "GameUp" },
  { idee: "Une boutique pour mes bougies faites main", type: "boutique", secteur: "artisanat", nom: "Lueur" },
  { idee: "Un espace client élégant pour une agence immobilière", type: "portail-client", secteur: "immobilier", nom: "Clé d'Or" },
  { idee: "Gérer les membres et les séances d'une salle de sport", type: "crm", secteur: "sport", nom: "FitCRM" },
  { idee: "Des devis rapides pour les artisans du bâtiment", type: "documents", secteur: "batiment", nom: "DevisPro" },
  { idee: "Réserver le matériel photo d'un studio", type: "reservations", secteur: "photo", nom: "StudioBox" },
  { idee: "Suivre ses revenus de créateur de contenu", type: "suivi-gains", secteur: "createurs", nom: "CréaCash" },
  { idee: "Un support client pour un service informatique", type: "tickets", secteur: "informatique", nom: "HelpDesk" },
  { idee: "Organiser les tâches d'un restaurant", type: "taches", secteur: "restauration", nom: "Brigade" },
];
