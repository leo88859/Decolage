import type { ValidationAnswers } from "@/lib/types";

// Évaluation structurée à partir des réponses de l'utilisateur.
// Aucune analyse de marché en direct : uniquement des règles fixes appliquées aux réponses.

export type Question =
  | { id: string; label: string; aide: string; type: "texte"; placeholder: string }
  | { id: string; label: string; aide: string; type: "choix"; options: { v: string; label: string }[] };

export const QUESTIONS: Question[] = [
  { id: "probleme", type: "texte", label: "Quel problème veux-tu résoudre ?", aide: "Décris-le du point de vue de la personne qui le vit.", placeholder: "Quand je…, j'ai du mal à…" },
  { id: "qui", type: "texte", label: "Qui rencontre ce problème ?", aide: "Sois précis : âge, métier, situation.", placeholder: "Ex. : coiffeurs indépendants en ville moyenne" },
  { id: "actuel", type: "choix", label: "Comment ces personnes le résolvent-elles aujourd'hui ?", aide: "Une solution bricolée est souvent un bon signe.", options: [
    { v: "rien", label: "Elles ne font rien" }, { v: "bricolage", label: "Avec du bricolage (papier, tableur, messages)" },
    { v: "gratuit", label: "Avec un outil gratuit" }, { v: "payant", label: "Avec un outil payant" } ] },
  { id: "frequence", type: "choix", label: "À quelle fréquence le problème survient-il ?", aide: "Un problème fréquent justifie plus facilement un abonnement.", options: [
    { v: "quotidien", label: "Tous les jours" }, { v: "hebdo", label: "Chaque semaine" }, { v: "mensuel", label: "Chaque mois" }, { v: "rare", label: "Quelques fois par an" } ] },
  { id: "enjeu", type: "choix", label: "Que se passe-t-il si le problème n'est pas résolu ?", aide: "Plus l'enjeu est concret, plus la solution a de valeur.", options: [
    { v: "argent", label: "Ils perdent de l'argent" }, { v: "temps", label: "Ils perdent du temps" }, { v: "agacement", label: "C'est agaçant, sans plus" }, { v: "rien", label: "Pas grand-chose" } ] },
  { id: "payer", type: "choix", label: "Combien pourraient-ils payer par mois ?", aide: "Ton estimation, à confirmer avec de vrais clients.", options: [
    { v: "0", label: "Rien" }, { v: "petit", label: "1 à 5 €" }, { v: "moyen", label: "5 à 20 €" }, { v: "eleve", label: "Plus de 20 €" } ] },
  { id: "entretiens", type: "choix", label: "As-tu déjà parlé à des clients potentiels ?", aide: "Des conversations sur leur problème, pas sur ton idée.", options: [
    { v: "0", label: "Pas encore" }, { v: "1-4", label: "1 à 4 personnes" }, { v: "5-9", label: "5 à 9 personnes" }, { v: "10+", label: "10 personnes ou plus" } ] },
  { id: "concurrents", type: "choix", label: "Existe-t-il des concurrents ?", aide: "Des concurrents prouvent souvent qu'un marché existe.", options: [
    { v: "inconnu", label: "Je n'ai pas cherché" }, { v: "aucun", label: "Je n'en ai trouvé aucun" }, { v: "quelques", label: "Quelques-uns" }, { v: "nombreux", label: "Beaucoup" } ] },
  { id: "acces", type: "choix", label: "Comment peux-tu atteindre les premiers utilisateurs ?", aide: "Les 20 premiers utilisateurs se trouvent rarement par hasard.", options: [
    { v: "communaute", label: "J'en fais partie ou j'ai une audience" }, { v: "reseau", label: "Je connais des personnes concernées" },
    { v: "reseaux", label: "Par les réseaux sociaux, sans audience" }, { v: "aucun", label: "Je ne sais pas encore" } ] },
];

export type Report = {
  complet: boolean;
  repondu: number;
  solidite: number; // 0 → 100 : solidité des réponses, pas une note du marché
  forces: string[];
  hypotheses: string[];
  risques: string[];
  experiences: string[];
  checklist: { id: string; label: string }[];
  recommandation: { titre: string; texte: string; action: "completer" | "entretiens" | "modele" | "canal" | "landing" | "constructeur" };
};

export function isAnswered(a: ValidationAnswers, id: string) {
  return (a[id] ?? "").trim().length > 0;
}

