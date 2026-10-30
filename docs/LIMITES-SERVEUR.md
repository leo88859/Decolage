# Limites de formule : ce que le serveur applique

Source des valeurs : `src/lib/plans.ts` (miroir SQL : `supabase/0004_limites_serveur.sql`, `0005_boutique.sql`, puis `0006_regle_gratuit.sql`, puis `0007_durcissement.sql` qui a le dernier mot ; des tests comparent le SQL à `plans.ts`).

**Migrations à exécuter À LA MAIN (Supabase, SQL Editor), dans cet ordre : `0004` puis `0005` puis `0006` puis `0007` (durcissement, voir la section dédiée plus bas).** Chacune est rejouable et ne supprime rien. `0006` ne modifie pas les fichiers 0004 et 0005 : elle remplace des fonctions, des déclencheurs et des politiques par de nouvelles versions. Tant que `0006` n'est pas exécutée, la règle « Gratuit = 1 projet » et les gardes décrites plus bas côté base ne sont pas actives (les gardes de l'API, elles, le sont dès le déploiement du code).

## Droits par formule (règle du patron, octobre 2026)

| | Découverte (id. interne « gratuit », 0 €) | Solo (2,99 €) | Pro (12,99 €) | Illimité (29,99 €, usage raisonnable) | Entreprise |
|---|---|---|---|---|---|
| Projets (maxProjets) | **1** | 1 | 5 | illimité | sur devis, rien d'activé |
| Créer, modifier, enregistrer, retrouver, prévisualiser | oui | oui | oui | oui | |
| **Publier sur Internet** (sites ET boutiques) | **non** | oui | oui | oui | |
| Sites + boutiques publiés en même temps (maxSites) | 0 | 1 | 5 | illimité | |
| Modèles premium, export, duplication, personnalisation avancée, plans détaillés | non | oui | oui | oui | |
| Marque blanche | non | option (+4,99 €/mois, 7,98 € au total ; pas encore achetable en ligne) | incluse | incluse | |

Entreprise n'existe ni dans `plans.ts` ni dans la contrainte `profiles.plan` : aucune facturation, aucune activation. Le prix « sur devis » n'est rattaché à aucun prix Stripe.

## Chemins de publication et garde de chacun

Le principe : plusieurs couches indépendantes, la base ayant le dernier mot. Aucune n'est « dans l'interface seulement ».

| Chemin | Garde 1 (route) | Garde 2 (base, migration 0006) |
|---|---|---|
| Publier / mettre à jour un site : `POST /api/sites` | formule lue dans `profiles` (jamais envoyée par le navigateur) : Gratuit = 403 `publication_formule` (même pour une ancienne URL) ; sinon limite sites + boutiques publiées = 403 `limite_sites` | déclencheur `sites_enforce_plan` : refuse l'insertion d'un site pour un compte Gratuit **même par le serveur (service_role)**, applique la limite sites + boutiques, refuse de remettre en ligne (suspended_at nul) le site d'un compte Gratuit. Écriture directe depuis le navigateur : déjà retirée (0002). |
| Publier une boutique : `PATCH /api/boutique/{id}` avec `statut: "publiee"` (ou création directe déjà publiée) | écrit avec la session de l'utilisateur (la RLS s'applique) ; l'erreur de la base devient un 403 clair | déclencheur `boutique_enforce_limit` : formule payante obligatoire (hint `publication_formule`, y compris pour service_role), puis limite maxSites avec les sites publiés (`limite_sites`) |
| Créer une boutique (brouillon) | | même déclencheur : au plus `plan_max_projects` boutiques (Gratuit 1, Solo 1, Pro 5, Illimité ∞) (`limite_boutiques`) |
| Lire une page publique `/s/{slug}` | `loadSite` refuse `suspended_at` | politique « lecture publique des sites publiables » : visible seulement si `suspended_at` est nul **et** si le propriétaire a une formule qui publie (`owner_can_publish`) |
| Lire `/b/{slug}`, `/api/boutique/catalogue/{slug}` | filtre `statut = 'publiee'` | politique de lecture : `statut = 'publiee'` ET non suspendue ET propriétaire autorisé ; idem pour catégories, produits, variantes (`boutique_publiee`). Sinon 404. |
| Commander dans une boutique | `/api/boutique/commande` : 404 `boutique_introuvable` | `boutique_creer_commande` + déclencheur `commandes_boutique_publiable` : aucune commande sur une boutique non publique, stock intact |
| Liste d'attente d'un site | `/api/waitlist/{slug}` (seule voie d'inscription depuis la migration 0007, clé serveur) | fonction `waitlist_inscrire` : le site doit être non suspendu ET lisible par le public (donc propriétaire autorisé) ; plus aucune insertion directe par le navigateur (0006 : politique d'inscription ; 0007 : retirée) |

