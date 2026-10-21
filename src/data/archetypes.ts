import type { TemplateId } from "@/lib/types";

// Architectures d'application : la STRUCTURE d'un SaaS (cadre, navigation, écrans, rôle des données),
// indépendante de son apparence (le design). Source unique pour les aperçus de Décollage et pour le
// projet Next.js exporté : les deux lisent ce fichier, ils ne peuvent donc pas diverger.

export type ArchId = "workspace" | "finance" | "learning" | "crm" | "studio" | "commerce" | "classic";

/** Cadre de l'espace utilisateur : chaque architecture a le sien. */
export type Frame =
  | "board" // espace de travail : barre du haut + listes à gauche + vues de tâches
  | "ledger" // finance : en-tête avec onglets et période, pas de barre latérale
  | "course" // formation : navigation centrée, lecteur avec sommaire
  | "split" // relation client : rail d'icônes + liste + fiche détaillée
  | "studio" // création : bibliothèque, éditeur, propriétés (trois volets)
  | "store" // e-commerce : barre d'administration + sous-navigation
  | "classic"; // structure standard (barre latérale + contenu)

export type ScreenView =
  | "ws-list" | "ws-board" | "ws-timeline"
  | "fi-overview" | "fi-ledger" | "fi-analysis" | "fi-goals"
  | "le-courses" | "le-player" | "le-cards" | "le-progress"
  | "crm-split" | "crm-pipeline" | "crm-followup"
  | "st-library" | "st-editor"
  | "co-products" | "co-orders" | "co-sales"
  | "settings";

export type Screen = { id: string; titre: string; view: ScreenView };

/** Rôle des colonnes de l'entité, pour que chaque écran sache où trouver la date, le montant, le groupe… */
export type Roles = { titre: number; date?: number; montant?: number; groupe?: number; personne?: number; progression?: number; stock?: number; prix?: number; duree?: number };

export type Archetype = { id: ArchId; nom: string; description: string; frame: Frame; screens: Screen[] };

const s = (id: string, titre: string, view: ScreenView): Screen => ({ id, titre, view });

export const ARCHETYPES: Record<ArchId, Archetype> = {
  workspace: { id: "workspace", nom: "Espace de travail", description: "Listes intelligentes à gauche, tâches au centre, vue liste ou tableau, panneau de détail.", frame: "board", screens: [s("app", "Mes tâches", "ws-list"), s("tableau", "Tableau", "ws-board"), s("calendrier", "Échéancier", "ws-timeline"), s("parametres", "Paramètres", "settings")] },
  finance: { id: "finance", nom: "Finance", description: "Solde, courbes et répartitions, journal des transactions par mois, analyses par catégorie.", frame: "ledger", screens: [s("app", "Vue d'ensemble", "fi-overview"), s("transactions", "Transactions", "fi-ledger"), s("analyses", "Analyses", "fi-analysis"), s("objectifs", "Objectifs", "fi-goals"), s("parametres", "Paramètres", "settings")] },
  learning: { id: "learning", nom: "Formation", description: "Catalogue de modules, lecteur de leçon avec sommaire, fiches de révision et progression.", frame: "course", screens: [s("app", "Mes cours", "le-courses"), s("lecon", "Leçon", "le-player"), s("fiches", "Fiches", "le-cards"), s("progression", "Progression", "le-progress"), s("parametres", "Paramètres", "settings")] },
  crm: { id: "crm", nom: "Relation client", description: "Liste et fiche côte à côte avec notes et historique, pipeline par étape, relances du jour.", frame: "split", screens: [s("app", "Contacts", "crm-split"), s("pipeline", "Pipeline", "crm-pipeline"), s("relances", "Relances", "crm-followup"), s("parametres", "Paramètres", "settings")] },
  studio: { id: "studio", nom: "Création", description: "Bibliothèque de documents, éditeur de texte avec enregistrement automatique, propriétés.", frame: "studio", screens: [s("app", "Bibliothèque", "st-library"), s("editeur", "Éditeur", "st-editor"), s("parametres", "Paramètres", "settings")] },
  commerce: { id: "commerce", nom: "E-commerce", description: "Catalogue avec stock, prise de commande qui décompte le stock, ventes et meilleurs produits.", frame: "store", screens: [s("app", "Produits", "co-products"), s("commandes", "Commandes", "co-orders"), s("ventes", "Ventes", "co-sales"), s("parametres", "Paramètres", "settings")] },
  classic: { id: "classic", nom: "Standard", description: "Barre latérale et pages du modèle (tableau, calendrier, kanban…).", frame: "classic", screens: [] },
};

