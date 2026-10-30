# Checklist de lancement de Décollage (SaaS sans client)

Établie le 30 octobre 2026 par lecture du dépôt et de la configuration LOCALE uniquement. Aucun service distant (Stripe, Supabase, Vercel) n'a été interrogé : tout ce qui dépend d'eux est marqué **non vérifié**. Aucune valeur secrète n'est recopiée ici.

## Ne pas lancer tant que…

1. **Les infos légales sont vides** : `src/data/legal.ts` n'a ni éditeur, ni statut, ni SIRET, ni adresse, ni directeur de publication, ni médiateur (seul l'e-mail est rempli). Les mentions légales et les CGV afficheraient un vendeur incomplet et aucun médiateur (obligatoire pour vendre à des consommateurs). C'est au patron de fournir ces informations.
2. **Les migrations 0007 et 0008 ne sont pas appliquées dans le bon ordre** (code déployé d'abord, voir partie A1) et vérifiées. Sans 0007, les durcissements (liste d'attente, stock public, limites partagées) ne sont pas actifs ; **non vérifié** : état réel de la base.
3. **Le parcours Stripe n'a pas été essayé de bout en bout en mode TEST** (achat Solo, publication, résiliation, webhook reçu, portail ouvert). Le `.env.local` contient déjà une clé de type **live restreinte (`rk_live_…`)** : ne pas tester les achats avec elle (vrai argent). Les droits de cette clé restreinte (clients, sessions Checkout, abonnements, portail) sont **non vérifiés**.
4. **Le portail client Stripe n'est pas activé et configuré** (résiliation, changement de formule, les 3 produits autorisés). Les CGV (art. 7) promettent une résiliation en ligne.
5. **Les variables Vercel de production ne sont pas contrôlées** (aucune lecture distante faite) : `NEXT_PUBLIC_APP_URL`, 3 prix `price_…` live correspondant à 2,99 / 12,99 / 29,99 €, `STRIPE_WEBHOOK_SECRET` du webhook live.
6. **Texte faux sur la page marque blanche** (B1) et **CGV muettes sur l'option marque blanche / Entreprise** (B2) : à corriger ou à retirer des pages avant d'accueillir un client payant.

## A) ACTIONS DU PATRON

### A1. Savoir ce qui existe déjà (rien ne peut le prouver localement)

Ce qui est établi localement : aucun script de seed, aucun identifiant `cus_`/`sub_` en dur dans le code ; `src/data/demo.ts` ne contient que des exemples de modèles (pas de données client) ; `.env.local` pointe vers `https://decollage.vercel.app`, une clé Stripe **live restreinte** (`rk_live_`), un secret de webhook `whsec_` et trois `price_` (donc un **Stripe live a probablement déjà été configuré, avec des produits et peut-être un webhook** ; **non vérifié**) ; `.vercel/project.json` relie le dossier au projet Vercel « decollage ».
Ce qui ne peut PAS être établi : s'il existe des clients, abonnements, paiements, produits ou webhooks dans Stripe, ni le contenu de Supabase ou des variables Vercel. L'absence d'utilisateur ne prouve pas l'absence d'abonnement Stripe (un client peut avoir payé sans que le webhook ait écrit en base).

**Dashboard Stripe, en mode TEST puis en mode LIVE (bascule en haut à droite) :**
- Clients : liste vide attendue (sinon, noter qui et pourquoi).
- Abonnements (filtre « Tous les statuts ») : zéro attendu.
- Paiements : zéro attendu.
- Catalogue de produits : lister les produits et prix existants ; vérifier qu'il y a 3 prix mensuels récurrents 2,99 / 12,99 / 29,99 € en live et que les identifiants `price_…` correspondent à ceux des variables Vercel.
- Développeurs > Webhooks : endpoint `https://decollage.vercel.app/api/stripe/webhook` présent ? événements exacts (voir A3) ? Journal des envois sans échec.
- Paramètres > Portail client : activé ?

**Supabase > SQL Editor (lecture seule ; chaque requête renvoie 1 ligne). Résultat attendu pour un projet sans client : 1 pour `profiles`, 0 ailleurs (sauf mention).**

