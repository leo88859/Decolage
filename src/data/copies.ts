import type { TemplateId } from "@/lib/types";

// Textes à trous par type de SaaS. Variables : {nom} {clients} {client} {pros} {metier} {lieu}
// {action} {douleur} {benefice} {offre} {categorie}. Les phrases évitent les pronoms accordés
// avec {clients} pour rester justes au masculin comme au féminin.

export type Copie = {
  heroTitre: string[];
  heroSous: string;
  features: [string, string][];
  etapes: [string, string][];
  avantages: string[];
  faq: [string, string][];
  cta: string;
  cible: "pros" | "perso"; // à qui parle la landing : aux professionnels, ou directement à l'utilisateur
};

export const COPIES: Record<TemplateId, Copie> = {
  "rendez-vous": {
    cible: "pros",
    heroTitre: ["Tes {clients} réservent en 30 secondes", "Ton {lieu} complet, sans décrocher le téléphone"],
    heroSous: "{nom} aide les {pros} à proposer leurs créneaux en ligne. Fini {douleur} : place à {benefice}.",
    features: [["Réservation 24 h/24", "Choix du créneau et de la prestation en ligne, même à minuit."], ["Rappels automatiques", "Un rappel avant chaque rendez-vous, pour beaucoup moins d'oublis."], ["Agenda centralisé", "Tous les rendez-vous au même endroit, sur ordinateur et téléphone."], ["Fiche de chaque {client}", "L'historique des visites et les préférences, toujours sous la main."]],
    etapes: [["Ouvre tes créneaux", "Tes horaires et tes prestations, en quelques clics."], ["Partage ton lien", "En bio, sur ta fiche Google ou par message."], ["Reçois les réservations", "Elles arrivent directement dans ton agenda."]],
    avantages: ["Moins d'appels pendant le travail", "Des créneaux vides remplis automatiquement", "Une image plus professionnelle"],
    faq: [["Faut-il créer un compte pour réserver ?", "Non : un nom et un email suffisent."], ["Puis-je bloquer des jours ?", "Oui, absences et horaires se modifient à tout moment."], ["Combien de temps pour démarrer ?", "Une dizaine de minutes pour ajouter tes prestations et tes horaires."]],
    cta: "Remplis ton agenda",
  },
  abonnement: {
    cible: "pros",
    heroTitre: ["Transforme ta passion en revenu chaque mois", "Le meilleur de {nom}, réservé aux membres"],
    heroSous: "{nom} permet aux {pros} de proposer un abonnement avec des contenus exclusifs. Un revenu régulier plutôt que {douleur}.",
    features: [["Contenus exclusifs", "Vidéos, guides et fichiers accessibles seulement aux membres."], ["Paiement mensuel automatique", "L'abonnement se renouvelle tout seul, la résiliation reste simple."], ["Espace membre", "Chaque membre retrouve tout au même endroit."], ["Communauté", "Un fil d'échanges pour garder le lien entre chaque publication."]],
    etapes: [["Publie tes premiers contenus", "Quelques exclusivités suffisent pour démarrer."], ["Fixe ton prix", "Mensuel, annuel, ou les deux."], ["Partage ton lien", "Ta communauté s'abonne en une minute."]],
    avantages: ["Un revenu prévisible chaque mois", "Une communauté plus proche", "Tes contenus enfin organisés"],
    faq: [["Peut-on résilier quand on veut ?", "Oui, depuis l'espace membre, sans justification."], ["Y a-t-il du contenu gratuit ?", "Oui, une partie reste en accès libre pour donner envie."], ["Quels formats sont possibles ?", "Articles, vidéos, fichiers à télécharger et lives."]],
    cta: "Lance ton abonnement",
  },
  annuaire: {
    cible: "perso",
    heroTitre: ["Trouve les meilleurs {pros} près de chez toi", "Tous les {pros} de ta ville, au même endroit"],
    heroSous: "{nom} rassemble des fiches claires et vérifiées. Fini {douleur} : compare et contacte en un clic.",
    features: [["Recherche rapide", "Par nom, spécialité ou ville."], ["Fiches complètes", "Horaires, tarifs, avis et contact sur une seule page."], ["Carte interactive", "Visualise qui est le plus proche de toi."], ["Favoris", "Garde tes adresses préférées pour plus tard."]],
    etapes: [["Cherche", "Tape ce dont tu as besoin."], ["Compare", "Filtre par spécialité, distance et note."], ["Contacte", "Directement depuis la fiche."]],
    avantages: ["Du temps gagné pour trouver la bonne adresse", "Des fiches vérifiées avant publication", "De la visibilité pour les professionnels inscrits"],
    faq: [["Comment ajouter une fiche ?", "Via le formulaire « Proposer une fiche » : elle est vérifiée avant publication."], ["L'inscription est-elle gratuite ?", "Oui, la mise en avant est une option payante."], ["Les avis sont-ils vérifiés ?", "Seuls les avis liés à un contact réel sont publiés."]],
    cta: "Explore l'annuaire",
  },
  "liste-attente": {
    cible: "perso",
    heroTitre: ["{nom} arrive bientôt", "Sois parmi les premiers à essayer {nom}"],
    heroSous: "Le nouvel outil pensé pour les {pros}, pour en finir avec {douleur}. Inscris-toi pour un accès en avant-première.",
    features: [["Accès en avant-première", "Les premiers inscrits testent avant tout le monde."], ["Parrainage", "Invite des amis pour remonter dans la file."], ["Offre de lancement", "Un tarif réservé aux premiers inscrits."], ["Zéro spam", "Un email au lancement, c'est tout."]],
    etapes: [["Laisse ton email", "Ça prend 5 secondes."], ["Partage ton lien", "Chaque ami inscrit te fait gagner des places."], ["Reçois ton accès", "Le jour du lancement."]],
    avantages: ["Tester avant tout le monde", "Donner ton avis sur le produit", "Profiter d'un prix de lancement"],
    faq: [["L'inscription est-elle gratuite ?", "Oui, et elle n'engage à rien."], ["Quand aura lieu le lancement ?", "Tu seras prévenu·e par email dès que c'est prêt."], ["Comment gagner des places ?", "En partageant ton lien de parrainage."]],
    cta: "Je m'inscris",
  },
  boutique: {
    cible: "pros",
    heroTitre: ["Les créations de {nom}, livrées chez toi", "Ta boutique en ligne, prête en un après-midi"],
    heroSous: "{nom} permet aux {pros} de vendre en ligne simplement. Fini {douleur} : place à {benefice}.",
    features: [["Catalogue soigné", "Photos, prix et stock toujours à jour."], ["Panier et commande", "Un achat en quelques clics, sur téléphone aussi."], ["Suivi des commandes", "Chaque commande, de la préparation à la livraison."], ["Fiches produits", "Matières, tailles et conseils : moins de questions, moins de retours."]],
    etapes: [["Ajoute tes produits", "Une photo, un prix, une description."], ["Partage ta boutique", "Lien en bio et sur tes réseaux."], ["Encaisse tes ventes", "Paiement sécurisé et commandes centralisées."]],
    avantages: ["Vendre même quand tu dors", "Des stocks suivis sans tableur", "Des clients qui reviennent"],
    faq: [["Quels sont les délais de livraison ?", "Ils sont indiqués sur chaque fiche produit."], ["Peut-on retourner un article ?", "Oui, avec 14 jours pour changer d'avis."], ["Le paiement est-il sécurisé ?", "Oui, il passe par un prestataire de paiement reconnu."]],
    cta: "Découvre la boutique",
  },
  reservations: {
    cible: "pros",
    heroTitre: ["Fini les doubles réservations", "Tout ce qui se réserve, enfin organisé"],
    heroSous: "{nom} aide les {pros} à gérer les réservations sans tableau ni messages. Fini {douleur} : place à {benefice}.",
    features: [["Disponibilités en temps réel", "Chacun voit ce qui est libre, à l'instant."], ["Calendrier du mois", "Une vue claire de toutes les réservations."], ["Validation des demandes", "Tu gardes la main, ou tu automatises."], ["Rappels", "Un message avant chaque réservation."]],
    etapes: [["Ajoute ce qui se réserve", "Places, salles, matériel ou créneaux."], ["Partage le lien", "Les réservations se font en autonomie."], ["Valide en un clic", "Ou laisse les règles décider."]],
    avantages: ["Plus aucune double réservation", "Moins de messages à gérer", "Un taux d'occupation visible"],
    faq: [["Peut-on limiter la durée d'une réservation ?", "Oui, réservation par réservation."], ["La validation est-elle obligatoire ?", "Non, elle peut être automatique."], ["Peut-on annuler en ligne ?", "Oui, selon les règles que tu fixes."]],
    cta: "Organise tes réservations",
  },
  "suivi-gains": {
    cible: "perso",
    heroTitre: ["Vois enfin où passe ton argent", "Tes gains et tes dépenses, enfin clairs"],
    heroSous: "{nom} t'aide à suivre ce que tu gagnes et ce que tu dépenses. Fini {douleur} : place à {benefice}.",
    features: [["Saisie express", "Une opération notée en 5 secondes."], ["Objectifs", "Fixe un montant et regarde ta jauge se remplir."], ["Graphiques clairs", "Ton évolution mois par mois."], ["Catégories", "Tu sais exactement où va chaque euro."]],
    etapes: [["Note tes opérations", "Gains et dépenses, au fil de l'eau."], ["Fixe un objectif", "Un montant, une date."], ["Suis ta courbe", "Et ajuste ce qui coince."]],
    avantages: ["Une vision claire de ton argent", "Des objectifs motivants", "Tes données privées et exportables"],
    faq: [["Faut-il connecter son compte bancaire ?", "Non, tu notes toi-même tes opérations."], ["Mes données sont-elles partagées ?", "Non, elles restent privées."], ["Est-ce un conseil financier ?", "Non : c'est un outil de suivi, pas un conseil en investissement."]],
    cta: "Commence ton suivi",
  },
  crm: {
    cible: "pros",
    heroTitre: ["Ne laisse plus filer un seul {client}", "Tes {clients} et tes relances, enfin sous contrôle"],
    heroSous: "{nom} est le carnet de ventes des {pros} : chaque contact, chaque devis, chaque relance au bon moment.",
    features: [["Pipeline visuel", "Glisse chaque contact d'une étape à l'autre."], ["Relances du jour", "La liste de qui rappeler, chaque matin."], ["Historique complet", "Tous les échanges sur la fiche."], ["Tableau de bord", "Ventes conclues et valeur en cours, en un coup d'œil."]],
    etapes: [["Ajoute tes contacts", "Un par un ou par import."], ["Suis tes ventes", "Étape par étape, du premier contact à la signature."], ["Relance au bon moment", "Rien ne passe entre les mailles."]],
    avantages: ["Plus de ventes conclues", "Moins d'oublis", "Une prise en main en 10 minutes"],
    faq: [["Puis-je importer mes contacts ?", "Oui, depuis un fichier tableur."], ["Est-ce adapté à une équipe ?", "Oui, chacun voit ses propres relances."], ["Les données sont-elles protégées ?", "Oui, chaque compte n'accède qu'à ses contacts."]],
    cta: "Organise tes ventes",
  },
  taches: {
    cible: "perso",
    heroTitre: ["Ta journée de {metier}, enfin sous contrôle", "Tout ce qu'il y a à faire, au même endroit"],
    heroSous: "{nom} aide les {pros} à savoir quoi faire maintenant, sans se perdre dans des outils compliqués.",
    features: [["Vue du jour", "Seulement ce qui compte aujourd'hui."], ["Tableau visuel", "À faire, en cours, terminé : glisse et c'est rangé."], ["Calendrier du mois", "Les échéances qui arrivent, d'un coup d'œil."], ["Rappels", "Une notification avant chaque échéance."]],
    etapes: [["Note tes tâches", "Une ligne suffit."], ["Classe-les", "Par priorité et par échéance."], ["Avance", "Et coche ce qui est fait."]],
    avantages: ["Moins de charge mentale", "Des échéances tenues", "Une prise en main immédiate"],
    faq: [["Peut-on l'utiliser seul ?", "Oui, le travail en équipe est facultatif."], ["Y a-t-il des rappels ?", "Oui, dans l'application."], ["Ça marche sur téléphone ?", "Oui, partout."]],
    cta: "Organise ta journée",
  },
  formation: {
    cible: "pros",
    heroTitre: ["Progresse à ton rythme avec {nom}", "La formation qui change tout pour les {pros}"],
    heroSous: "{nom} propose des leçons courtes et concrètes. Fini {douleur} : place à {benefice}.",
    features: [["Leçons courtes", "Moins de 15 minutes chacune."], ["Progression visible", "Une jauge qui avance à chaque leçon."], ["Exercices pratiques", "Pour appliquer tout de suite."], ["Certificat", "Un certificat de réussite à la fin du parcours."]],
    etapes: [["Inscris-toi", "Accès immédiat."], ["Suis les modules", "Dans l'ordre que tu veux."], ["Obtiens ton certificat", "Une fois toutes les leçons terminées."]],
    avantages: ["Accès à vie aux leçons", "Mises à jour incluses", "Questions possibles au formateur"],
    faq: [["Combien de temps dure la formation ?", "La durée est indiquée sur chaque module."], ["Faut-il un niveau particulier ?", "Non, on commence par les bases."], ["Puis-je être remboursé·e ?", "Les conditions sont précisées avant l'achat."]],
    cta: "Commence la formation",
  },
  ressources: {
    cible: "perso",
    heroTitre: ["Les meilleures ressources pour les {pros}", "Modèles, guides et outils prêts à l'emploi"],
    heroSous: "{nom} rassemble des ressources triées et à jour. Fini {douleur} : télécharge et utilise tout de suite.",
    features: [["Tout est classé", "Par catégorie et par format."], ["Recherche instantanée", "La bonne ressource en quelques secondes."], ["Favoris", "Garde ce qui te sert vraiment."], ["Nouveautés régulières", "De nouvelles ressources chaque mois."]],
    etapes: [["Parcours", "Par catégorie."], ["Télécharge", "En un clic."], ["Utilise", "Tout de suite."]],
    avantages: ["Du temps gagné chaque semaine", "Des ressources vérifiées", "Une bibliothèque qui s'enrichit"],
    faq: [["Les ressources sont-elles gratuites ?", "Une partie oui, le reste est réservé aux membres."], ["Peut-on proposer une ressource ?", "Oui, depuis l'espace membre."], ["Quels formats ?", "PDF, modèles, tableurs et liens."]],
    cta: "Explore la bibliothèque",
  },
  documents: {
    cible: "pros",
    heroTitre: ["Tes documents prêts en 1 minute", "Fini les devis faits le soir"],
    heroSous: "{nom} remplit pour les {pros} les documents répétitifs à partir de modèles fiables. Fini {douleur}.",
    features: [["Modèles prêts", "Devis, factures, attestations et contrats."], ["Remplissage guidé", "Un formulaire, jamais une page blanche."], ["Aperçu fidèle", "Le document se met à jour pendant que tu tapes."], ["Historique", "Tous tes documents retrouvés en un clic."]],
    etapes: [["Choisis un modèle", "Dans la bibliothèque."], ["Remplis les champs", "Seulement les informations utiles."], ["Télécharge", "Ton document est prêt à envoyer."]],
    avantages: ["Zéro faute de mise en page", "Des heures gagnées chaque mois", "Une image professionnelle"],
    faq: [["Les modèles ont-ils une valeur juridique ?", "Ce sont des modèles indicatifs : fais-les vérifier pour un usage officiel."], ["Puis-je ajouter mon logo ?", "Oui, sur tous les documents."], ["Peut-on créer ses propres modèles ?", "Oui, dans la formule avancée."]],
    cta: "Crée ton premier document",
  },
  projets: {
    cible: "pros",
    heroTitre: ["Chaque projet, sous contrôle", "Ton équipe sait enfin qui fait quoi"],
    heroSous: "{nom} donne aux {pros} une vue claire des projets, des jalons et des responsables. Fini {douleur}.",
    features: [["Jalons", "Les étapes clés de chaque projet, sur une frise."], ["Avancement automatique", "Un pourcentage calculé à chaque tâche terminée."], ["Tableau d'équipe", "Les tâches de chacun, glissées d'une colonne à l'autre."], ["Notifications", "Chacun est prévenu de ce qui le concerne."]],
    etapes: [["Crée un projet", "Avec ses jalons."], ["Invite ton équipe", "Et répartis les tâches."], ["Suis l'avancement", "En temps réel."]],
    avantages: ["Moins de réunions de point", "Des échéances tenues", "Une vision commune"],
    faq: [["Combien de membres peut-on inviter ?", "Cela dépend de l'offre choisie."], ["Les invités voient-ils tout ?", "Non, leurs droits sont limités."], ["Peut-on exporter les projets ?", "Oui, au format tableur."]],
    cta: "Lance ton premier projet",
  },
  "portail-client": {
    cible: "pros",
    heroTitre: ["Tes {clients} savent toujours où en est leur dossier", "Un espace privé et pro pour chaque {client}"],
    heroSous: "{nom} offre aux {pros} un portail où partager avancement, documents et messages. Fini {douleur}.",
    features: [["Suivi en direct", "Chaque dossier affiche son étape."], ["Documents partagés", "Plus aucune pièce jointe perdue."], ["Messagerie", "Les échanges restent attachés au dossier."], ["À tes couleurs", "Ton logo, ton nom, ton style."]],
    etapes: [["Crée un dossier", "Pour chaque {client}."], ["Partage l'accès", "Connexion en un clic, sans installation."], ["Mets à jour", "Une notification part automatiquement."]],
    avantages: ["Moins d'emails « alors, ça avance ? »", "Des {clients} rassurés", "Tout l'historique au même endroit"],
    faq: [["Faut-il installer quelque chose ?", "Non, tout se passe dans le navigateur."], ["Puis-je personnaliser les couleurs ?", "Oui, avec ton logo."], ["Les documents sont-ils protégés ?", "Oui, chaque dossier n'est visible que par les personnes invitées."]],
    cta: "Ouvre ton portail",
  },
  formulaires: {
    cible: "pros",
    heroTitre: ["Récolte l'avis de tes {clients} en 2 minutes", "Des réponses claires, sans prise de tête"],
    heroSous: "{nom} permet aux {pros} de créer un questionnaire, de le partager et d'analyser les réponses en direct.",
    features: [["Formulaire en 2 minutes", "Questions à choix, notes et champs libres."], ["Lien partageable", "Par message, QR code ou sur les réseaux."], ["Résultats en direct", "Graphiques mis à jour à chaque réponse."], ["Export", "Toutes les réponses dans un tableur."]],
    etapes: [["Crée ton questionnaire", "Ajoute tes questions."], ["Partage le lien", "Partout."], ["Analyse", "Les réponses arrivent en direct."]],
    avantages: ["Aucune compétence technique", "Des réponses exploitables", "Des décisions basées sur du concret"],
    faq: [["Faut-il un compte pour répondre ?", "Non."], ["Combien de réponses peut-on recevoir ?", "Selon l'offre choisie."], ["Les réponses sont-elles anonymes ?", "C'est toi qui choisis."]],
    cta: "Crée ton questionnaire",
  },
  tickets: {
    cible: "pros",
    heroTitre: ["Chaque demande reçoit une réponse", "Ton service client enfin organisé"],
    heroSous: "{nom} aide les {pros} à traiter les demandes dans l'ordre, sans en oublier une seule. Fini {douleur}.",
    features: [["File de demandes", "Ouvert, en cours, résolu."], ["Priorités", "L'urgent passe en premier."], ["Conversation", "Tout l'échange reste attaché à la demande."], ["Statistiques", "Temps de réponse et satisfaction mesurés."]],
    etapes: [["La demande arrive", "Via un formulaire simple."], ["Tu priorises", "En un coup d'œil."], ["Tu réponds", "Et tu clôtures."]],
    avantages: ["Plus aucune demande oubliée", "Des réponses plus rapides", "Des {clients} plus satisfaits"],
    faq: [["Peut-on suivre sa demande ?", "Oui, depuis son espace."], ["Peut-on travailler à plusieurs ?", "Oui, chaque agent voit ses demandes."], ["Les demandes sont-elles archivées ?", "Oui, avec tout l'historique."]],
    cta: "Organise ton support",
  },
};

/** Mot utilisé dans les noms proposés selon le type de SaaS. */
export const TYPE_WORD: Record<TemplateId, string[]> = {
  "rendez-vous": ["Résa", "Agenda", "Book"], abonnement: ["Club", "Membre", "Plus"], annuaire: ["Guide", "Trouve", "Map"],
  "liste-attente": ["Bientôt", "Early", "First"], boutique: ["Shop", "Store", "Market"], reservations: ["Résa", "Book", "Slot"],
  "suivi-gains": ["Budget", "Money", "Cash"], crm: ["Client", "Contact", "Vente"], taches: ["Todo", "Plan", "Focus"],
  formation: ["Académie", "Learn", "École"], ressources: ["Biblio", "Kit", "Ressource"], documents: ["Doc", "Devis", "Papier"],
  projets: ["Projet", "Team", "Board"], "portail-client": ["Portail", "Espace", "Suivi"], formulaires: ["Avis", "Sondage", "Form"], tickets: ["Support", "Help", "Ticket"],
};
