// Packs secteur : le vocabulaire qui permet de remplir un SaaS à partir d'une idée, sans IA.
// Les mots-clés sont normalisés (minuscules, sans accents) et comparés au début des mots de l'idée.

export type Secteur = {
  id: string;
  nom: string;
  mots: string[];
  metier: string; // le professionnel, au singulier
  pros: string; // les professionnels, au pluriel, sans article
  client: string;
  clients: string;
  lieu: string;
  action: string; // ce que font les clients grâce au SaaS
  douleur: string; // le problème concret
  benefice: string; // le gain concret
  offres: [string, number][]; // prestations ou produits, avec prix indicatif en €
  categories: string[];
};

function S(id: string, nom: string, mots: string, metier: string, pros: string, client: string, clients: string, lieu: string, action: string, douleur: string, benefice: string, offres: string, categories: string): Secteur {
  return {
    id, nom, mots: mots.split(" "), metier, pros, client, clients, lieu, action, douleur, benefice,
    offres: offres.split(" | ").map((o) => { const [n, p] = o.split(":"); return [n!, Number(p)]; }),
    categories: categories.split(" | "),
  };
}

export const SECTEURS: Secteur[] = [
  S("coiffure", "Coiffure", "coiff barb salon cheveu coupe brushing", "coiffeur", "coiffeurs et barbiers", "cliente", "clientes", "salon",
    "réserver leur coupe", "les appels pendant les coupes et les rendez-vous oubliés", "un agenda plein sans décrocher le téléphone",
    "Coupe femme:38 | Coupe homme:22 | Brushing:25 | Couleur:55 | Balayage:85 | Taille de barbe:15", "Coupe | Couleur | Soin | Barbe"),
  S("beaute", "Beauté", "beaut esthet ongl manucur maquill institut epil cil spa", "esthéticienne", "esthéticiennes et instituts de beauté", "cliente", "clientes", "institut",
    "réserver leur soin", "les créneaux vides et les annulations de dernière minute", "des journées remplies et des clientes fidèles",
    "Soin du visage:55 | Pose d'ongles:40 | Épilation jambes:30 | Rehaussement de cils:50 | Maquillage:45 | Massage relaxant:60", "Visage | Ongles | Épilation | Massage"),
  S("tatouage", "Tatouage", "tatou piercing tattoo ink", "tatoueur", "tatoueurs et studios de piercing", "client", "clients", "studio",
    "réserver leur séance et envoyer leur projet", "les projets envoyés en vrac sur les réseaux et les acomptes oubliés", "des projets clairs et des acomptes encaissés",
    "Petit tatouage:80 | Séance demi-journée:250 | Séance journée:450 | Piercing oreille:35 | Retouche:0 | Dessin sur mesure:60", "Fine line | Réalisme | Old school | Piercing"),
  S("sport", "Sport", "sport coach fitness muscu salle entrain crossfit running gym", "coach sportif", "coachs sportifs et salles de sport", "membre", "membres", "salle",
    "réserver leurs séances et suivre leurs progrès", "les séances à remplir par message et les membres qui décrochent", "des séances complètes et des membres motivés",
    "Séance individuelle:45 | Cours collectif:15 | Carnet 10 séances:350 | Programme personnalisé:79 | Bilan forme:30 | Abonnement mensuel:39", "Musculation | Cardio | Cours collectifs | Coaching"),
  S("bienetre", "Bien-être", "yoga medit pilat sophro massag relax zen bien-etre naturo", "praticien", "praticiens du bien-être et professeurs de yoga", "élève", "élèves", "studio",
    "réserver leur cours ou leur séance", "les cours qui ne se remplissent pas et les inscriptions par message", "des cours pleins et une communauté fidèle",
    "Cours de yoga:15 | Séance de sophrologie:55 | Massage bien-être:65 | Atelier méditation:20 | Carte 10 cours:130 | Stage du week-end:180", "Yoga | Méditation | Massage | Ateliers"),
  S("sante", "Santé", "sante kine osteo psy medec dentist infirm therapeut patient cabinet soin", "praticien", "praticiens de santé et cabinets", "patient", "patients", "cabinet",
    "prendre rendez-vous en ligne", "le secrétariat débordé et les rendez-vous non honorés", "moins d'appels et des consultations à l'heure",
    "Consultation:50 | Première consultation:60 | Séance de suivi:45 | Bilan complet:80 | Téléconsultation:40 | Séance à domicile:65", "Consultation | Suivi | Bilan | Urgence"),
  S("restauration", "Restauration", "restau resto cuisin plat repas menu snack bar food burger pizza traiteur", "restaurateur", "restaurants, snacks et food trucks", "client", "clients", "restaurant",
    "réserver une table ou commander à emporter", "le téléphone qui sonne en plein service et les tables vides", "un service fluide et des tables remplies",
    "Menu du midi:15 | Burger maison:13 | Pizza margherita:11 | Salade fraîcheur:12 | Dessert du jour:6 | Formule soir:26", "Entrées | Plats | Desserts | Boissons"),
  S("boulangerie", "Boulangerie", "boulang patiss vienno pain gateau chocolat", "boulanger", "boulangeries et pâtisseries", "client", "clients", "boutique",
    "commander à l'avance et retirer sans attendre", "la file d'attente du samedi et les invendus du soir", "zéro gaspillage et une file qui avance",
    "Baguette tradition:1.3 | Croissant:1.2 | Tarte aux fraises:24 | Pain au levain:4.5 | Boîte de macarons:15 | Gâteau d'anniversaire:35", "Pains | Viennoiseries | Pâtisseries | Commandes spéciales"),
  S("immobilier", "Immobilier", "immo appart maison logement locat louer agence achat vente bien proprio airbnb saison", "agent immobilier", "agents immobiliers et propriétaires bailleurs", "locataire", "locataires", "agence",
    "trouver un bien et suivre leur dossier", "les dossiers incomplets et les visites mal organisées", "des dossiers complets et des visites qui s'enchaînent",
    "Studio meublé:650 | T2 centre-ville:890 | Maison 4 pièces:1450 | Location saisonnière:120 | Frais d'agence:450 | Estimation:0", "Location | Vente | Saisonnier | Colocation"),
  S("auto", "Automobile", "auto voiture garage mecan carross vehicul moto pneu permis", "garagiste", "garages et mécaniciens", "client", "clients", "garage",
    "prendre rendez-vous et suivre la réparation", "les clients qui appellent pour savoir si la voiture est prête", "des clients informés sans décrocher",
    "Vidange:89 | Révision complète:180 | Pneus x4:320 | Freins avant:220 | Diagnostic:45 | Contrôle climatisation:69", "Entretien | Réparation | Pneus | Carrosserie"),
  S("batiment", "Artisans du bâtiment", "artisan plomb electr menuis peintr macon chantier renov travaux bricol carrel couvreur", "artisan", "artisans du bâtiment", "client", "clients", "chantier",
    "demander un devis et suivre leurs travaux", "les devis faits le soir et les chantiers qui débordent", "des devis envoyés en 5 minutes et des chantiers suivis",
    "Dépannage plomberie:90 | Pose de prise:60 | Peinture pièce:450 | Rénovation salle de bain:4500 | Diagnostic électrique:120 | Pose de parquet:35", "Plomberie | Électricité | Peinture | Rénovation"),
  S("menage", "Services à domicile", "menag nettoy domicil repass aide auxiliair conciergeri entretien", "intervenant à domicile", "entreprises de services à domicile", "client", "clients", "domicile",
    "réserver une intervention", "les plannings refaits chaque semaine et les remplacements de dernière minute", "des plannings clairs et des clients rassurés",
    "Ménage 2 h:50 | Repassage:25 | Grand nettoyage:120 | Vitres:45 | Aide aux courses:30 | Forfait mensuel:180", "Ménage | Repassage | Jardinage | Aide"),
  S("animaux", "Animaux", "anim chien chat toilett veto pension promen dresseur nac", "professionnel animalier", "toiletteurs, pensions et éducateurs canins", "propriétaire", "propriétaires", "salon",
    "réserver pour leur animal", "les carnets papier et les rappels de vaccins oubliés", "des animaux suivis et des propriétaires sereins",
    "Toilettage petit chien:40 | Toilettage grand chien:70 | Nuit en pension:25 | Promenade:15 | Séance d'éducation:45 | Coupe de griffes:10", "Toilettage | Pension | Éducation | Promenade"),
  S("soutien", "Soutien scolaire", "soutien scolair devoir eleve prof particul bac brevet math lycee college parent tutor", "professeur", "professeurs particuliers et centres de soutien", "élève", "élèves", "cours",
    "réserver un cours et suivre leur progression", "les créneaux calés par message et les paiements oubliés", "des cours planifiés et des parents informés",
    "Cours de maths 1 h:30 | Stage intensif:180 | Préparation au bac:40 | Aide aux devoirs:22 | Pack 10 cours:270 | Bilan de niveau:0", "Maths | Français | Sciences | Langues"),
  S("langues", "Langues", "langu anglais espagnol allemand italien chinois fle toeic tandem traduct", "professeur de langue", "professeurs de langues et écoles", "apprenant", "apprenants", "école",
    "réserver leurs cours de conversation", "les élèves qui abandonnent faute de pratique régulière", "des progrès visibles et des élèves assidus",
    "Cours individuel:35 | Conversation en groupe:15 | Préparation TOEIC:45 | Stage d'été:290 | Pack 20 h:600 | Test de niveau:0", "Anglais | Espagnol | Allemand | Conversation"),
  S("musique", "Musique", "musiq guitar piano chant batter dj concert studio enregistr groupe artiste beat", "professeur de musique", "professeurs de musique, studios et artistes", "élève", "élèves", "studio",
    "réserver un cours ou une session studio", "les répétitions annulées et les heures de studio mal remplies", "un planning plein et des élèves qui progressent",
    "Cours de guitare:30 | Cours de piano:35 | Session studio 2 h:60 | Mixage d'un titre:120 | Cours de chant:35 | Stage d'été:220", "Guitare | Piano | Chant | Studio"),
  S("photo", "Photo et vidéo", "photo video shooting montag film drone mariag portrait", "photographe", "photographes et vidéastes", "client", "clients", "studio",
    "réserver un shooting et récupérer leurs photos", "les galeries envoyées par lien perdu et les validations interminables", "des livraisons propres et des clients ravis",
    "Shooting portrait:150 | Reportage mariage:1200 | Photos produits:250 | Vidéo promo:600 | Retouche photo:8 | Séance famille:180", "Portrait | Mariage | Produit | Vidéo"),
  S("evenement", "Événementiel", "evenement fete mariag anniversair soiree seminair dj traiteur deco salle invit", "organisateur", "organisateurs d'événements et prestataires", "client", "clients", "lieu",
    "organiser leur événement et suivre les préparatifs", "les dizaines de messages par événement et les prestataires à relancer", "des événements organisés sans stress",
    "Mariage clé en main:6500 | Anniversaire:800 | Location de salle:900 | Animation DJ:450 | Décoration:350 | Séminaire d'entreprise:3000", "Mariage | Anniversaire | Entreprise | Soirée"),
  S("voyage", "Voyage", "voyag tourism vacanc sejour guide excursion hotel gite camping visite randonn", "guide", "guides, agences et hébergeurs", "voyageur", "voyageurs", "agence",
    "réserver leur séjour ou leur visite", "les réservations éparpillées et les groupes incomplets", "des groupes complets et des voyageurs bien informés",
    "Visite guidée:25 | Excursion journée:75 | Week-end découverte:290 | Nuit en gîte:85 | Randonnée accompagnée:40 | Séjour d'une semaine:890", "Visites | Excursions | Séjours | Hébergement"),
  S("mode", "Mode", "mode vetement fringue sneaker basket vinted friperie seconde main dressing styl couture", "créateur de mode", "boutiques de mode et revendeurs", "client", "clients", "boutique",
    "acheter les nouvelles pièces avant tout le monde", "les ruptures de stock et les ventes perdues en message privé", "plus de ventes et des clients qui reviennent",
    "T-shirt brodé:29 | Sweat oversize:55 | Sneakers édition limitée:140 | Jean vintage:45 | Casquette:25 | Veste en jean:79", "Hauts | Bas | Chaussures | Accessoires"),
  S("artisanat", "Artisanat et créations", "artisan bougie bijou ceramiq savon creation fait main etsy cosmet tricot poterie illustr", "créateur", "créateurs et artisans", "client", "clients", "atelier",
    "commander tes créations", "les commandes par message et les stocks suivis sur un carnet", "des commandes simples et un atelier organisé",
    "Bougie parfumée:22 | Bracelet perles:18 | Mug en céramique:28 | Savon artisanal:8 | Coffret cadeau:45 | Création personnalisée:60", "Bougies | Bijoux | Céramique | Coffrets"),
  S("gaming", "Gaming", "gaming gamer jeu jeux video esport stream twitch tournoi console fortnite minecraft discord", "organisateur", "streamers, équipes e-sport et organisateurs de tournois", "joueur", "joueurs", "serveur",
    "s'inscrire aux tournois et suivre les classements", "les inscriptions sur Discord et les brackets faits à la main", "des tournois pleins et une communauté soudée",
    "Inscription tournoi:5 | Pass saison:25 | Coaching 1 h:20 | Abonnement VIP:4.99 | Lot de skins:10 | Équipe de 5:20", "FPS | MOBA | Battle royale | Sport"),
  S("createurs", "Créateurs de contenu", "createur influenc tiktok instagram youtube contenu abonn ugc podcast newsletter communaut", "créateur", "créateurs de contenu", "abonné", "abonnés", "chaîne",
    "accéder à tes contenus exclusifs", "les revenus irréguliers malgré une communauté engagée", "un revenu régulier grâce à ta communauté",
    "Abonnement mensuel:4.99 | Accès VIP:9.99 | Pack de presets:15 | Coaching vidéo:50 | E-book:12 | Live privé:5", "Vidéos | Coulisses | Tutos | Lives"),
  S("etudiants", "Vie étudiante", "etudi revis examen partiel fac universit campus promo bts licence master memoire stage alternance", "étudiant", "étudiants", "étudiant", "étudiants", "campus",
    "organiser leurs révisions et leur vie étudiante", "les révisions de dernière minute et les infos perdues dans les groupes", "des examens préparés sans stress",
    "Accès premium:2.99 | Fiches de révision:5 | Pack examens:9.99 | Coaching méthode:15 | Planning sur mesure:4 | Annales corrigées:6", "Révisions | Examens | Stages | Vie de campus"),
  S("budget", "Argent et budget", "argent budget depens epargn economis gain revenu salair compte finance banque sou thune", "utilisateur", "jeunes et familles qui gèrent leur budget", "utilisateur", "utilisateurs", "budget",
    "suivre ce qu'ils gagnent et ce qu'ils dépensent", "les fins de mois difficiles sans savoir où part l'argent", "un budget clair et des objectifs atteints",
    "Courses:180 | Loyer:450 | Transport:60 | Sorties:80 | Abonnements:35 | Épargne:100", "Revenus | Dépenses fixes | Loisirs | Épargne"),
  S("freelance", "Freelances", "freelanc independ auto-entrepr micro-entrepr consultant mission graphist developpeur redacteur community manager", "freelance", "freelances et indépendants", "client", "clients", "activité",
    "suivre leurs missions, devis et paiements", "les devis faits le soir et les factures payées en retard", "plus de temps pour les missions et des paiements à l'heure",
    "Site vitrine:1500 | Logo:400 | Journée de conseil:450 | Article de blog:120 | Gestion réseaux sociaux:600 | Maintenance mensuelle:90", "Design | Développement | Rédaction | Conseil"),
  S("cabinet", "Cabinets et conseil", "avocat comptab notaire juridiq expert conseil cabinet fiscal assuranc courtier", "conseiller", "cabinets d'avocats, d'expertise comptable et de conseil", "client", "clients", "cabinet",
    "déposer leurs documents et suivre leur dossier", "les pièces demandées dix fois par email", "des dossiers complets et des clients rassurés",
    "Consultation:120 | Bilan annuel:900 | Création d'entreprise:600 | Déclaration fiscale:250 | Contrat sur mesure:450 | Suivi mensuel:150", "Juridique | Comptabilité | Fiscalité | Conseil"),
  S("informatique", "Informatique", "informat logiciel dev appli site web saas tech it reseau depann ordinat cyber", "prestataire informatique", "prestataires informatiques et éditeurs de logiciels", "client", "clients", "service",
    "déclarer un problème et suivre sa résolution", "les demandes perdues dans les emails et les clients qui relancent", "des demandes traitées dans l'ordre et des clients satisfaits",
    "Dépannage à distance:49 | Intervention sur site:90 | Maintenance mensuelle:79 | Création de site:1200 | Licence logicielle:15 | Audit sécurité:450", "Matériel | Logiciel | Réseau | Sécurité"),
  S("association", "Associations", "associat benevol club sportif amateur adherent cotis caritat solidar humanitaire", "bénévole", "associations et clubs", "adhérent", "adhérents", "association",
    "s'inscrire aux activités et suivre la vie du club", "les inscriptions sur papier et les cotisations à relancer", "des bénévoles libérés de l'administratif",
    "Cotisation annuelle:30 | Licence sportive:45 | Sortie du mois:15 | Stage vacances:90 | Don libre:10 | Tenue du club:25", "Activités | Événements | Bénévolat | Cotisations"),
  S("livraison", "Livraison et transport", "livr coursier transport demenag vtc taxi colis logist chauffeur", "transporteur", "coursiers, transporteurs et déménageurs", "client", "clients", "dépôt",
    "réserver une course et suivre leur livraison", "les clients qui appellent pour savoir où est leur colis", "des livraisons suivies et des tournées optimisées",
    "Course express:15 | Livraison standard:8 | Déménagement studio:350 | Transport de meuble:60 | Abonnement pro:99 | Course longue distance:120", "Express | Standard | Déménagement | Pro"),
  S("enfance", "Enfance", "enfant creche baby sitting garde nounou bebe periscol anniversaire enfant atelier enfant", "professionnel de l'enfance", "nounous, crèches et animateurs", "parent", "parents", "structure",
    "réserver une garde ou une activité", "les plannings de garde qui changent chaque semaine", "des parents rassurés et des plannings clairs",
    "Garde 1 h:12 | Journée de crèche:45 | Atelier créatif:15 | Anniversaire animé:180 | Sortie d'école:10 | Stage vacances:120", "Garde | Ateliers | Anniversaires | Sorties"),
  S("jardin", "Jardin et paysage", "jardin paysag pelouse tonte taille haie potager plante fleur elag", "paysagiste", "paysagistes et jardiniers", "client", "clients", "jardin",
    "demander un devis et planifier l'entretien", "les tournées d'entretien notées sur un carnet", "des contrats d'entretien suivis toute l'année",
    "Tonte de pelouse:45 | Taille de haie:120 | Entretien mensuel:90 | Création de massif:450 | Élagage:300 | Potager clé en main:600", "Entretien | Création | Élagage | Potager"),
];

/** Pack utilisé quand aucun secteur n'est reconnu : textes corrects mais plus génériques. */
export const SECTEUR_GENERAL: Secteur = S("general", "Général", "", "professionnel", "professionnels et indépendants", "client", "clients", "activité",
  "utiliser ton service en quelques clics", "les tâches répétitives et les informations éparpillées", "du temps gagné chaque semaine",
  "Offre découverte:9 | Offre standard:19 | Offre complète:39 | Accompagnement:60 | Option premium:15 | Pack annuel:190", "Général | Clients | Projets | Autre");

export const SECTEUR_BY_ID = Object.fromEntries([...SECTEURS, SECTEUR_GENERAL].map((s) => [s.id, s])) as Record<string, Secteur>;

export const PRENOMS = ["Léa Martin", "Hugo Bernard", "Inès Kaci", "Noah Petit", "Sarah Leroy", "Adam Roux", "Chloé Garnier", "Yanis Moreau", "Emma Dubois", "Lucas Fontaine", "Jade Mercier", "Nathan Girard"];
export const VILLES = ["Lyon", "Nantes", "Lille", "Bordeaux", "Rennes", "Toulouse", "Marseille", "Strasbourg"];
