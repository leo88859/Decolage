import type { RoadmapStepId, RoadmapTaskDef } from "@/lib/types";

export const ROADMAP_STEPS: { id: RoadmapStepId; titre: string }[] = [
  { id: "probleme", titre: "Préciser le problème" },
  { id: "entretiens", titre: "Interroger des utilisateurs" },
  { id: "mvp", titre: "Définir le MVP" },
  { id: "ecrans", titre: "Préparer les écrans" },
  { id: "construction", titre: "Construire les fonctionnalités" },
  { id: "tests", titre: "Tester les parcours" },
  { id: "legal", titre: "Conditions et confidentialité" },
  { id: "paiements", titre: "Mettre en place les paiements" },
  { id: "deploiement", titre: "Déployer" },
  { id: "premiers", titre: "Trouver les premiers utilisateurs" },
];

// Tâches communes à tous les modèles. Les modèles ajoutent leurs propres tâches (voir templates.ts).
export const BASE_TASKS: Record<RoadmapStepId, RoadmapTaskDef[]> = {
  probleme: [
    { id: "probleme-phrase", titre: "Écrire le problème en une phrase", description: "Formule le problème du point de vue de l'utilisateur, sans parler de ta solution.", checklist: ["Une phrase de moins de 25 mots", "Le mot « je » du point de vue utilisateur", "Aucune mention de ta solution"], duree: "30 min", ressources: ["Modèle : « Quand je …, j'ai du mal à …, ce qui me fait … »"] },
    { id: "probleme-alternatives", titre: "Lister les solutions actuelles", description: "Comment les gens se débrouillent aujourd'hui : outils, tableurs, papier, rien.", checklist: ["3 alternatives identifiées", "Ce qui manque à chacune"], duree: "1 h", ressources: [] },
  ],
  entretiens: [
    { id: "entretiens-liste", titre: "Trouver 10 personnes à interroger", description: "Des personnes qui vivent le problème, pas seulement des proches bienveillants.", checklist: ["10 contacts identifiés", "Message d'approche envoyé", "5 rendez-vous fixés"], duree: "2 h", ressources: ["Message type : « Je fais une étude sur … Aurais-tu 15 minutes cette semaine ? »"] },
    { id: "entretiens-mener", titre: "Mener les entretiens", description: "Pose des questions sur leur passé, pas sur ton idée. Note les mots exacts.", checklist: ["5 entretiens réalisés", "Notes prises pour chacun", "Problèmes récurrents surlignés"], duree: "5 h", ressources: ["Questions : « Raconte-moi la dernière fois que … », « Qu'as-tu essayé ? », « Qu'est-ce qui était le plus pénible ? »"] },
  ],
  mvp: [
    { id: "mvp-fonctions", titre: "Choisir 3 fonctionnalités maximum", description: "Le MVP résout le problème principal, rien de plus. Le reste attendra.", checklist: ["3 fonctionnalités écrites", "Liste « plus tard » séparée", "Le parcours principal tient en 5 étapes"], duree: "1 h", ressources: ["La liste des briques actives dans le constructeur"] },
  ],
  ecrans: [
    { id: "ecrans-parcours", titre: "Dessiner le parcours principal", description: "De l'arrivée à l'action clé : un croquis par écran suffit.", checklist: ["Écrans du parcours principal", "Textes des boutons", "Test du croquis sur 2 personnes"], duree: "2 h", ressources: ["Le prototype du constructeur sert de point de départ"] },
  ],
  construction: [
    { id: "construction-socle", titre: "Monter le socle technique", description: "Choisis l'outil (no-code ou code) et reproduis la configuration exportée.", checklist: ["Outil choisi", "Configuration exportée importée ou recopiée", "Première page fonctionnelle"], duree: "1 à 3 jours", ressources: ["Fichier decollage.json exporté depuis le constructeur"] },
    { id: "construction-fonctions", titre: "Construire les fonctionnalités du MVP", description: "Une fonctionnalité à la fois, testée avant de passer à la suivante.", checklist: ["Fonctionnalité 1", "Fonctionnalité 2", "Fonctionnalité 3"], duree: "1 à 3 semaines", ressources: [] },
  ],
  tests: [
    { id: "tests-parcours", titre: "Faire tester le parcours à 3 personnes", description: "Regarde-les utiliser le produit sans les aider et note où ils bloquent.", checklist: ["3 sessions de test", "Blocages notés", "Corrections prioritaires faites"], duree: "3 h", ressources: [] },
    { id: "tests-mobile", titre: "Vérifier sur mobile", description: "La majorité des visiteurs arrivent sur téléphone.", checklist: ["iPhone", "Android", "Petit écran"], duree: "1 h", ressources: [] },
  ],
  legal: [
    { id: "legal-mentions", titre: "Mentions légales et confidentialité", description: "Obligatoires dès que le site est public et collecte des données.", checklist: ["Mentions légales", "Politique de confidentialité", "Consentement aux cookies si nécessaire"], duree: "2 h", ressources: ["Modèles et explications sur cnil.fr"] },
    { id: "legal-cgu", titre: "Conditions d'utilisation", description: "Ce que l'utilisateur peut faire, tes responsabilités, la résiliation.", checklist: ["CGU rédigées", "Lien visible en bas de page", "Acceptation à l'inscription"], duree: "2 h", ressources: [] },
  ],
  paiements: [
    { id: "paiements-statut", titre: "Choisir un statut pour encaisser", description: "Pour vendre, il faut un statut (micro-entreprise par exemple). Renseigne-toi avant le premier paiement.", checklist: ["Statut choisi", "Immatriculation faite", "Compte bancaire dédié"], duree: "Variable", ressources: ["Démarches sur autoentrepreneur.urssaf.fr"] },
    { id: "paiements-outil", titre: "Brancher un prestataire de paiement", description: "Utilise un prestataire reconnu plutôt que de gérer les cartes toi-même.", checklist: ["Compte prestataire créé", "Paiement de test réussi", "Email de confirmation envoyé"], duree: "1 jour", ressources: [] },
  ],
  deploiement: [
    { id: "deploiement-hebergement", titre: "Mettre en ligne", description: "Héberge l'application et la landing page, puis branche ton nom de domaine.", checklist: ["Hébergement choisi", "Nom de domaine acheté et branché", "HTTPS actif"], duree: "1 jour", ressources: ["La landing exportée est un site statique hébergeable gratuitement"] },
    { id: "deploiement-sauvegardes", titre: "Prévoir sauvegardes et suivi des erreurs", description: "Avant d'accueillir des utilisateurs réels, sache récupérer les données et voir les erreurs.", checklist: ["Sauvegarde automatique de la base", "Alerte en cas d'erreur", "Procédure de restauration testée"], duree: "3 h", ressources: [] },
  ],
  premiers: [
    { id: "premiers-20", titre: "Contacter 20 utilisateurs potentiels un par un", description: "Les premiers utilisateurs se trouvent à la main, pas avec de la publicité.", checklist: ["Liste de 20 personnes", "Message personnalisé envoyé", "Retours notés"], duree: "4 h", ressources: ["Plan de lancement (onglet Lancement)"] },
    { id: "premiers-mesure", titre: "Mesurer l'activation", description: "Combien d'inscrits réalisent l'action clé dans la première semaine ?", checklist: ["Action clé définie", "Chiffre relevé chaque semaine (onglet Indicateurs)"], duree: "1 h", ressources: [] },
  ],
};
