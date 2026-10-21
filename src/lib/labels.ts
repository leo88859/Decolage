import type { Audience, Budget, Difficulty, Idea, TechLevel } from "@/lib/types";

export const AUDIENCE_LABEL: Record<Audience, string> = {
  particuliers: "Particuliers", etudiants: "Étudiants", createurs: "Créateurs", freelances: "Freelances", entreprises: "Entreprises", associations: "Associations et écoles",
};
export const BUDGET_LABEL: Record<Budget, string> = { 0: "Moins de 50 €", 1: "50 à 300 €", 2: "Plus de 300 €" };
export const LEVEL_LABEL: Record<TechLevel, string> = { "no-code": "Sans code", "low-code": "Peu de code", code: "Code" };
export const DIFFICULTY_LABEL: Record<Difficulty, string> = { 1: "Accessible", 2: "Intermédiaire", 3: "Exigeante" };
export const DURATION_LABEL = { court: "1 à 2 semaines", moyen: "3 à 4 semaines", long: "5 semaines et plus" } as const;
export type DurationBucket = keyof typeof DURATION_LABEL;
export const durationOf = (i: Idea): DurationBucket => (i.semaines <= 2 ? "court" : i.semaines <= 4 ? "moyen" : "long");

export const normalize = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
