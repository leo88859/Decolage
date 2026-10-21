import { CATEGORIES } from "@/data/ideas";
import { TEMPLATE_BY_ID } from "@/data/templates";
import type { Idea } from "@/lib/types";

// Correspondance entre une description libre et le catalogue, sans IA :
// mots normalisés, racines simplifiées, synonymes, et poids selon le champ où le mot apparaît.

const STOP = new Set(("le la les un une des du de d l au aux et ou en a à ce cet cette ces qui que quoi dont où pour par sur avec sans dans je tu il elle on nous vous ils elles " +
  "mon ma mes ton ta tes son sa ses leur leurs notre votre veux voudrais aimerais faire fait creer créer site application app saas outil plateforme truc chose qui permet permettre " +
  "est sont être avoir ai as plus moins tres très bien comme pas ne y se s c qu idee idée projet gens personnes utilisateurs").split(" ").map((w) => norm(w)));

// Groupes de synonymes : un mot de la description active tous les mots de son groupe.
const SYNONYMS: string[][] = [
  ["rdv", "rendez", "creneau", "agenda", "reserv", "booking", "planning", "horaire"],
  ["argent", "gagn", "revenu", "gain", "budget", "depens", "sou", "thune", "epargn", "financ"],
  ["vend", "vente", "boutique", "shop", "ecommerce", "produit", "commande", "revend", "vinted"],
  ["client", "prospect", "crm", "relanc", "contact"],
  ["etudi", "eleve", "lyceen", "fac", "revis", "examen", "cours", "ecole", "classe", "scolair"],
  ["prof", "enseign", "format", "lecon", "apprend", "tutor"],
  ["tache", "todo", "organis", "product", "routin", "habitud"],
  ["creat", "influenc", "tiktok", "instagram", "youtube", "video", "contenu", "abonne"],
  ["freelanc", "independ", "devis", "factur", "prestat", "mission"],
  ["restaur", "snack", "cafe", "boulang", "commerc", "magasin", "local", "quartier", "coiffeur", "barbier"],
  ["sport", "coach", "salle", "muscu", "fitness"],
  ["equip", "entrepris", "salari", "employ", "pme", "bureau"],
  ["avis", "temoign", "note"],
  ["famill", "parent", "enfant", "ado"],
  ["coloc", "partag", "ami", "group"],
  ["annuair", "repertoir", "list", "trouv", "recherch"],
  ["ticket", "support", "demand", "panne", "depann"],
  ["document", "contrat", "pdf", "modele", "attest"],
  ["evenement", "fete", "mariag", "anniversair", "invit"],
  ["voyag", "vacanc", "trajet", "covoitur"],
];

export function norm(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

/** Racine simplifiée : on retire les terminaisons françaises courantes. */
export function stem(w: string): string {
  let s = w;
  for (const suf of ["ements", "ement", "ations", "ation", "euses", "euse", "eurs", "eur", "ives", "ive", "ables", "able", "iques", "ique", "ees", "ee", "es", "er", "ez", "s", "x", "e"]) {
    if (s.length - suf.length >= 4 && s.endsWith(suf)) {
      s = s.slice(0, -suf.length);
      break;
    }
  }
  return s;
}

export function tokens(text: string): string[] {
  return norm(text).split(/[^a-z0-9]+/).filter((w) => w.length >= 2 && !STOP.has(w)).map(stem);
}

/** Mots de la requête + synonymes, chaque mot étendu gardant la trace du mot d'origine. */
function expand(words: string[]): Map<string, string> {
  const out = new Map<string, string>();
  for (const w of words) {
    out.set(w, w);
    for (const group of SYNONYMS) if (group.some((g) => w.startsWith(g) || g.startsWith(w))) for (const g of group) if (!out.has(g)) out.set(g, w);
  }
  return out;
}

const FIELDS: [weight: number, get: (i: Idea) => string][] = [
  [3, (i) => i.nom],
  [2, (i) => i.probleme],
  [2, (i) => i.description],
  [2, (i) => i.cible],
  [1.5, (i) => CATEGORIES.find((c) => c.id === i.categorie)!.nom + " " + TEMPLATE_BY_ID[i.template].nom],
  [1.2, (i) => i.mvp.join(" ")],
  [1, (i) => i.exemple],
];

export type Match = { idea: Idea; score: number; pct: number; mots: string[] };

/** Racine → mot tel que tapé (« coiff » → « coiffeur », « rend » → « rendez-vous »). */
function surfaces(text: string): Map<string, string> {
  const out = new Map<string, string>();
  for (const raw of text.toLowerCase().split(/[^\p{L}\p{N}-]+/u)) for (const t of tokens(raw)) if (!out.has(t)) out.set(t, raw.replace(/^-+|-+$/g, ""));
  return out;
}

export function matchIdeas(text: string, ideas: Idea[], limit = 6): Match[] {
  const words = [...new Set(tokens(text))];
  if (!words.length) return [];
  const query = expand(words);
  const shown = surfaces(text);

  const scored = ideas.map((idea) => {
    let score = 0;
    const hit = new Set<string>();
    for (const [weight, get] of FIELDS) {
      const fieldWords = new Set(tokens(get(idea)));
      for (const [q, origin] of query) {
        const direct = q === origin;
        for (const f of fieldWords) {
          if (f === q || (q.length >= 4 && f.startsWith(q)) || (f.length >= 4 && q.startsWith(f))) {
            score += weight * (direct ? 1 : 0.5); // un synonyme compte moitié moins
            hit.add(origin);
            break;
          }
        }
      }
    }
    // Bonus quand beaucoup de mots différents de la description sont couverts.
    const coverage = hit.size / words.length;
    return { idea, score: score * (0.6 + coverage), mots: [...new Set([...hit].map((h) => shown.get(h) ?? h))] };
  }).filter((m) => m.score > 0);

  scored.sort((a, b) => b.score - a.score || a.idea.nom.localeCompare(b.idea.nom));
  const best = scored[0]?.score ?? 1;
  return scored.slice(0, limit).map((m) => ({ ...m, pct: Math.max(20, Math.round((m.score / best) * 100)) }));
}
