import type { Audience, Budget, CategoryId, Difficulty, Idea, Revenue, TechLevel, TemplateId } from "@/lib/types";

const split = (s: string) => s.split(" | ");

/** Construit une fiche d'idée. Les listes (MVP, compétences, risques) sont séparées par « | ». */
export function I(
  id: string, categorie: CategoryId, template: TemplateId, pub: Audience, modele: Revenue, niveau: TechLevel,
  difficulte: Difficulty, semaines: number, budget: Budget,
  nom: string, description: string, probleme: string, cible: string, exemple: string,
  mvp: string, competences: string, risques: string, concurrence: string, validation: string,
): Idea {
  return {
    id, nom, categorie, description, probleme, cible, public: pub, exemple, modele,
    mvp: split(mvp), difficulte, semaines, budget, competences: split(competences), niveau,
    risques: split(risques), concurrence, validation, template,
  };
}
