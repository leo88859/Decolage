import { MODULE_BY_ID } from "@/data/modules";
import { TEMPLATE_BY_ID } from "@/data/templates";
import { norm } from "@/lib/match";
import { enableModule } from "@/lib/modules";
import type { Config, ExtraKind, ModuleId } from "@/lib/types";

// Fonctions repérées dans le texte de l'idée, SANS IA : chaque fonction a sa liste de mots-clés,
// et active une brique ou ajoute une page qui existe déjà dans le moteur des prototypes.

export type Fonction = { id: string; label: string; mots: string[]; module?: ModuleId; page?: ExtraKind };

// Mots sans accents, en minuscules. Un mot seul correspond au début d'un mot du texte
// (« notif » → « notifications ») ; une expression doit apparaître telle quelle.
export const FONCTIONS: Fonction[] = [
  { id: "paiement", label: "Paiement en ligne", module: "abonnement", mots: ["paiement", "payer", "payant", "carte bancaire", "stripe", "encaiss", "prelevement", "abonnement"] },
  { id: "factures", label: "Factures", module: "facturation", mots: ["facture", "facturation"] },
  { id: "comptes", label: "Comptes utilisateurs", module: "auth", mots: ["compte", "connexion", "inscription", "inscrire", "login", "espace membre", "espace perso"] },
  { id: "profil", label: "Profils", module: "profil", mots: ["profil"] },
  { id: "recherche", label: "Recherche et filtres", module: "recherche", mots: ["recherch", "chercher", "filtre", "filtrer", "trier"] },
  { id: "favoris", label: "Favoris", module: "favoris", mots: ["favori", "wishlist", "coup de coeur", "sauvegarder"] },
  { id: "stats", label: "Statistiques", module: "graphiques", mots: ["statistique", "stats", "graphique", "courbe", "reporting"] },
  { id: "historique", label: "Historique", module: "historique", mots: ["historique"] },
  { id: "notifications", label: "Notifications et rappels", module: "notifications", mots: ["notif", "rappel", "alerte", "sms", "email", "mail", "prevenir"] },
  { id: "export", label: "Export Excel / CSV", module: "export-csv", mots: ["export", "excel", "csv", "tableur"] },
  { id: "admin", label: "Espace administrateur", module: "admin", mots: ["admin", "moderation", "moderer", "back-office", "backoffice"] },
  { id: "dashboard", label: "Tableau de bord", module: "dashboard", mots: ["tableau de bord", "dashboard"] },
  { id: "carte", label: "Carte", page: "carte", mots: ["carte des", "sur une carte", "une carte interactive", "map", "geolocalis", "autour de moi", "localiser", "itineraire"] },
  { id: "messages", label: "Messagerie", page: "conversation", mots: ["chat", "messagerie", "message", "discuter", "discussion"] },
  { id: "calendrier", label: "Calendrier", page: "mois", mots: ["calendrier", "planning", "emploi du temps"] },
  { id: "suivi", label: "Suivi par étapes", page: "kanban", mots: ["kanban", "pipeline", "suivi de commande", "suivi des commandes", "avancement"] },
  { id: "relances", label: "Relances", page: "relances", mots: ["relance", "relancer", "impaye"] },
];
export const FONCTION_BY_ID = Object.fromEntries(FONCTIONS.map((f) => [f.id, f])) as Record<string, Fonction>;

const words = (text: string) => norm(text).split(/[^a-z0-9-]+/).filter(Boolean);

/** Les mots du texte qui déclenchent une fonction (pour les montrer à l'utilisateur). */
function hits(f: Fonction, text: string, ws: string[]): string[] {
  const t = ` ${norm(text).replace(/[^a-z0-9-]+/g, " ")} `;
  return f.mots.flatMap((k) => (k.includes(" ") ? (t.includes(` ${k} `) || t.includes(` ${k}`) ? [k] : []) : ws.filter((w) => w.startsWith(k))));
}

/** Fonctions demandées dans l'idée, avec les mots qui les ont déclenchées. */
export function detectFonctions(idee: string): { f: Fonction; mots: string[] }[] {
  const ws = words(idee);
  return FONCTIONS.map((f) => ({ f, mots: [...new Set(hits(f, idee, ws))] })).filter((x) => x.mots.length > 0);
}

/** Tous les mots déclencheurs d'un texte, pour les surligner. */
export const motsDeclencheurs = (idee: string) => new Set(detectFonctions(idee).flatMap((x) => x.mots));

/**
 * Applique les fonctions choisies : active les briques (avec leurs dépendances) et ajoute les pages.
 * Une brique incompatible avec le modèle est ignorée plutôt que de casser la configuration.
 */
export function applyFonctions(cfg: Config, ids: string[]): { config: Config; appliquees: string[]; ignorees: string[] } {
  let config = cfg;
  const appliquees: string[] = [];
  const ignorees: string[] = [];
  const kinds = new Set<string>(TEMPLATE_BY_ID[config.templateId].pages.map((p) => p.kind));
  // Un modèle qui a déjà un agenda n'a pas besoin d'un second calendrier.
  if (kinds.has("calendrier")) kinds.add("mois");
  const extras: ExtraKind[] = [...(config.extras ?? [])];
  for (const id of ids) {
    const f = FONCTION_BY_ID[id];
    if (!f) continue;
    if (f.module) {
      if (config.modules.includes(f.module)) { appliquees.push(id); continue; }
      const r = enableModule(config, f.module);
      if (!r.ok) { ignorees.push(id); continue; }
      const reglages = { ...r.config.reglages };
      for (const m of r.config.modules) for (const s of MODULE_BY_ID[m].reglages) reglages[s.id] ??= s.options[0]!;
      config = { ...r.config, reglages };
      appliquees.push(id);
    } else if (f.page) {
      if (!kinds.has(f.page) && !extras.includes(f.page)) extras.push(f.page);
      appliquees.push(id);
    }
  }
  return { config: extras.length ? { ...config, extras } : config, appliquees, ignorees };
}