Conséquence importante : si un compte repasse en Gratuit, ses anciennes URL publiques répondent 404 **immédiatement**, sans attendre le webhook Stripe (la lecture publique dépend de la formule courante dans `profiles`).

## Nombre de projets

- Trigger `projects_enforce_limit` (0004, valeurs mises à jour par 0006) : Gratuit 1, Solo 1, Pro 5, Illimité ∞. Seules les **créations** de nouvelles lignes sont bloquées ; lire, modifier, synchroniser (upsert) et supprimer un projet existant reste permis, même au-delà de la limite après une résiliation. Le serveur (service_role) et l'admin SQL ne sont pas bloqués. Verrou par utilisateur contre les insertions simultanées. Une duplication est une insertion : comptée.
- Boutiques : mêmes plafonds de création que les projets (compteur séparé : un Gratuit peut avoir 1 projet ET 1 boutique en brouillon). Choix le plus simple et cohérent avec « 1 projet ou boutique gratuit en brouillon » ; la publication reste, elle, interdite.

## Brouillon de boutique pour le Gratuit

Le Gratuit peut créer 1 boutique (statut `brouillon`), ses catégories, produits et variantes, les modifier et les retrouver. Elle n'est lisible que par lui (RLS) : aucune URL publique, `/b/{slug}` répond 404. « Publier la boutique » est refusé par la base ; l'interface affiche l'explication et un bouton « Passer à Solo » (vers `/parametres#formule`).

## Aperçu

L'aperçu (constructeur, galerie des designs, onglet landing, `LivePreview`) est local : `iframe` avec `srcDoc`, sans appel serveur ni création de ligne dans `sites` ou `boutiques`. Un site n'a une adresse publique que par `POST /api/sites`, refusé au Gratuit. Testé : `src/lib/regle-gratuit.test.ts` (aucune ligne `sites`, brouillon invisible du public).

## Rétrogradation ou résiliation : comportement choisi

Principe : **on ne supprime jamais** un projet, un site, une boutique, un produit, une commande ou une liste d'attente. Quand le webhook Stripe reçoit une résiliation ou un changement de formule :

1. `profiles.plan` est mis à jour (Gratuit si l'abonnement n'est plus actif).
2. `syncPublicationsWithPlan` (`src/lib/site-lifecycle.ts`) répartit les **sites et boutiques publiés** sous la **même** limite maxSites : les plus anciennement publiés restent en ligne dans la limite, les autres reçoivent `suspended_at`. Gratuit : tout est suspendu.
3. Un élément **suspendu** n'est plus accessible publiquement (404), n'accepte plus de commande ni d'inscription, mais sa donnée est conservée et reste lisible et modifiable par son propriétaire. L'interface l'affiche (« Suspendu / Suspendue ») avec une explication.
4. Nouvelles publications : bloquées par les gardes ci-dessus tant que la formule ne le permet pas (compte des éléments suspendus compris : il faut en dépublier un ou monter de formule).
5. **Réactivation** : au prochain événement d'abonnement, si la nouvelle formule laisse de la place, les éléments suspendus qui rentrent dans la limite (les plus anciens d'abord) sont réactivés automatiquement (même règle que pour les sites depuis 0002). Un brouillon ne devient jamais public tout seul. Un propriétaire ne peut pas lever lui-même une suspension (colonne non modifiable depuis le navigateur) ; repasser une boutique en brouillon efface sa suspension.
6. Si la synchronisation échoue (migration manquante), elle est journalisée sans donnée personnelle ; la lecture publique reste de toute façon fermée au Gratuit par la politique RLS.

Reste ouvert (non automatisé) : aucun e-mail n'est envoyé au propriétaire lors d'une suspension.

## Facturation (src/lib/billing.ts, webhook)

- Le webhook analyse **tous** les éléments de l'abonnement (`analyzeSubscription`) : formule principale d'une part, option marque blanche d'autre part (variable optionnelle `STRIPE_PRICE_BRAND`, absente par défaut).
- **Prix inconnu ou supplément inconnu : jamais de formule supérieure.** Avant octobre 2026, un prix inconnu donnait Illimité (faille). Maintenant : formule reconnue = celle-là ; plusieurs formules = la moins chère ; aucune formule reconnue = on conserve la formule précédente **uniquement si c'est le même abonnement déjà connu**, sinon Gratuit ; dans tous les cas l'incident est journalisé (identifiants de prix, jamais d'e-mail ni d'identifiant client).
- **Option marque blanche** : droit distinct, enregistré dans `brand_entitlements` (colonne `source = 'stripe'`, migration 0006). Elle ne modifie jamais `profiles.plan`. L'option seule n'accorde aucune formule. Un droit accordé à la main (`source = 'manuel'`, valeur par défaut) n'est jamais touché par Stripe.
- Aucun produit ni prix Stripe n'a été créé ; le paiement de l'option n'est **pas** proposé dans le checkout (voir `docs/MARQUE-BLANCHE.md`).

