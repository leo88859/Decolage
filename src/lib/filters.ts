import { durationOf, normalize, type DurationBucket } from "@/lib/labels";
import type { Audience, Budget, CategoryId, Difficulty, Idea, Revenue, TechLevel, TemplateId } from "@/lib/types";

export type IdeaFilters = {
  q: string;
  categorie: CategoryId | "";
  budget: Budget | "";
  difficulte: Difficulty | "";
  duree: DurationBucket | "";
  public: Audience | "";
  type: TemplateId | "";
  modele: Revenue | "";
  niveau: TechLevel | "";
  favoris: boolean;
};

export const NO_FILTERS: IdeaFilters = { q: "", categorie: "", budget: "", difficulte: "", duree: "", public: "", type: "", modele: "", niveau: "", favoris: false };

/** Recherche locale : chaque mot doit apparaître (sans accents) dans le nom, la description, le problème, la cible ou le MVP. */
export function filterIdeas(ideas: Idea[], f: IdeaFilters, favorites: string[]): Idea[] {
  const words = normalize(f.q).split(/\s+/).filter(Boolean);
  return ideas.filter((i) => {
    if (f.categorie && i.categorie !== f.categorie) return false;
    if (f.budget !== "" && i.budget !== f.budget) return false;
    if (f.difficulte !== "" && i.difficulte !== f.difficulte) return false;
    if (f.duree && durationOf(i) !== f.duree) return false;
    if (f.public && i.public !== f.public) return false;
    if (f.type && i.template !== f.type) return false;
    if (f.modele && i.modele !== f.modele) return false;
    if (f.niveau && i.niveau !== f.niveau) return false;
    if (f.favoris && !favorites.includes(i.id)) return false;
    if (words.length) {
      const hay = normalize([i.nom, i.description, i.probleme, i.cible, ...i.mvp].join(" "));
      if (!words.every((w) => hay.includes(w))) return false;
    }
    return true;
  });
}