```sql
select count(*) from public.profiles;                 -- attendu : 1 (ton compte)
select count(*) from auth.users;                      -- attendu : 1
select count(*) from public.profiles where stripe_customer_id is not null or stripe_subscription_id is not null;  -- attendu : 0 ou 1 (ton compte Illimité : s'il en a un, vérifier dans Stripe qu'il correspond à un vrai abonnement)
select id, plan, subscription_status from public.profiles;  -- attendu : 1 ligne, plan illimite
select count(*) from public.projects;                 -- attendu : tes projets de test
select count(*) from public.sites;                    -- attendu : 0 (ou tes tests)
select count(*) from public.boutiques;                -- attendu : 0 (table présente seulement si 0005 exécutée)
select count(*) from public.commandes;                -- attendu : 0
select count(*) from public.waitlist;                 -- attendu : 0
select count(*) from public.legal_acceptances;        -- attendu : 0 (ou tes tests)
select count(*) from public.brand_entitlements;       -- attendu : 0
```
Si un résultat diffère, ne pas lancer avant de comprendre (surtout un client Stripe ou un abonnement non attendu).

### A2. Supabase : migrations dans l'ordre (à la main, SQL Editor)

Ordre strict : **0001 → 0002 → 0003 → 0004 → 0005 → 0006 → 0007 → 0008**. Selon le patron, 0004-0005-0006 sont déjà exécutées en production (**non vérifié** : voir la requête ci-dessous). 0001 à 0003 : non vérifié.

Séquence sûre :
1. **Déployer d'abord le code** (il a des replis si 0007/0008 manquent : catalogue, création de produit, liste d'attente, limites). Exécuter 0007 AVANT le code casserait l'ancien code (accès direct à la liste d'attente et au stock retirés).
2. Exécuter `supabase/A-COLLER-0007.sql` (copie identique à `0007_durcissement.sql`, vérifié par diff), puis vérifier :
   ```sql
   select to_regclass('public.limites_debit') is not null as limites, to_regprocedure('public.waitlist_inscrire(text,text)') is not null as liste, to_regclass('public.variantes_publiques') is not null as vue;  -- attendu : true, true, true
   ```
3. Exécuter `supabase/A-COLLER-0008.sql` (identique à `0008_suspendus_et_expiration.sql`, vérifié par diff), puis vérifier :
   ```sql
   select (select count(*) from information_schema.columns where table_schema='public' and table_name='commandes' and column_name in ('annulee_le','annulation_motif')) as colonnes, to_regprocedure('public.boutique_expirer_commandes_nouvelles()') is not null as fonction;  -- attendu : 2, true
   ```