## Formule : impossible de se l'attribuer

`profiles.plan`, `stripe_*`, `subscription_status` ne sont pas modifiables par le navigateur (update limité à `favorites` ; insert/delete retirés en 0004). Testé.

## Isolation

RLS sur `projects`, `profiles`, `boutiques` (+ produits, variantes, commandes), `brand_*`. Lecture/écriture de l'élément d'un autre refusée, création au nom d'un autre refusée, changement de propriétaire refusé. Testé.

## Reste côté navigateur seulement

- **Export de fichiers/ZIP** : généré dans le navigateur (`export.ts`, `zip.ts`). Aucun appel serveur à bloquer ; un utilisateur qui a un projet peut contourner l'interface. (`/api/account/export` est l'export RGPD, ouvert à tous : normal.)
- **Modèles premium, personnalisation avancée, plans détaillés** : contenu livré avec l'application, utilisé dans le navigateur ; seule la création de projet (comptée) est protégée.
- **Mode sans cloud** : la formule se choisit localement pour tester ; aucune limite réelle, aucune publication possible de toute façon (pas de serveur).

## Failles restantes connues

- `owner_can_publish(uuid)` est appelable par le public avec un UUID (conséquence de la lecture publique par RLS) : il révèle seulement « ce compte a-t-il une formule payante ». Les UUID ne sont pas listables (colonne `proprietaire_id` non lisible par le public).
- Les gardes de comptage (`limite_sites`) ne s'appliquent pas à l'administrateur SQL (postgres) ; elles s'appliquent au navigateur ; la garde « Gratuit ne publie pas » s'applique aussi à service_role.
- Un compte dont le webhook Stripe n'a jamais été reçu garde la formule enregistrée (état de Stripe non relu en continu).
- Non testé contre un vrai Supabase ni un vrai Stripe (voir le compte rendu).

## Correctifs d'audit (octobre 2026) : origine, webhook, double facturation, sites suspendus