export const ARCH_OF: Record<TemplateId, ArchId> = {
  taches: "workspace", projets: "workspace",
  "suivi-gains": "finance",
  formation: "learning",
  crm: "crm", "portail-client": "crm", tickets: "crm",
  documents: "studio", ressources: "studio",
  boutique: "commerce",
  "rendez-vous": "classic", abonnement: "classic", annuaire: "classic", "liste-attente": "classic", reservations: "classic", formulaires: "classic",
};

/** Rôle des colonnes de chaque type (index dans les champs de l'entité). */
export const ROLES: Partial<Record<TemplateId, Roles>> = {
  taches: { titre: 0, date: 1, groupe: 2 },
  projets: { titre: 0, personne: 1, date: 2, progression: 3 },
  "suivi-gains": { titre: 1, date: 0, groupe: 2, montant: 3 },
  formation: { titre: 0, groupe: 1, duree: 2 },
  crm: { titre: 0, personne: 1, date: 3 },
  "portail-client": { titre: 0, personne: 1, date: 3 },
  tickets: { titre: 0, personne: 1, groupe: 2 },
  documents: { titre: 0, groupe: 1, date: 2 },
  ressources: { titre: 0, groupe: 1, date: 3 },
  boutique: { titre: 0, prix: 1, stock: 2 },
};

export const archOf = (t: TemplateId): Archetype => ARCHETYPES[ARCH_OF[t]];

/** Écrans d'une architecture, avec les libellés adaptés à l'entité (ex. « Dossiers » au lieu de « Contacts »). */
export function screensFor(t: TemplateId, entite: { nom: string; pluriel: string }): Screen[] {
  const a = archOf(t);
  return a.screens.map((sc) => {
    if (sc.view === "crm-split" || sc.view === "st-library" || sc.view === "co-products" || (sc.view === "ws-list" && t === "projets")) return { ...sc, titre: entite.pluriel };
    if (sc.view === "ws-timeline" && t === "projets") return { ...sc, titre: "Jalons" };
    if (sc.view === "crm-pipeline" && t === "tickets") return { ...sc, titre: "Suivi" };
    return sc;
  });
}

// ─── Site public ───
export type SitePage = { id: string; titre: string; view: "home" | "features" | "pricing" | "login" | "signup" };

/** Pages publiques utiles au projet : tarifs seulement s'il est payant, inscription seulement s'il a des comptes. */
export function sitePagesFor(revenu: string, hasAccounts: boolean): SitePage[] {
  return [
    { id: "accueil", titre: "Accueil", view: "home" },
    { id: "fonctionnalites", titre: "Fonctionnalités", view: "features" },
    ...(revenu !== "gratuit" ? [{ id: "tarifs", titre: "Tarifs", view: "pricing" } as SitePage] : []),
    ...(hasAccounts ? [{ id: "connexion", titre: "Connexion", view: "login" } as SitePage, { id: "inscription", titre: "Inscription", view: "signup" } as SitePage] : []),
  ];
}

/** Composition de la page d'accueil, propre à chaque design (structure, pas seulement couleurs). */
export type HomeLayout = "centre" | "split" | "editorial" | "bento" | "asym" | "terminal";
export const HOME_LAYOUT: Record<string, HomeLayout> = {
  aurora: "centre", neon: "split", pastel: "bento", maison: "editorial", brutal: "asym",
  papier: "editorial", ocean: "split", sunset: "asym", terminal: "terminal", bento: "bento",
};
