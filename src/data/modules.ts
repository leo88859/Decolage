import type { ModuleDef, ModuleId } from "@/lib/types";

// Briques préprogrammées. Chaque brique déclare ses dépendances, ses conflits et les pages qu'elle ajoute.
// Dans cette version, toutes les briques produisent un prototype interactif (niveau 1) et une
// configuration exportable (niveau 2) — pas encore un backend opérationnel.
export const MODULES: ModuleDef[] = [
  {
    id: "auth", nom: "Authentification", groupe: "Comptes",
    description: "Inscription, connexion et déconnexion des utilisateurs.",
    deps: [], conflits: ["acces-libre"], revenusIncompatibles: [],
    pages: [{ id: "connexion", titre: "Connexion", kind: "connexion", nav: false }],
    reglages: [{ id: "auth.methode", label: "Méthode de connexion", options: ["Email + mot de passe", "Lien magique par email"] }],
  },
  {
    id: "acces-libre", nom: "Accès sans compte", groupe: "Comptes",
    description: "Tout le monde utilise l'outil sans créer de compte. Incompatible avec les comptes utilisateurs.",
    deps: [], conflits: ["auth"], revenusIncompatibles: ["abonnement", "freemium"],
    pages: [], reglages: [],
  },
  {
    id: "profil", nom: "Profil utilisateur", groupe: "Comptes",
    description: "Chaque utilisateur gère son nom, sa photo et ses informations.",
    deps: ["auth"], conflits: [], revenusIncompatibles: [],
    pages: [{ id: "profil", titre: "Mon profil", kind: "profil", nav: true }],
    reglages: [],
  },
  {
    id: "donnees", nom: "Gestion des données", groupe: "Données",
    description: "Créer, modifier et supprimer les éléments principaux du produit.",
    deps: [], conflits: [], revenusIncompatibles: [],
    pages: [], reglages: [],
  },
  {
    id: "formulaires", nom: "Formulaires", groupe: "Données",
    description: "Formulaires de saisie avec champs obligatoires et messages d'erreur.",
    deps: ["donnees"], conflits: [], revenusIncompatibles: [],
    pages: [{ id: "nouveau", titre: "Ajouter", kind: "formulaire", nav: true }],
    reglages: [],
  },
  {
    id: "recherche", nom: "Recherche et filtres", groupe: "Données",
    description: "Barre de recherche et filtres sur la liste principale.",
    deps: ["donnees"], conflits: [], revenusIncompatibles: [],
    pages: [], reglages: [{ id: "recherche.position", label: "Position des filtres", options: ["En haut", "Sur le côté"] }],
  },
  {
    id: "detail", nom: "Pages de détail", groupe: "Données",
    description: "Une page dédiée pour chaque élément, avec toutes ses informations.",
    deps: ["donnees"], conflits: [], revenusIncompatibles: [],
    pages: [{ id: "detail", titre: "Détail", kind: "detail", nav: false }],
    reglages: [],
  },
  {
    id: "favoris", nom: "Favoris", groupe: "Données",
    description: "Les utilisateurs enregistrent les éléments qui les intéressent.",
    deps: ["auth", "donnees"], conflits: [], revenusIncompatibles: [],
    pages: [{ id: "favoris", titre: "Favoris", kind: "liste", nav: true }],
    reglages: [],
  },
  {
    id: "dashboard", nom: "Tableau de bord", groupe: "Pilotage",
    description: "Vue d'ensemble avec les chiffres clés de l'utilisateur.",
    deps: ["auth"], conflits: [], revenusIncompatibles: [],
    pages: [{ id: "tableau-de-bord", titre: "Tableau de bord", kind: "dashboard", nav: true }],
    reglages: [],
  },
  {
    id: "graphiques", nom: "Graphiques", groupe: "Pilotage",
    description: "Courbes d'évolution calculées à partir des données saisies.",
    deps: ["donnees"], conflits: [], revenusIncompatibles: [],
    pages: [{ id: "statistiques", titre: "Statistiques", kind: "graphique", nav: true }],
    reglages: [{ id: "graphiques.type", label: "Type de graphique", options: ["Courbe", "Barres"] }],
  },
  {
    id: "historique", nom: "Historique d'activité", groupe: "Pilotage",
    description: "Journal des dernières actions effectuées sur le compte.",
    deps: ["auth"], conflits: [], revenusIncompatibles: [],
    pages: [{ id: "historique", titre: "Historique", kind: "historique", nav: true }],
    reglages: [],
  },
  {
    id: "notifications", nom: "Notifications internes", groupe: "Pilotage",
    description: "Centre de notifications dans l'application (pas d'emails dans cette version).",
    deps: ["auth"], conflits: [], revenusIncompatibles: [],
    pages: [{ id: "notifications", titre: "Notifications", kind: "notifications", nav: true }],
    reglages: [],
  },
  {
    id: "export-csv", nom: "Export CSV", groupe: "Données",
    description: "Téléchargement des données au format CSV, lisible dans Excel.",
    deps: ["donnees"], conflits: [], revenusIncompatibles: [],
    pages: [], reglages: [{ id: "csv.separateur", label: "Séparateur", options: ["Point-virgule (Excel FR)", "Virgule"] }],
  },
  {
    id: "abonnement", nom: "Abonnement", groupe: "Revenus",
    description: "Page de tarifs et gestion de l'offre choisie par l'utilisateur.",
    deps: ["auth", "profil"], conflits: [], revenusIncompatibles: ["gratuit"],
    pages: [{ id: "tarifs", titre: "Tarifs", kind: "tarifs", nav: true }],
    reglages: [{ id: "abonnement.essai", label: "Période d'essai", options: ["Aucune", "7 jours", "14 jours"] }],
  },
  {
    id: "facturation", nom: "Facturation", groupe: "Revenus",
    description: "Historique des paiements et factures téléchargeables.",
    deps: ["abonnement"], conflits: [], revenusIncompatibles: ["gratuit"],
    pages: [{ id: "facturation", titre: "Facturation", kind: "facturation", nav: true }],
    reglages: [],
  },
  {
    id: "parametres", nom: "Paramètres", groupe: "Comptes",
    description: "Préférences du compte : langue, notifications, suppression du compte.",
    deps: ["auth"], conflits: [], revenusIncompatibles: [],
    pages: [{ id: "parametres", titre: "Paramètres", kind: "parametres", nav: true }],
    reglages: [],
  },
  {
    id: "admin", nom: "Administration", groupe: "Pilotage",
    description: "Espace réservé au propriétaire : utilisateurs, contenus et modération.",
    deps: ["auth"], conflits: [], revenusIncompatibles: [],
    pages: [{ id: "admin", titre: "Administration", kind: "admin", nav: true }],
    reglages: [],
  },
];

export const MODULE_BY_ID = Object.fromEntries(MODULES.map((m) => [m.id, m])) as Record<ModuleId, ModuleDef>;