Contrôle préalable des prérequis (avant 0007) :
```sql
select to_regclass('public.commandes') is not null as boutique, to_regprocedure('public.plan_can_publish(text)') is not null as regle_gratuit;  -- attendu : true, true (sinon 0005/0006 manquent)
```
Rejouabilité : 0007 et 0008 sont idempotentes, ne suppriment aucune donnée (contraintes « not valid »).
Pièges :
- Ne **jamais** rejouer 0004, 0005 ou 0006 (ni `A-COLLER-0004-0005-0006.sql`) après 0007/0008 : elles recréeraient d'anciennes politiques et fonctions. Si c'est arrivé : rejouer 0007 **puis** 0008.
- Si 0007 est rejouée, rejouer ensuite 0008 (0008 remplace des fonctions de 0007).
- Si 0008 manque, le code fonctionne : les déclencheurs de 0006 s'appliquent (les sites suspendus comptent encore dans la limite : une réactivation ou une publication peut être refusée à tort), la route d'expiration marche avec la version de 0007 (sans marqueur d'annulation, sans le filtre « non payée »).
- **`A-COLLER-0004-0005-0006.sql` (non suivi par git)** : recommandation, le laisser **hors de git** (ou l'ajouter à `.gitignore`), **ne pas le commiter** ; 0004, 0005 et 0006 sont déjà dans git et c'est un doublon (45 ko) qui, copié par erreur après 0007/0008, ferait régresser la base. Le garder localement, ou le supprimer (décision du patron, aucune suppression faite ici).

### A3. Stripe (TEST d'abord, LIVE ensuite)

1. En **mode test** : créer 3 produits avec prix mensuel récurrent (Solo 2,99 €, **Pro 12,99 €**, Illimité 29,99 €) ; copier les `price_…`. **Grille d'octobre 2026** : le Pro passe de 9,99 € à 12,99 € ; en **live**, créer un NOUVEAU prix Pro à 12,99 €/mois (un prix Stripe ne se modifie pas) et un prix d'option marque blanche à 4,99 €/mois (7,98 € au total avec Solo). **Ne modifier ni archiver les anciens prix avant d'avoir vérifié (Stripe > Abonnements, filtre par prix) qu'aucun abonné ne les utilise.** Ordre de déploiement et détail : `docs/ADAPTATION-FACTURATION.md`. Tant que le prix Pro à 12,99 € n'existe pas et n'est pas dans `STRIPE_PRICE_PRO`, ne pas mettre en ligne l'affichage à 12,99 € (prix affiché différent du prix facturé).
2. Créer le webhook vers `https://decollage.vercel.app/api/stripe/webhook` avec exactement ces 6 événements gérés par le code : `checkout.session.completed`, `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`, `customer.subscription.paused`, `customer.subscription.resumed`. Copier la clé de signature `whsec_…` (une par endpoint et par mode).
3. Activer le **portail client** (Paramètres > Facturation > Portail client) : annulation d'abonnement, mise à jour du moyen de paiement, factures, changement de formule avec les 3 produits autorisés. Le code ouvre le portail (`/api/stripe/portal`) ; ce que le portail permet dépend de ce réglage (**non vérifié**).
4. Tester avec les cartes de test (`4242 4242 4242 4242` paiement réussi ; une carte de refus pour vérifier le message) en pointant un environnement (local ou aperçu Vercel) vers les clés TEST, jamais la production live avec des clés test mélangées.
5. Passer en **live** : activer le compte Stripe (identité, banque), recréer produits/prix et webhook en live, mettre les clés live et le nouveau `whsec_` dans Vercel (production).
6. **Code -20 %** : créer le coupon puis le **code promotionnel** dans Stripe (le code autorise `allow_promotion_codes`, seul un « code promotionnel » actif est accepté ; un coupon seul ne suffit pas). Aucune réduction n'est codée dans le dépôt. Choisir durée (une fois, plusieurs mois, toujours) et la tester en mode test.
7. Surveiller le journal des webhooks Stripe après chaque test (réponse 200 attendue).

### A4. Vercel : variables et projet

Variables lues par le code (aucune valeur à donner ici) :

| Variable | Statut | Sert à | Si elle manque | Qui |
|---|---|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | obligatoire | comptes, projets, sites (client et serveur, `proxy.ts`) | mode local : pas de comptes, pas de paiement | patron (Supabase > Settings > API) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | obligatoire | idem | idem | patron |
| `SUPABASE_SERVICE_ROLE_KEY` | obligatoire pour payer | webhook, suppression de compte, routes serveur ; secrète | paiement désactivé (`isPaymentConfigured`) ; routes serveur en 503 | patron, jamais `NEXT_PUBLIC_` |
| `STRIPE_SECRET_KEY` | obligatoire pour payer | checkout, portail, webhook ; en production : clé **live** (`sk_live_` ou restreinte `rk_live_` avec droits clients, checkout, abonnements, portail) | paiement désactivé (503 « pas encore activé ») | patron |
| `STRIPE_WEBHOOK_SECRET` | obligatoire pour payer | vérification de signature du webhook | webhook en 503, aucune formule jamais mise à jour : **dangereux si on laisse les clients payer** | patron (clé `whsec_` du webhook live) |
| `STRIPE_PRICE_SOLO` / `_PRO` / `_ILLIMITE` | obligatoires pour payer | choix du prix côté serveur ; reconnaissance de la formule dans le webhook | paiement désactivé ; un prix inconnu n'accorde jamais de formule payante | patron (prix récurrents 2,99 / 12,99 / 29,99 €) |
| `STRIPE_PRICE_PRO_LEGACY` | facultative | anciens prix Pro (9,99 €) encore portés par des abonnés : reconnus par le webhook comme Pro, jamais proposés à l'achat | un abonné resté sur l'ancien prix serait traité comme « prix inconnu » (Gratuit) au prochain événement | patron, seulement si des abonnés Pro à 9,99 € existent |
| `STRIPE_PRICE_BRAND` | facultative | option marque blanche Solo (4,99 €/mois, 7,98 € au total) reconnue par le webhook | l'option n'est pas vendue (rien ne change) ; laisser vide au lancement | patron, seulement s'il vend l'option |
| `NEXT_PUBLIC_APP_URL` | recommandée (obligatoire en pratique) | URLs de retour Stripe, contrôle d'origine | repli `http://localhost:3000` : retours Stripe cassés | patron (`https://decollage.vercel.app`, sans `/` final) |
| `CRON_SECRET` | facultative | route `/api/boutique/expiration` | route en 404, rien d'exécutable | patron, plus tard (A6) |
| `ALLOWED_ORIGINS` | facultative | origines supplémentaires (domaine personnalisé) | seules l'URL du site et celle de la requête sont acceptées | patron si un domaine perso est ajouté |
| `ALLOWED_VERCEL_PREVIEW` | facultative | motif des aperçus Vercel | désactivé | inutile au lancement |
| `WHITE_LABEL_USER_IDS` | facultative | liste blanche UUID pour tester la marque blanche | droit lu seulement dans `brand_entitlements` et la formule | patron, uniquement pour ses tests |
| `NEXT_PUBLIC_LISTE_ID` | sans objet pour Décollage | appartient au code généré pour les SaaS des utilisateurs (`kit-cloud.ts`) | sans effet | ne pas créer |

Contrôles du patron (non vérifiables localement) : que les variables existent en **Production** (et pas seulement en Preview), que les clés Stripe de production sont bien live et cohérentes avec les `price_` et le `whsec_` live, que l'URL du site et les « Redirect URLs » de Supabase (`https://decollage.vercel.app/auth/callback`) sont à jour, que le plan Vercel convient à un usage commercial (le plan gratuit est réservé aux projets non commerciaux, d'après `docs/MISE-EN-LIGNE.md` ; **à vérifier** sur la page officielle de Vercel), le domaine (si domaine perso : l'ajouter dans Vercel, Supabase, `legal.ts` et `ALLOWED_ORIGINS`), un SMTP (Resend ou autre) pour les liens magiques (l'envoi intégré de Supabase est très limité).

### A5. Légal

Renseigner dans `src/data/legal.ts` (il fournit, rien n'est inventé) : éditeur, statut, SIRET, adresse, téléphone si exigé, directeur de publication, mention de TVA (ou non applicable), médiateur de la consommation (nom + site). Un champ vide n'est pas affiché. Relire ensuite les pages `/mentions-legales`, `/cgv`, `/remboursement`. Une relecture juridique par un professionnel est conseillée (non fait).

### A6. Expiration des commandes (facultatif au lancement)

Avec zéro boutique, l'expiration n'est pas urgente : **elle peut attendre la première boutique publiée**. Ce que fait le code (relu et couvert par `suspendus-0008.test.ts` et `expiration-route.test.ts`) : annule les commandes au statut `nouvelle` ET non payées de plus de 72 h, remet le stock une seule fois (verrou de ligne + déclencheur), pose le marqueur `expiree_automatiquement`, exécutable par `service_role` seul ; la route répond 404 sans `CRON_SECRET`, 401 si le secret est faux, 503 si la migration manque.

Activation plus tard, rien n'est activé aujourd'hui :
1. Migration 0008 exécutée (A2).
2. Générer un secret long sans l'afficher dans un historique partagé, par exemple dans un terminal : `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` puis le coller directement dans Vercel > Settings > Environment Variables > `CRON_SECRET` (Production).
3. Créer à la racine `vercel.json` :
   ```json
   { "crons": [{ "path": "/api/boutique/expiration", "schedule": "0 4 * * *" }] }
   ```
   puis redéployer.
4. Tester : `curl -X POST -H "Authorization: Bearer <SECRET>" https://decollage.vercel.app/api/boutique/expiration` doit répondre `{"annulees":0,"heures":72}` (ou un nombre).
5. Limites du plan Vercel pour les crons (nombre de tâches, fréquence minimale, plan gratuit limité à une exécution par jour d'après la documentation du dépôt) : **à vérifier** sur la page officielle des limites de Vercel. Une exécution par jour suffit pour un délai de 72 h. Solution de secours : `pg_cron` côté Supabase (voir `docs/EXPIRATION-COMMANDES.md`).

### A7. Test réel de bout en bout (environnement en clés TEST)

- Inscription (lien magique reçu), création d'un projet, aperçu.
- Blocage du Gratuit à la publication (message et bouton vers Solo).
- Achat Solo avec la carte de test : cases CGV et renonciation cochées, redirection, retour sur `/parametres?paiement=ok`, formule passée à Solo (webhook).
- Un second clic « S'abonner » doit être refusé (abonnement existant).
- Publication d'un site, inscription à la liste d'attente sur le site publié, création d'une boutique, d'un produit, d'une commande depuis la page publique, suivi par jeton.
- Portail : « Gérer mon abonnement », résiliation ; vérifier que la formule redevient Gratuit et que le site est suspendu (rien n'est supprimé).
- Suppression de compte et export des données (RGPD).
- Deux comptes différents : aucun ne voit les projets de l'autre.

### A8. Sauvegarde et surveillance

- Sauvegarde : Supabase > Database > Backups (selon le plan, **non vérifié**) ; sinon exporter régulièrement (export `pg_dump` ou export des tables). Conserver les fichiers SQL de migration dans git.
- Journaux Vercel (Logs) : surveiller `[stripe] ALERTE double abonnement`, `prix inconnu`, `échec du traitement`, `[stripe/checkout]`.
- Stripe > Webhooks : échecs d'envoi.
- Alertes e-mail Stripe et Supabase activées.

## Ce qui reste en place contre la double facturation (ne rien ajouter)

- Checkout : refus (409) si la formule en base n'est pas Gratuit, ou si un abonnement connu est actif/ambigu.
- Contrôle croisé côté Stripe : si un `stripe_customer_id` existe, liste de tous ses abonnements (limite 100) ; seul un abonnement prouvé terminé (`canceled`, `incomplete_expired`) autorise un nouveau paiement.
- Lecture impossible ou liste incomplète (`has_more`) = refus 503, jamais un « peut-être ».
- Statut inconnu = refus (par défaut prudent, voir `blockingStatus`).
- Clés d'idempotence : création du client Stripe (une par utilisateur) et session de paiement (même formule, même fenêtre de 10 minutes = même session).
- Changement de formule : uniquement par le portail Stripe (prorata géré par Stripe).
- Webhook : signature vérifiée, abonnement relu chez Stripe, panne de base = 500 (Stripe rejoue), prix inconnu n'accorde jamais de formule, alerte `ALERTE double abonnement` dans les journaux.
- Volontairement NON fait : résiliation automatique d'un doublon, remboursement automatique, réconciliation complexe des doublons. Inutile sans client ; le patron traite à la main si l'alerte apparaît.

## B) CORRECTIONS LOCALES POSSIBLES (par Max)

Rien n'a été modifié. Effort : S = moins d'une heure, M = quelques heures, L = une journée ou plus.

| N° | Fichier:ligne | Défaut | Effort |
|---|---|---|---|
| B1 | `src/app/parametres/marque-blanche/page.tsx:169` | Texte faux : « La marque blanche n'est pas comprise dans les formules : activée à la demande ». Faux pour Pro et Illimité (`whiteLabelAllowed` dans `src/lib/plans.ts`, incluse). Message à différencier selon la formule (Gratuit / Solo / Pro, Illimité) | S |
| B2 | `src/app/cgv/page.tsx:22-29` (art. 3) | Aucune mention de l'option marque blanche Solo (+4,99 €, non vendue) ni de l'offre Entreprise sur devis (`docs/TARIFS-COHERENCE.md` lignes 29-31) ; à écrire seulement si ces offres existent à la vente | S à M (texte à valider par le patron) |
| B3 | `src/app/cgv/page.tsx:9,27` ; `src/components/OfferCards.tsx:14` ; `src/app/nouveau/page.tsx:61` | « Illimité » sans nuance, alors que la base plafonne (500 produits par boutique, 2000 par compte, 50 variantes, 200 articles par commande : `docs/BOUTIQUE-API.md`) ; ajouter une clause d'usage raisonnable et un renvoi à la CGV (`docs/TARIFS-COHERENCE.md` lignes 39-40) | M |
| B4 | `src/app/b/[slug]/layout.tsx:48` (et `src/app/s/[slug]`) | La marque blanche n'est pas branchée sur les pages publiées : « Créé avec Décollage » s'affiche pour tous, même Pro/Illimité qui l'ont « incluse » (`docs/MARQUE-BLANCHE.md` lignes 3 et 12). Soit brancher, soit ne pas promettre le retrait de la mention | L (brancher) ou S (retirer la promesse) |
| B5 | `supabase/A-COLLER-0004-0005-0006.sql` | Fichier non suivi par git, doublon de 0004+0005+0006 ; risque de rejeu après 0007/0008. Décision : ne pas le commiter (voir A2) ou l'ignorer dans `.gitignore` | S |
| B6 | `docs/MISE-EN-LIGNE.md:14` | Ne cite les migrations que jusqu'à 0006 : ajouter 0007 et 0008 et l'ordre (déployer le code, puis 0007, puis 0008) | S |
| B7 | `docs/MISE-EN-LIGNE.md:63` | Dit qu'un prix actif inconnu donne Illimité ; le code donne Gratuit (`src/lib/billing.ts:12`, correction d'octobre 2026) : doc périmée, à corriger | S |
| B8 | `src/app/api/boutique/expiration/route.ts:32` (aussi commentaire ligne 5) | Message « Migration 0007 pas encore exécutée » : la route marche déjà avec 0007, le marqueur d'annulation vient de 0008 ; message à reformuler | S |
| B9 | `src/data/legal.ts:9-33` | Champs vides à renseigner par le patron (bloquant légal, A5) ; ajouter un test ou un avertissement de build si vide au lancement (facultatif) | S |
| B10 | `.env.example` (ligne `WHITE_LABEL_USER_IDS=`) | La variable est présente mais vide ; l'indiquer comme facultative commentée comme les autres pour éviter de la définir par erreur | S |

## Mise à jour du 30/10/2026 (grille tarifaire du patron : développement local, rien déployé)

- **Fait localement** : B1 (texte de la page marque blanche), B2 (CGV : formules, option Solo, Entreprise sur devis, marque blanche), B3 (clause d'usage raisonnable : cartes, accueil, création, CGV), B6 et B7 (`docs/MISE-EN-LIGNE.md`), B8 (message et commentaire de la route d'expiration). Libellé « Gratuit » devenu « Découverte » à l'affichage (identifiant interne `gratuit` inchangé). Grille affichée : Découverte 0 €, Solo 2,99 €, option marque blanche +4,99 € (7,98 € au total), Pro 12,99 €, Illimité 29,99 €, Entreprise sur devis.
- **B4 reste à confirmer** : le retrait de « Créé avec Décollage » sur les boutiques publiées est branché par un autre développeur ; les textes disent seulement « sur les boutiques publiées » et ne promettent rien d'autre. À confirmer après lecture de son rapport.
- **À faire par le patron avant d'afficher 12,99 €** : créer le nouveau prix Pro (12,99 €/mois) et l'option marque blanche (4,99 €/mois) dans Stripe, mettre le nouveau `price_…` dans `STRIPE_PRICE_PRO`, voir `docs/ADAPTATION-FACTURATION.md`.
- **CGV** : version passée à 2026-10-30 (`VERSIONS.cgv`). Elle est enregistrée à chaque achat (`legal_acceptances`, contexte « achat ») : aucun abonné existant n'est bloqué, mais les abonnés en cours n'ont pas ré-accepté ces conditions ; voir s'il faut les informer.

## Non vérifié (récapitulatif)

État de la base Supabase et des migrations 0001 à 0006 ; contenu du Dashboard Stripe (clients, abonnements, produits, webhooks, portail, droits de la clé restreinte) ; variables Vercel de production ; plan Vercel et limites des crons ; sauvegardes Supabase ; si le code actuel de `main` est déjà déployé ; conformité juridique des textes.
