import { LAUNCH_ACTIONS, type LaunchAction } from "@/data/launch";
import { BASE_TASKS, ROADMAP_STEPS } from "@/data/roadmap";
import { TEMPLATE_BY_ID } from "@/data/templates";
import type { Config, ModuleId, RoadmapStepId, RoadmapTaskDef } from "@/lib/types";

// Tâches ajoutées par certaines briques (offres payantes : plans détaillés).
const MODULE_TASKS: Partial<Record<ModuleId, { step: RoadmapStepId; task: RoadmapTaskDef }>> = {
  auth: { step: "construction", task: { id: "m-auth", titre: "Sécuriser les comptes", description: "Mots de passe hachés, limitation des tentatives, réinitialisation par email.", checklist: ["Hachage des mots de passe", "Limite de tentatives", "Réinitialisation testée"], duree: "1 jour", ressources: ["Utiliser un service d'authentification éprouvé plutôt que le coder soi-même"] } },
  abonnement: { step: "paiements", task: { id: "m-abo", titre: "Gérer le cycle de vie de l'abonnement", description: "Essai, renouvellement, échec de paiement et résiliation.", checklist: ["Échec de paiement géré", "Résiliation en ligne", "Accès coupé à la fin de la période"], duree: "1 jour", ressources: [] } },
  facturation: { step: "legal", task: { id: "m-factures", titre: "Factures conformes", description: "Numérotation continue et mentions obligatoires sur chaque facture.", checklist: ["Numérotation sans trou", "Mentions obligatoires", "Conservation 10 ans"], duree: "3 h", ressources: [] } },
  admin: { step: "construction", task: { id: "m-admin", titre: "Protéger l'espace d'administration", description: "Seul le propriétaire doit y accéder, vérifié côté serveur.", checklist: ["Contrôle du rôle côté serveur", "Journal des actions sensibles"], duree: "3 h", ressources: [] } },
  "export-csv": { step: "tests", task: { id: "m-csv", titre: "Tester l'export CSV dans Excel", description: "Accents, séparateurs et dates doivent s'afficher correctement.", checklist: ["Accents corrects", "Colonnes séparées", "Dates lisibles"], duree: "1 h", ressources: [] } },
  notifications: { step: "tests", task: { id: "m-notifs", titre: "Vérifier les notifications", description: "Chaque événement important génère une notification, sans doublon.", checklist: ["Liste des événements", "Marquer comme lu", "Pas de doublons"], duree: "2 h", ressources: [] } },
  favoris: { step: "tests", task: { id: "m-favoris", titre: "Tester les favoris", description: "Un favori ajouté doit être visible uniquement par son propriétaire.", checklist: ["Ajout et retrait", "Isolation entre comptes"], duree: "1 h", ressources: [] } },
};

export type RoadmapStep = { id: RoadmapStepId; titre: string; tasks: (RoadmapTaskDef & { origine: "base" | "modele" | "module" })[] };

export function roadmapFor(cfg: Config, detaille: boolean): RoadmapStep[] {
  const t = TEMPLATE_BY_ID[cfg.templateId];
  return ROADMAP_STEPS.map((s) => {
    const tasks: RoadmapStep["tasks"] = [
      ...BASE_TASKS[s.id].map((x) => ({ ...x, origine: "base" as const })),
      ...(t.taches[s.id] ?? []).map((x) => ({ ...x, origine: "modele" as const })),
    ];
    if (detaille) {
      for (const m of cfg.modules) {
        const mt = MODULE_TASKS[m];
        if (mt && mt.step === s.id) tasks.push({ ...mt.task, origine: "module" });
      }
    }
    // Pas de paiements à préparer pour un produit gratuit.
    return { ...s, tasks: s.id === "paiements" && cfg.revenu === "gratuit" ? [] : tasks };
  }).filter((s) => s.tasks.length);
}

/** Actions de lancement pertinentes : universelles + celles qui correspondent aux tags du modèle. */
export function launchActionsFor(cfg: Config): LaunchAction[] {
  const tags = TEMPLATE_BY_ID[cfg.templateId].tagsLancement;
  return LAUNCH_ACTIONS.filter((a) => !a.tags.length || a.tags.some((x) => tags.includes(x))).sort((a, b) => a.semaine - b.semaine);
}

export function addDays(iso: string, days: number): string {
  const d = new Date(`${iso}T12:00:00`);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}
