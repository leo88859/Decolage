import type { Plan } from "@/lib/types";

// Toutes les limites et tous les prix des formules sont ici, et nulle part ailleurs.
// Sans Stripe configuré, les formules s'activent localement pour tester. Avec Stripe,
// la formule vient du compte (table profiles, mise à jour par le webhook).

export type PlanDef = {
  nom: string;
  prix: number; // € par mois
  maxProjets: number; // Infinity = illimité
  maxSites: number; // SaaS publiés en ligne en même temps
  modelesPremium: boolean; // modèles marqués « offre payante »
  exportFichiers: boolean;
  duplication: boolean;
  personnalisationAvancee: boolean; // logo importé, thèmes, mises en page supplémentaires
  plansDetailles: boolean; // tâches propres à chaque brique dans la feuille de route
  accroche: string;
};

const PAYANT = { modelesPremium: true, exportFichiers: true, duplication: true, personnalisationAvancee: true, plansDetailles: true };

export const PLANS: Record<Plan, PlanDef> = {
  gratuit: { nom: "Gratuit", prix: 0, maxProjets: 0, maxSites: 0, modelesPremium: false, exportFichiers: false, duplication: false, personnalisationAvancee: false, plansDetailles: false, accroche: "Pour découvrir : décris ton idée et essaie les 10 designs en aperçu." },
  solo: { nom: "Solo", prix: 2.99, maxProjets: 1, maxSites: 1, ...PAYANT, accroche: "Ton premier SaaS, en ligne." },
  pro: { nom: "Pro", prix: 9.99, maxProjets: 5, maxSites: 5, ...PAYANT, accroche: "Pour tester plusieurs idées en parallèle." },
  illimite: { nom: "Illimité", prix: 29.99, maxProjets: Infinity, maxSites: Infinity, ...PAYANT, accroche: "Projets et sites sans limite." },
};

/** Formules payantes, dans l'ordre d'affichage. */
export const PAID_PLANS = ["solo", "pro", "illimite"] as const satisfies readonly Plan[];
export type PaidPlan = (typeof PAID_PLANS)[number];

export const isPlan = (x: unknown): x is Plan => typeof x === "string" && x in PLANS;
export const isPaidPlan = (x: unknown): x is PaidPlan => PAID_PLANS.includes(x as PaidPlan);

/** Ancienne formule « premium » (versions précédentes) : équivaut à Illimité. */
export const normalizePlan = (x: unknown): Plan => (x === "premium" ? "illimite" : isPlan(x) ? x : "gratuit");

export type Feature = "modelesPremium" | "exportFichiers" | "duplication" | "personnalisationAvancee" | "plansDetailles";

export const can = (plan: Plan, f: Feature) => PLANS[plan][f];
export const canCreateProject = (plan: Plan, count: number) => count < PLANS[plan].maxProjets;

export const prixLabel = (plan: Plan) => (PLANS[plan].prix === 0 ? "0 €" : `${PLANS[plan].prix.toLocaleString("fr-FR", { minimumFractionDigits: 2 })} € / mois`);
export const limiteLabel = (n: number, singulier: string, pluriel: string) => (n === Infinity ? `${pluriel} illimités` : `${n} ${n > 1 ? pluriel : singulier}`);

/** Formule payante la moins chère qui permet `count` projets (pour les invitations à passer à l'offre supérieure). */
export const planForProjects = (count: number): PaidPlan => PAID_PLANS.find((p) => PLANS[p].maxProjets >= count) ?? "illimite";
