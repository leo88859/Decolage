// Bibliothèque d'actions de lancement préécrites. `tags` vide = action utile pour tout projet.
// Un projet reçoit les actions universelles + celles dont un tag correspond à son modèle.

export type LaunchAction = { id: string; titre: string; description: string; semaine: number; priorite: "haute" | "moyenne" | "basse"; tags: string[] };

export const LAUNCH_ACTIONS: LaunchAction[] = [
  { id: "page", titre: "Préparer la page de présentation", description: "Publie la landing exportée avec un appel à l'action clair.", semaine: 1, priorite: "haute", tags: [] },
  { id: "liste", titre: "Créer une liste d'attente", description: "Collecte des emails avant même que le produit soit prêt.", semaine: 1, priorite: "haute", tags: [] },
  { id: "vingt", titre: "Identifier 20 utilisateurs potentiels", description: "Des noms précis, pas « les étudiants » : où les trouver et comment les contacter.", semaine: 1, priorite: "haute", tags: [] },
  { id: "entretiens", titre: "Réaliser 5 entretiens", description: "Montre le prototype et observe, sans vendre.", semaine: 2, priorite: "haute", tags: [] },
  { id: "demo", titre: "Publier une démonstration", description: "Une vidéo de 30 secondes du parcours principal.", semaine: 2, priorite: "moyenne", tags: [] },
  { id: "contenus", titre: "Préparer 5 contenus courts", description: "Le problème, l'avant/après, les coulisses de la construction.", semaine: 2, priorite: "moyenne", tags: ["contenu", "jeunes", "communaute"] },
  { id: "offre", titre: "Créer une offre de lancement", description: "Une réduction ou un bonus limité dans le temps pour les premiers clients.", semaine: 3, priorite: "moyenne", tags: [] },
  { id: "retours", titre: "Collecter les retours", description: "Un formulaire court après la première utilisation.", semaine: 3, priorite: "haute", tags: [] },
  { id: "activation", titre: "Mesurer l'activation", description: "Part des inscrits qui réalisent l'action clé dans la semaine.", semaine: 4, priorite: "haute", tags: [] },
  { id: "corrections", titre: "Corriger les problèmes les plus fréquents", description: "Les 3 blocages les plus cités d'abord.", semaine: 4, priorite: "haute", tags: [] },
  { id: "commerces", titre: "Démarcher 10 commerces à pied", description: "Une démonstration de 2 minutes sur place, avec un essai gratuit.", semaine: 2, priorite: "haute", tags: ["local"] },
  { id: "groupes-locaux", titre: "Publier dans les groupes locaux", description: "Groupes de quartier et de ville, en respectant leurs règles.", semaine: 2, priorite: "moyenne", tags: ["local", "services"] },
  { id: "fiche-google", titre: "Créer une fiche d'établissement", description: "Pour apparaître dans les recherches locales.", semaine: 1, priorite: "basse", tags: ["local"] },
  { id: "linkedin", titre: "Contacter des décideurs sur LinkedIn", description: "10 messages personnalisés par jour pendant une semaine.", semaine: 2, priorite: "haute", tags: ["b2b"] },
  { id: "pilote", titre: "Proposer un pilote gratuit d'un mois", description: "À 3 entreprises, contre un retour détaillé et un témoignage si satisfaites.", semaine: 3, priorite: "haute", tags: ["b2b", "freelance"] },
  { id: "freelances-communautes", titre: "Partager dans des communautés de freelances", description: "Apporte une ressource utile avant de présenter ton outil.", semaine: 2, priorite: "moyenne", tags: ["freelance"] },
  { id: "seo-pages", titre: "Créer 5 pages utiles pour le référencement", description: "Des pages qui répondent aux questions que ta cible tape sur les moteurs de recherche.", semaine: 3, priorite: "moyenne", tags: ["seo"] },
  { id: "amorcage", titre: "Amorcer le contenu avant l'ouverture", description: "Un annuaire ou une bibliothèque vide n'attire personne.", semaine: 1, priorite: "haute", tags: ["seo", "contenu"] },
  { id: "parrainage", titre: "Lancer un parrainage simple", description: "Une récompense pour chaque ami invité qui s'inscrit.", semaine: 4, priorite: "basse", tags: ["validation", "communaute"] },
  { id: "seuil", titre: "Fixer un seuil de réussite", description: "Combien d'inscrits ou de préventes justifient de continuer ?", semaine: 1, priorite: "haute", tags: ["validation"] },
  { id: "prevente", titre: "Ouvrir une prévente", description: "Faire payer avant de livrer est le test le plus fiable.", semaine: 3, priorite: "haute", tags: ["ecommerce", "contenu", "validation"] },
  { id: "tiktok", titre: "Publier une série « je construis mon SaaS »", description: "Une vidéo courte par jour pendant 7 jours, en montrant l'avancement réel.", semaine: 2, priorite: "moyenne", tags: ["jeunes", "contenu"] },
  { id: "photos-produits", titre: "Soigner les photos produits", description: "Fond neutre, lumière naturelle, 3 angles par produit.", semaine: 1, priorite: "moyenne", tags: ["ecommerce"] },
  { id: "ambassadeurs", titre: "Recruter 3 ambassadeurs", description: "Des utilisateurs engagés qui parlent du produit dans leur entourage.", semaine: 4, priorite: "basse", tags: ["communaute", "jeunes"] },
];