- **Contrôle d'origine (CSRF)** : `src/lib/origin.ts` (`originGuard`). Appliqué à `DELETE /api/account`, `POST` et `DELETE /api/sites`, `POST /api/stripe/checkout`, `POST /api/stripe/portal`, `POST /api/legal/accept`. Règle : méthode non sûre => `Origin` (à défaut l'origine du `Referer`) doit être celle de la requête ou `NEXT_PUBLIC_APP_URL` ; absent, `null` ou étranger => 403 `origin`. Exclus : webhook Stripe (signature) et liste d'attente publique. Les prévisualisations Vercel ne sont pas acceptées (comme ailleurs). Les routes `/api/boutique` et `/api/brand` gardent leur copie locale (même règle, sans repli Referer) : à fusionner plus tard avec `origin.ts`. Un domaine personnalisé exige de mettre à jour `NEXT_PUBLIC_APP_URL`.
- **Cookies d'auth** : le code ne configure aucune option ; `@supabase/ssr` applique ses valeurs par défaut (`SameSite=Lax`, `httpOnly=false` car le client navigateur doit lire la session, `Secure` non forcé par le code). `SameSite=Lax` n'est pas une protection suffisante seule contre les écritures déclenchées par un site du même « site » : d'où le contrôle d'origine.
- **Webhook** : si l'écriture du plan, la lecture du profil, la synchronisation des publications (`syncPublicationsWithPlan` renvoie `ok:false`) ou l'option marque blanche (hors migration absente) échouent => 500, Stripe rejoue. Le rejeu relit l'abonnement chez Stripe et refait les mêmes écritures (idempotent) : il complète une suspension manquante. Types d'événements non gérés : 200 « ignoré ».
- **Checkout** : refus (409 `abonnement_existant` ou 503 `verification_impossible`) si la base indique une formule payante ou un abonnement non terminé, ou si Stripe (`subscriptions.list`, tous statuts) en liste un non terminé. Seuls `canceled` et `incomplete_expired` prouvent la fin ; statut inconnu, erreur Stripe ou plus de 100 abonnements => refus. Limite connue : deux sessions de paiement ouvertes en même temps avant tout paiement ne sont pas détectées (l'abonnement n'existe qu'après paiement).
- **Sites suspendus et limite** : l'API (`POST /api/sites`) ne compte plus que les sites ET boutiques EN LIGNE (`suspended_at` nul). Un site suspendu n'est jamais réactivé par cette route.
  **Écart avec la base (0006)** : `sites_enforce_plan` comptait TOUS les sites (suspendus compris) : un nouvel INSERT était refusé par la base alors que l'API l'autorisait. **Corrigé par la migration 0008** (voir « Suspendus et limite » plus bas).

## Durcissement de sécurité (migration 0007, audit d'octobre 2026)

`supabase/0007_durcissement.sql` (copie identique pour le copier-coller : `supabase/A-COLLER-0007.sql`). **À exécuter en dernier, après 0006**, rejouable sans erreur, ne modifie aucune donnée ni les fichiers 0001 à 0006. Ne rejoue jamais 0005 ou 0006 *après* elle (elles recréeraient d'anciennes politiques de lecture) ; si cela arrive, rejoue 0007. **Ordre de mise en ligne conseillé : déployer d'abord le code (il fonctionne avec ou sans 0007 grâce à des replis), puis exécuter 0007.**

| Problème | Correction |
|---|---|
| Liste d'attente : insertion directe par `anon` via PostgREST (spam sans limite, doublon = 409 qui révèle une adresse) | insertion retirée pour `anon`/`authenticated` (politique supprimée, `revoke insert`) ; inscription par la route `/api/waitlist/{slug}` -> fonction `waitlist_inscrire` (service_role) : réponse **identique** pour un doublon, e-mail en minuscules et au bon format (contrainte `not valid`), plafond de 5000 inscrits par site, 300 inscriptions par heure et par site, limite par IP en base |
| Commandes sans paiement qui bloquent le stock | limite de débit en base (`limite_debit`, par IP, entre instances) ; 3 commandes « nouvelle » en 7 jours par contact et par boutique ; 200 articles au plus par commande ; comptage « 100 par heure » sous verrou consultatif par boutique ; `boutique_expirer_commandes_nouvelles(interval)` (non planifiée : voir `docs/BOUTIQUE-API.md`) |
| Plafonds / images | 500 produits par boutique, 2000 par compte, 50 variantes par produit, 50 catégories par boutique (déclencheurs) ; URL d'images et logo en https, 500 caractères, 5 images, sans espace ni balise ni identifiants (contraintes `not valid`, valables aussi en écriture directe) |
| Exposition publique | `anon` ne lit plus `sites.user_id` / `project_id` (droits de colonnes) ; un compte connecté ne lit que SES sites et SES boutiques (plus `proprietaire_id` / `suspended_at` des autres) ; stock exact : `anon` ne lit plus `variantes`, il lit la vue `variantes_publiques` (`disponible`, `stock_bas`) ; l'API catalogue ne renvoie plus `stock` |
| TRUNCATE / REFERENCES / TRIGGER | retirés à `anon` et `authenticated` sur toutes les tables de Décollage (la suppression de compte et ses cascades, faites par le serveur, sont testées) |
| Création produit + variantes non atomique | fonction `boutique_creer_produit` (droits du commerçant, tout ou rien) appelée par `POST /api/boutique/{id}/produits` |
| Référence de commande de 32 bits | nouvelles références `CMD-` + 12 hexadécimaux (48 bits) ; collision = nouvelle tentative ; anciennes références (8) toujours valables |
| Divers | fonctions de déclencheur non exécutables via `/rpc` ; quantité non numérique -> `E_QUANTITE_INVALIDE` (jamais d'erreur brute) ; adresses réservées (`admin`, `api`...) refusées en base pour les sites et les boutiques |

### Code généré (kit « waitlist »)
Le code généré pour l'utilisateur du SaaS (`src/lib/codegen/kit-cloud.ts`) écrit dans **le Supabase de cet utilisateur** (tables `listes` / `inscriptions`, fonction `inscrire`), un autre projet que celui de Décollage : il n'écrit jamais dans la table `waitlist` de Décollage et n'est pas modifié. Seuls la landing publiée (`/s/{slug}`, formulaire vers `/api/waitlist/{slug}`) et l'onglet « En ligne » (lecture et suppression par le propriétaire, avec sa session) touchent `waitlist`. Dans le code généré, l'inscription publique passe déjà par la fonction `inscrire` (réponse identique pour un doublon) et non par une insertion directe ; sa limite de débit dépend du Supabase de l'utilisateur, hors de la portée de cette migration.

### Reste ouvert après 0007
- Un compte connecté garde l'exécution de `my_plan()`, `boutique_possedee()`, `owner_can_publish()`... (nécessaires aux politiques) ; ils ne révèlent que l'état de la formule.
- La vue `variantes_publiques` s'exécute avec les droits de son propriétaire (le linter Supabase peut l'afficher comme « security definer view ») : c'est voulu, elle ne montre que des booléens et seulement les variantes publiques.
- Limite de débit en fenêtre fixe : une rafale à cheval sur deux fenêtres peut doubler brièvement le plafond. Un attaquant qui change d'adresse IP contourne la limite par IP (les plafonds par contact, par boutique, 100 par heure et l'expiration limitent le dégât).
- L'expiration des commandes n'est exécutée que si le patron la planifie (pg_cron ou route protégée).
- Le stock exact n'est plus affiché au public : « stock bas » sans nombre ; une quantité trop grande n'est refusée qu'à la commande (409).
- Non testé contre un vrai Supabase (PGlite simule PostgreSQL, rôles et droits par défaut compris) ; voir le compte rendu.

## Suspendus et limite de publication (migration 0008)

`supabase/0008_suspendus_et_expiration.sql` (copie identique : `supabase/A-COLLER-0008.sql`). **À exécuter en dernier, après 0007**, rejouable, ne modifie ni ne supprime aucune donnée. Si 0007 est rejouée un jour, rejoue ensuite 0008.

**Règle (identique dans la base et dans l'API)**
- Seuls les sites et boutiques **en ligne** (`suspended_at` nul) comptent dans la limite (Solo 1, Pro 5, Illimité sans limite, Gratuit jamais). Sites et boutiques partagent **une seule limite** et **un seul verrou** par propriétaire.
- Rétrogradation : les plus anciennement publiés restent en ligne, les autres sont suspendus (rien n'est supprimé). Un suspendu ne compte pas : on peut publier un **nouveau** site dans la limite.
- **Réactiver** un suspendu (`suspended_at` repassé à nul) est soumis à la même limite, **y compris pour le serveur (`service_role`)** ; refusé pour le Gratuit. Seul l'administrateur SQL (`postgres`, `supabase_admin`) n'est pas bloqué (dépannage manuel).
- Le navigateur ne peut toujours pas écrire `suspended_at` (aucun droit de colonne). Suspendre reste toujours permis au serveur.
- `syncPublicationsWithPlan` applique d'abord **toutes** les suspensions, puis les réactivations (sinon la base refuserait une réactivation avant que la place soit libérée).

**Décisions à confirmer par le patron** (ce n'est pas un changement de droit commercial, mais le comportement est maintenant strict) :
1. Une boutique ou un site suspendu qui devient réactivable (réabonnement) n'est réactivé que si la synchronisation le choisit : le plus ancien d'abord. Aucun autre critère n'existe.
2. Une boutique publiée par le serveur (`service_role`) à partir d'un brouillon n'est toujours pas contrôlée par la limite (seul le navigateur l'est, comme avant) ; aucune route actuelle ne le fait.

## Seuils appliqués (base ET serveur)

| Seuil | Où | Test (N passe, N+1 refusé) |
|---|---|---|
| 3 commandes « nouvelle » / contact / 7 jours / boutique | `boutique_creer_commande` (429 `trop_de_commandes_contact`) | `seuils-0008.test.ts`, `durcissement-0007.test.ts` |
| 200 articles / commande (99 par variante, 20 lignes) | validation de la route (400) ET base (`E_QUANTITE_INVALIDE`) | `seuils-0008.test.ts`, `validate-0007.test.ts` |
| 500 produits / boutique | déclencheur `boutique_plafonds` (403 `plafond_produits`), tous les rôles | `seuils-0008.test.ts` |
| 2 000 produits / compte | idem (boutiques cumulées) | `seuils-0008.test.ts` |
| 50 variantes / produit | validation de la route (400) ET déclencheur (403 `plafond_variantes`) | `seuils-0008.test.ts` |
| 50 catégories / boutique | déclencheur (403 `plafond_categories`) | `seuils-0008.test.ts` |
| 5 000 inscrits / liste d'attente | `waitlist_inscrire` (`liste_pleine`) ET déclencheur `waitlist_plafond` | `seuils-0008.test.ts`, `waitlist-route.test.ts` |

Vérification : aucun de ces seuils n'était contourné ; aucune correction de code n'a été nécessaire pour eux. Expiration des commandes (72 h) : voir `docs/EXPIRATION-COMMANDES.md`.