export function buildReport(a: ValidationAnswers): Report {
  const repondu = QUESTIONS.filter((q) => isAnswered(a, q.id)).length;
  const forces: string[] = [];
  const hypotheses: string[] = [];
  const risques: string[] = [];
  const experiences: string[] = [];
  let points = 0;

  // Fréquence
  if (a.frequence === "quotidien" || a.frequence === "hebdo") { forces.push("Le problème revient souvent : l'outil peut devenir une habitude."); points += 15; }
  else if (a.frequence === "mensuel") points += 8;
  else if (a.frequence === "rare") risques.push("Problème rare : un abonnement mensuel sera difficile à justifier. Envisage un paiement unique.");

  // Enjeu
  if (a.enjeu === "argent") { forces.push("Enjeu financier : la valeur de la solution se chiffre facilement."); points += 15; }
  else if (a.enjeu === "temps") { forces.push("Gain de temps concret à mettre en avant."); points += 10; }
  else if (a.enjeu === "agacement") { points += 3; hypotheses.push("L'agacement suffit-il à faire changer d'outil ? À vérifier en entretien."); }
  else if (a.enjeu === "rien") risques.push("Peu de conséquences si le problème n'est pas résolu : la motivation à payer sera faible.");

  // Solutions actuelles
  if (a.actuel === "bricolage") { forces.push("Les gens bricolent déjà une solution : le besoin est réel."); points += 12; }
  else if (a.actuel === "payant") { forces.push("Des gens paient déjà pour ce problème : le marché existe."); points += 12; risques.push("Il faudra une vraie différence avec l'outil payant actuel."); }
  else if (a.actuel === "gratuit") { points += 4; risques.push("Faire payer face à un outil gratuit demande une différence nette."); }
  else if (a.actuel === "rien") hypotheses.push("Personne ne fait rien : est-ce un vrai problème ou un problème toléré ?");

  // Prix
  if (a.payer === "eleve" || a.payer === "moyen") { forces.push("Disposition à payer estimée correcte."); points += a.payer === "eleve" ? 15 : 12; hypotheses.push("Le prix envisagé est une estimation : il doit être confirmé par une prévente."); }
  else if (a.payer === "petit") { points += 6; hypotheses.push("À petit prix, il faudra beaucoup de clients : vérifie la taille de la cible."); }
  else if (a.payer === "0") risques.push("Aucune disposition à payer : le modèle économique est à revoir (publicité, entreprises, partenariats).");

  // Entretiens
  if (a.entretiens === "10+") { forces.push("Tu as déjà parlé à 10 personnes ou plus."); points += 20; }
  else if (a.entretiens === "5-9") { forces.push("Premiers entretiens réalisés."); points += 14; }
  else if (a.entretiens === "1-4") { points += 6; hypotheses.push("Quelques personnes ne suffisent pas : vise au moins 5 entretiens."); }
  else if (a.entretiens === "0") hypotheses.push("Le problème n'est pas encore confirmé par d'autres personnes que toi.");

  // Concurrence
  if (a.concurrents === "quelques") { points += 8; experiences.push("Lis les avis négatifs de 3 concurrents et note ce qui revient le plus."); }
  else if (a.concurrents === "nombreux") { points += 4; risques.push("Marché encombré : il faudra une cible plus précise ou un angle différent."); }
  else if (a.concurrents === "aucun") hypotheses.push("Aucun concurrent trouvé : c'est soit une opportunité, soit l'absence de marché. Cherche des alternatives indirectes.");
  else if (a.concurrents === "inconnu") hypotheses.push("La concurrence n'a pas été étudiée.");

  // Accès
  if (a.acces === "communaute" || a.acces === "reseau") { forces.push("Tu as un accès direct à tes premiers utilisateurs."); points += a.acces === "communaute" ? 15 : 10; }
  else if (a.acces === "reseaux") { points += 4; hypotheses.push("Les réseaux sociaux sans audience demandent du temps : prévois une publication régulière."); }
  else if (a.acces === "aucun") risques.push("Aucun canal identifié pour trouver les premiers utilisateurs.");

  // Expériences
  if (a.entretiens === "0" || a.entretiens === "1-4") experiences.push("Mène 5 entretiens sur la dernière fois où la personne a vécu le problème.");
  if (a.payer && a.payer !== "0") experiences.push("Ouvre une prévente ou une liste d'attente avec prix affiché, et fixe un seuil de réussite.");
  if (a.acces === "aucun" || a.acces === "reseaux") experiences.push("Trouve 3 communautés en ligne où ta cible discute du problème.");
  experiences.push("Publie la landing page générée et mesure le taux d'inscription sur 2 semaines.");

  const checklist = [
    { id: "val-phrase", label: "Le problème tient en une phrase compréhensible" },
    { id: "val-5", label: "5 entretiens réalisés avec la cible" },
    { id: "val-concurrents", label: "3 concurrents ou alternatives étudiés" },
    { id: "val-landing", label: "Landing page publiée avec liste d'attente" },
    { id: "val-seuil", label: "Seuil de réussite fixé avant le test" },
    { id: "val-paiement", label: "Au moins une personne prête à payer (prévente, engagement)" },
  ];

  const recommandation: Report["recommandation"] =
    repondu < QUESTIONS.length
      ? { action: "completer", titre: "Termine le questionnaire", texte: `Il reste ${QUESTIONS.length - repondu} question${QUESTIONS.length - repondu > 1 ? "s" : ""}. La recommandation dépend de l'ensemble de tes réponses.` }
      : a.entretiens === "0" || a.entretiens === "1-4"
      ? { action: "entretiens", titre: "Parle à des clients avant de construire", texte: "Ton idée repose encore surtout sur tes suppositions. Cinq entretiens te diront si le problème est partagé." }
      : a.payer === "0" || a.enjeu === "rien"
        ? { action: "modele", titre: "Revois le modèle économique", texte: "Le problème existe peut-être, mais rien n'indique que quelqu'un paiera. Teste d'autres cibles ou un autre modèle de revenus." }
        : a.acces === "aucun"
          ? { action: "canal", titre: "Trouve un canal d'acquisition", texte: "Sans moyen d'atteindre tes premiers utilisateurs, même un bon produit restera invisible." }
          : risques.length >= 2
            ? { action: "landing", titre: "Teste la demande avec une landing", texte: "Plusieurs risques restent ouverts. Une landing avec liste d'attente les testera à moindre coût." }
            : { action: "constructeur", titre: "Passe au constructeur", texte: "Tes réponses sont solides. Assemble ton prototype et montre-le à tes contacts." };

  return {
    complet: repondu === QUESTIONS.length,
    repondu,
    solidite: Math.min(100, points),
    forces, hypotheses, risques, experiences, checklist, recommandation,
  };
}
