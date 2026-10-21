import type { TemplateId } from "@/lib/types";

// Données d'exemple affichées dans les prototypes. Fictives et marquées comme telles dans l'interface.
export type Demo = {
  rows: string[][]; // une ligne par élément, dans l'ordre des champs du modèle
  status: number; // index de la colonne qui porte le statut
  statuses: string[]; // statuts dans l'ordre du flux (colonnes du kanban)
  kpis: [string, number, string, number][]; // libellé, valeur, unité, évolution en %
  serie: string; // nom de la courbe du tableau de bord
};

export const DEMO: Record<TemplateId, Demo> = {
  "rendez-vous": {
    rows: [["Léa Martin", "Lun. 10:00", "Séance découverte", "Confirmé"], ["Hugo Bernard", "Lun. 14:30", "Suivi", "En attente"], ["Inès Kaci", "Mar. 09:00", "Séance complète", "Confirmé"], ["Noah Petit", "Mer. 11:00", "Suivi", "Confirmé"], ["Sarah Leroy", "Jeu. 16:00", "Séance découverte", "En attente"], ["Adam Roux", "Ven. 10:30", "Séance complète", "Annulé"]],
    status: 3, statuses: ["En attente", "Confirmé", "Annulé"],
    kpis: [["Rendez-vous cette semaine", 18, "", 12], ["Taux de présence", 94, "%", 3], ["Créneaux libres", 7, "", -8]], serie: "Rendez-vous",
  },
  abonnement: {
    rows: [["Guide de démarrage", "Article", "Gratuit", "3 mars"], ["Atelier vidéo n°1", "Vidéo", "Abonnés", "10 mars"], ["Modèle à télécharger", "Fichier", "Abonnés", "17 mars"], ["Live questions-réponses", "Vidéo", "Abonnés", "24 mars"], ["Check-list du mois", "Fichier", "Gratuit", "31 mars"], ["Étude de cas", "Article", "Abonnés", "7 avril"]],
    status: 2, statuses: ["Gratuit", "Abonnés"],
    kpis: [["Abonnés actifs", 248, "", 9], ["Revenu mensuel", 2232, "€", 11], ["Taux de résiliation", 3, "%", -1]], serie: "Abonnés",
  },
  annuaire: {
    rows: [["Atelier Bois & Co", "Artisan", "Lyon", "4,8"], ["Studio Lumière", "Photographe", "Nantes", "4,6"], ["Le Petit Fournil", "Boulangerie", "Lille", "4,9"], ["Garage Central", "Garage", "Rennes", "4,4"], ["Fleurs de Lune", "Fleuriste", "Bordeaux", "4,7"], ["Vélo Express", "Réparateur", "Toulouse", "4,5"]],
    status: 1, statuses: ["Artisan", "Photographe", "Boulangerie", "Garage", "Fleuriste", "Réparateur"],
    kpis: [["Fiches publiées", 312, "", 6], ["Visites ce mois", 4820, "", 18], ["Fiches à valider", 9, "", 0]], serie: "Visites",
  },
  "liste-attente": {
    rows: [["lea@exemple.fr", "12 mai", "TikTok", "3"], ["tom@exemple.fr", "12 mai", "Instagram", "0"], ["sara@exemple.fr", "13 mai", "Bouche-à-oreille", "1"], ["yanis@exemple.fr", "13 mai", "TikTok", "5"], ["ines@exemple.fr", "14 mai", "Newsletter", "0"], ["paul@exemple.fr", "14 mai", "Instagram", "2"]],
    status: 2, statuses: ["TikTok", "Instagram", "Newsletter", "Bouche-à-oreille"],
    kpis: [["Inscrits", 1284, "", 24], ["Parrainages", 312, "", 15], ["Taux d'inscription", 18, "%", 2]], serie: "Inscrits",
  },
  boutique: {
    rows: [["Bougie ambrée", "18 €", "24", "En ligne"], ["Coffret découverte", "35 €", "8", "En ligne"], ["Carte cadeau", "25 €", "∞", "Brouillon"], ["Diffuseur céramique", "42 €", "3", "En ligne"], ["Savon à l'avoine", "9 €", "56", "En ligne"], ["Bougie XL", "39 €", "0", "Rupture"]],
    status: 3, statuses: ["Brouillon", "En ligne", "Rupture"],
    kpis: [["Ventes du mois", 186, "", 14], ["Chiffre d'affaires", 4970, "€", 9], ["Panier moyen", 27, "€", 4]], serie: "Ventes",
  },
  reservations: {
    rows: [["Salle de réunion A", "Jeu. 14:00", "Équipe Ventes", "Validée"], ["Vidéoprojecteur", "Ven. 09:00", "Camille", "En attente"], ["Studio photo", "Sam. 10:00", "Noah", "Validée"], ["Salle B", "Lun. 11:00", "Direction", "Validée"], ["Utilitaire", "Mar. 08:00", "Karim", "En attente"], ["Salle de réunion A", "Mer. 15:00", "Marketing", "Refusée"]],
    status: 3, statuses: ["En attente", "Validée", "Refusée"],
    kpis: [["Réservations", 64, "", 7], ["Taux d'occupation", 72, "%", 5], ["En attente", 5, "", -2]], serie: "Réservations",
  },
  "suivi-gains": {
    rows: [["2 mai", "Vente Vinted", "Revente", "+24 €"], ["4 mai", "Cours de maths", "Cours", "+30 €"], ["5 mai", "Frais d'envoi", "Dépense", "−6 €"], ["8 mai", "Baby-sitting", "Service", "+45 €"], ["10 mai", "Vente Leboncoin", "Revente", "+60 €"], ["12 mai", "Abonnement outil", "Dépense", "−9 €"]],
    status: 2, statuses: ["Revente", "Cours", "Service", "Dépense"],
    kpis: [["Gagné ce mois", 315, "€", 22], ["Dépensé", 41, "€", -5], ["Objectif atteint", 63, "%", 13]], serie: "Gains",
  },
  crm: {
    rows: [["Julie Martin", "Boulangerie Martin", "Devis envoyé", "Mardi"], ["Karim Diallo", "KD Rénovation", "Premier contact", "Jeudi"], ["Emma Petit", "Studio Petit", "Gagné", "—"], ["Louis Moreau", "Moreau & Fils", "Négociation", "Demain"], ["Chloé Garnier", "Atelier Garnier", "Premier contact", "Vendredi"], ["Mehdi Benali", "MB Conseil", "Devis envoyé", "Lundi"]],
    status: 2, statuses: ["Premier contact", "Devis envoyé", "Négociation", "Gagné"],
    kpis: [["Prospects actifs", 42, "", 8], ["Ventes conclues", 11, "", 22], ["Valeur du pipeline", 18400, "€", 6]], serie: "Ventes",
  },
  taches: {
    rows: [["Réviser le chapitre 3", "Demain", "Haute", "À faire"], ["Envoyer le devis", "Vendredi", "Moyenne", "En cours"], ["Ranger les fichiers", "Lundi", "Basse", "Terminé"], ["Préparer l'exposé", "Jeudi", "Haute", "En cours"], ["Appeler le banquier", "Mardi", "Moyenne", "À faire"], ["Payer le loyer", "Le 5", "Haute", "Terminé"]],
    status: 3, statuses: ["À faire", "En cours", "Terminé"],
    kpis: [["Tâches ouvertes", 14, "", -12], ["Terminées cette semaine", 23, "", 18], ["En retard", 2, "", -50]], serie: "Tâches terminées",
  },
  formation: {
    rows: [["Introduction", "Module 1", "6 min", "Terminée"], ["Les bases", "Module 1", "12 min", "Terminée"], ["Exercice pratique", "Module 2", "15 min", "En cours"], ["Aller plus loin", "Module 2", "10 min", "À faire"], ["Cas réel", "Module 3", "18 min", "À faire"], ["Bilan final", "Module 3", "8 min", "À faire"]],
    status: 3, statuses: ["À faire", "En cours", "Terminée"],
    kpis: [["Élèves inscrits", 156, "", 12], ["Taux de complétion", 68, "%", 4], ["Note moyenne", 4.7, "/5", 2]], serie: "Leçons suivies",
  },
  ressources: {
    rows: [["Modèle de CV", "Document", "Emploi", "2 avril"], ["Checklist déménagement", "PDF", "Vie pratique", "5 avril"], ["Planning de révision", "Tableur", "Études", "9 avril"], ["Lettre de motivation", "Document", "Emploi", "12 avril"], ["Budget mensuel", "Tableur", "Argent", "15 avril"], ["Guide entretien", "PDF", "Emploi", "18 avril"]],
    status: 2, statuses: ["Emploi", "Vie pratique", "Études", "Argent"],
    kpis: [["Ressources", 128, "", 5], ["Téléchargements", 3410, "", 21], ["Membres", 892, "", 9]], serie: "Téléchargements",
  },
  documents: {
    rows: [["Devis n°12", "Devis", "3 juin", "Envoyé"], ["Attestation stage", "Attestation", "4 juin", "Brouillon"], ["Facture n°7", "Facture", "6 juin", "Payée"], ["Contrat Dupont", "Contrat", "8 juin", "Envoyé"], ["Devis n°13", "Devis", "9 juin", "Brouillon"], ["Facture n°8", "Facture", "10 juin", "Envoyé"]],
    status: 3, statuses: ["Brouillon", "Envoyé", "Payée"],
    kpis: [["Documents créés", 87, "", 16], ["Temps gagné", 21, "h", 30], ["Modèles", 12, "", 0]], serie: "Documents",
  },
  projets: {
    rows: [["Refonte du site", "Lina", "30 juin", "65 %"], ["Salon de l'étudiant", "Marc", "15 juil.", "30 %"], ["Lancement newsletter", "Zoé", "1er juil.", "90 %"], ["Application mobile", "Sami", "30 sept.", "10 %"], ["Campagne d'été", "Lina", "20 juin", "100 %"], ["Nouveau logo", "Marc", "10 juil.", "45 %"]],
    status: 3, statuses: ["10 %", "30 %", "45 %", "65 %", "90 %", "100 %"],
    kpis: [["Projets en cours", 9, "", 0], ["Jalons tenus", 87, "%", 6], ["Tâches ouvertes", 46, "", -9]], serie: "Tâches terminées",
  },
  "portail-client": {
    rows: [["Site vitrine", "Café Lumière", "Maquettes", "Hier"], ["Logo", "Studio Nova", "Validation", "Lundi"], ["Shooting", "Maison Berthe", "Livré", "12 mai"], ["Boutique en ligne", "Atelier Rose", "Développement", "Aujourd'hui"], ["Brochure", "Cabinet Lemoine", "Maquettes", "Mardi"], ["Vidéo promo", "FitClub", "Livré", "3 mai"]],
    status: 2, statuses: ["Maquettes", "Développement", "Validation", "Livré"],
    kpis: [["Dossiers ouverts", 12, "", 4], ["Validations en attente", 3, "", -25], ["Clients satisfaits", 96, "%", 2]], serie: "Livraisons",
  },
  formulaires: {
    rows: [["8 juin", "Adam", "Option A", "Très clair"], ["8 juin", "Chloé", "Option B", "—"], ["9 juin", "Yanis", "Option A", "À revoir"], ["9 juin", "Nina", "Option C", "Parfait"], ["10 juin", "Omar", "Option A", "Rapide"], ["10 juin", "Lucie", "Option B", "Bien"]],
    status: 2, statuses: ["Option A", "Option B", "Option C"],
    kpis: [["Réponses", 534, "", 27], ["Taux de complétion", 81, "%", 3], ["Temps moyen", 2, "min", -10]], serie: "Réponses",
  },
  tickets: {
    rows: [["Impossible de me connecter", "Paul", "Haute", "Ouvert"], ["Question sur la facture", "Nina", "Moyenne", "En cours"], ["Suggestion d'amélioration", "Omar", "Basse", "Résolu"], ["Erreur de paiement", "Clara", "Haute", "En cours"], ["Changer d'adresse email", "Théo", "Basse", "Ouvert"], ["Export qui ne marche pas", "Inès", "Moyenne", "Résolu"]],
    status: 3, statuses: ["Ouvert", "En cours", "Résolu"],
    kpis: [["Tickets ouverts", 17, "", -15], ["Temps de réponse", 3, "h", -20], ["Satisfaction", 92, "%", 4]], serie: "Tickets résolus",
  },
};
