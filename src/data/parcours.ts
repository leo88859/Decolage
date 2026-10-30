// Parcours « Apprendre » : conseils et checklists pratiques, écrits à l'avance (aucune IA).
// Les cases cochées sont enregistrées sous la clé `p:<parcours>.<case>`.
import { PARCOURS_COLORS } from "@/lib/a11y/accents";

export type Etape = { id: string; titre: string; pourquoi: string; conseils: string[]; checks: [string, string][] };
export type Parcours = { id: string; titre: string; accroche: string; duree: string; couleur: string; etapes: Etape[]; outil?: { label: string; onglet: string } };

export const PARCOURS: Parcours[] = [
  {
    id: "valider", titre: "Valider une idée", accroche: "Savoir si des gens ont vraiment le problème, avant de construire.", duree: "1 à 2 semaines", couleur: PARCOURS_COLORS.valider,
    outil: { label: "Questionnaire de validation du projet", onglet: "validation" },
    etapes: [
      { id: "probleme", titre: "Écrire le problème en une phrase", pourquoi: "Si tu ne peux pas le dire simplement, personne ne le comprendra.", conseils: ["Parle du problème, pas de ta solution : « Les coiffeurs perdent du temps au téléphone » plutôt que « une appli de réservation ».", "Précise qui l'a et à quel moment il le gêne.", "Évite les mots vagues comme « simplifier » ou « optimiser »."], checks: [["phrase", "J'ai écrit le problème en une phrase, sans parler de ma solution"], ["qui", "Je sais exactement qui a ce problème (métier, âge, situation)"]] },
      { id: "entretiens", titre: "Parler à 10 personnes concernées", pourquoi: "Dix conversations valent mieux que cent avis d'amis.", conseils: ["Demande comment ils font aujourd'hui, pas s'ils aimeraient ton idée.", "Fais-les raconter la dernière fois que le problème s'est produit.", "Note les mots qu'ils utilisent : tu les réutiliseras sur ta page de vente."], checks: [["liste", "J'ai une liste de 10 personnes à contacter"], ["5", "J'ai eu au moins 5 conversations"], ["10", "J'ai eu 10 conversations et noté leurs réponses"]] },
      { id: "alternatives", titre: "Lister les solutions actuelles", pourquoi: "Tes vrais concurrents sont souvent un tableur, un cahier ou WhatsApp.", conseils: ["Note ce que les gens utilisent déjà, même bricolé.", "Cherche ce qu'ils détestent dans ces solutions.", "Une solution gratuite déjà en place est un concurrent sérieux : ta différence doit être nette."], checks: [["liste", "J'ai listé au moins 3 solutions utilisées aujourd'hui"], ["defaut", "Je sais ce qui manque ou agace dans chacune"]] },
      { id: "preuve", titre: "Obtenir une preuve d'intérêt", pourquoi: "Un « oui ça m'intéresse » ne coûte rien. Un email ou un acompte, si.", conseils: ["Publie ta page de vente avec une liste d'attente (onglet « En ligne » d'un projet).", "Fixe-toi un objectif avant de lancer : par exemple 30 inscrits en 2 semaines.", "Encore mieux : propose une précommande ou un tarif fondateur."], checks: [["page", "Ma page de vente est en ligne avec une liste d'attente"], ["objectif", "J'ai fixé un objectif chiffré d'inscrits"], ["atteint", "J'ai atteint mon objectif (ou j'ai compris pourquoi pas)"]] },
    ],
  },
  {
    id: "mvp", titre: "Définir un MVP", accroche: "La plus petite version utile, livrable en quelques semaines.", duree: "2 à 6 semaines", couleur: PARCOURS_COLORS.mvp,
    outil: { label: "Feuille de route du projet", onglet: "feuille" },
    etapes: [
      { id: "promesse", titre: "Choisir une seule promesse", pourquoi: "Un MVP qui fait tout ne fait rien de bien.", conseils: ["Termine la phrase : « Avec mon SaaS, tu peux enfin… ».", "Tout ce qui ne sert pas cette promesse attendra la version 2.", "Garde ta liste d'idées « plus tard » pour ne pas les perdre."], checks: [["phrase", "Ma promesse tient en une phrase"], ["plus-tard", "J'ai une liste « plus tard » pour les idées secondaires"]] },
      { id: "parcours", titre: "Dessiner le parcours principal", pourquoi: "C'est ce que l'utilisateur fera 90 % du temps.", conseils: ["Écris les 3 à 5 écrans indispensables, de l'arrivée au résultat.", "Utilise le prototype du constructeur pour le tester toi-même.", "Fais-le tester à 3 personnes sans rien leur expliquer."], checks: [["ecrans", "J'ai listé les 3 à 5 écrans indispensables"], ["proto", "J'ai personnalisé le prototype dans le constructeur"], ["test", "3 personnes ont testé le parcours sans aide"]] },
      { id: "couper", titre: "Couper sans pitié", pourquoi: "Chaque fonction en plus retarde le lancement et ajoute des bugs.", conseils: ["Pour chaque fonction, demande-toi : un premier client partirait-il sans elle ?", "Remplace l'automatique par du manuel au début (un email envoyé à la main, par exemple).", "Désactive dans le constructeur les briques qui ne servent pas la promesse."], checks: [["revue", "J'ai passé chaque fonction au test « partirait-il sans elle ? »"], ["briques", "Seules les briques utiles sont activées"]] },
      { id: "date", titre: "Fixer une date de sortie", pourquoi: "Sans date, un MVP n'est jamais fini.", conseils: ["Vise 4 à 6 semaines, pas plus.", "Annonce la date à tes inscrits : ça t'engage.", "Le jour J, sors même si tout n'est pas parfait."], checks: [["date", "J'ai une date de sortie dans moins de 6 semaines"], ["annonce", "Je l'ai annoncée à au moins une personne"]] },
    ],
  },
  {
    id: "prix", titre: "Choisir un prix", accroche: "Un prix simple, justifié par la valeur, testé auprès de vrais clients.", duree: "quelques jours", couleur: PARCOURS_COLORS.prix,
    outil: { label: "Labo des prix du projet", onglet: "prix" },
    etapes: [
      { id: "valeur", titre: "Estimer la valeur pour le client", pourquoi: "On paie pour un gain, pas pour des fonctionnalités.", conseils: ["Combien de temps ou d'argent ton SaaS fait-il gagner par mois ?", "Un bon prix se situe souvent autour de 10 % de ce gain.", "Pour un particulier, compare à ce qu'il dépense déjà (abonnements, applis)."], checks: [["gain", "J'ai estimé le gain mensuel pour un client type"], ["calcul", "J'ai déduit une fourchette de prix"]] },
      { id: "modele", titre: "Choisir le modèle de revenus", pourquoi: "Abonnement, paiement unique ou commission : le choix change tout le reste.", conseils: ["Abonnement : si le client utilise ton SaaS chaque semaine.", "Paiement unique : pour un outil ponctuel ou un produit fini.", "Commission : si tu fais gagner de l'argent à chaque transaction."], checks: [["choisi", "J'ai choisi mon modèle de revenus"], ["constructeur", "Il est réglé dans le constructeur (étape Personnalisation)"]] },
      { id: "offres", titre: "Construire 2 ou 3 offres", pourquoi: "Une offre du milieu bien placée aide le client à décider.", conseils: ["Pas plus de 3 offres, avec des noms clairs.", "Différencie-les par la quantité ou le niveau de service, pas par des détails.", "Un essai gratuit limité dans le temps rassure sans brader."], checks: [["offres", "J'ai 2 ou 3 offres avec des différences nettes"], ["labo", "Je les ai comparées dans le labo des prix"]] },
      { id: "test", titre: "Tester le prix", pourquoi: "Personne ne connaît le bon prix avant d'avoir demandé de l'argent.", conseils: ["Annonce le prix pendant tes entretiens et observe la réaction.", "Si personne ne trouve ça cher, c'est souvent trop bas.", "Prévois un tarif fondateur réservé aux premiers clients."], checks: [["annonce", "J'ai annoncé mon prix à au moins 5 personnes"], ["ajuste", "J'ai ajusté le prix selon leurs réactions"]] },
    ],
  },
  {
    id: "lancer", titre: "Lancer son produit", accroche: "Trouver tes premiers utilisateurs et apprendre d'eux.", duree: "2 à 4 semaines", couleur: PARCOURS_COLORS.lancer,
    outil: { label: "Plan de lancement du projet", onglet: "lancement" },
    etapes: [
      { id: "page", titre: "Préparer la page de vente", pourquoi: "C'est ta vitrine : elle doit dire en 5 secondes à qui tu t'adresses.", conseils: ["Un titre qui parle du résultat, pas de la technique.", "Reprends les mots entendus pendant tes entretiens.", "Un seul bouton principal, répété en bas de page."], checks: [["titre", "Mon titre parle du résultat pour le client"], ["publiee", "Ma page est publiée en ligne"]] },
      { id: "canaux", titre: "Choisir 2 canaux d'acquisition", pourquoi: "Être partout, c'est n'être visible nulle part.", conseils: ["Va là où ta cible est déjà : groupes Facebook, Discord, forums, salons pros.", "Apporte de l'aide avant de parler de ton produit.", "Mesure d'où viennent tes inscrits pour garder ce qui marche."], checks: [["deux", "J'ai choisi 2 canaux où ma cible est présente"], ["contenu", "J'ai préparé 3 messages ou publications utiles"]] },
      { id: "jour-j", titre: "Organiser le jour du lancement", pourquoi: "Un lancement concentré fait plus de bruit qu'une sortie discrète.", conseils: ["Préviens ta liste d'attente la veille et le jour même.", "Demande à 5 proches de partager au même moment.", "Reste disponible toute la journée pour répondre."], checks: [["liste", "J'ai prévenu ma liste d'attente"], ["relais", "5 personnes ont accepté de partager"], ["lance", "Mon SaaS est lancé"]] },
      { id: "apres", titre: "Écouter et améliorer", pourquoi: "Les premières semaines décident de la suite.", conseils: ["Appelle tes 10 premiers utilisateurs.", "Suis 2 ou 3 indicateurs seulement : inscrits, actifs, payants.", "Corrige d'abord ce qui empêche d'utiliser le produit, ensuite le reste."], checks: [["appels", "J'ai parlé à mes 10 premiers utilisateurs"], ["indicateurs", "Je suis 2 ou 3 indicateurs chaque semaine"]] },
    ],
  },
];

export const PARCOURS_BY_ID = Object.fromEntries(PARCOURS.map((p) => [p.id, p])) as Record<string, Parcours>;
export const checkKey = (p: string, e: string, c: string) => `p:${p}.${e}.${c}`;
export const allKeys = (p: Parcours) => p.etapes.flatMap((e) => e.checks.map(([c]) => checkKey(p.id, e.id, c)));
