# Adaptation de la facturation à la grille d'octobre 2026

Analyse du 30/10/2026. Aucune opération Stripe, Supabase ou Vercel n'a été faite (rien de distant lu ni modifié), aucune clé ni variable n'a reçu de valeur.

## Grille décidée

| Formule | Prix affiché | Projets | Marque blanche |
|---|---|---|---|
| Découverte (identifiant interne `gratuit`) | 0 € | 1, sans publication | non comprise |
| Solo | 2,99 €/mois | 1 | option +4,99 €/mois (7,98 €/mois au total) |
| Pro | 12,99 €/mois (ancien 9,99 € : plus affiché) | 5 | incluse |
| Illimité | 29,99 €/mois | illimités (usage raisonnable) | incluse |
| Entreprise | sur devis | rien n'est facturé ni activé | |

## À savoir avant tout

- Les prix de `src/lib/plans.ts` sont **affichés** seulement. La facturation réelle vient du prix Stripe choisi par le serveur (`STRIPE_PRICE_SOLO`, `STRIPE_PRICE_PRO`, `STRIPE_PRICE_ILLIMITE` lus dans `src/lib/env.ts`).
- **Tant que `STRIPE_PRICE_PRO` désigne l'ancien prix à 9,99 €, afficher 12,99 € ferait payer 9,99 € : prix affiché différent du prix facturé.** Le code local affiche déjà 12,99 € : ne pas le déployer avant l'étape 3 ci-dessous.
- Un prix Stripe ne se modifie pas : changer un montant = créer un nouveau prix.

## Fait / à faire

| Sujet | État |
|---|---|
| Affichage de la nouvelle grille (plans.ts, cartes, accueil, Paramètres, CGV, docs) | **Fait localement**, non déployé |
| Reconnaissance d'anciens prix par le webhook (variables facultatives `STRIPE_PRICE_SOLO_LEGACY`, `STRIPE_PRICE_PRO_LEGACY`, `STRIPE_PRICE_ILLIMITE_LEGACY`) | **Fait et testé** (`env.ts`, `billing.ts`, webhook, `billing.test.ts`), rétrocompatible : variable absente = comportement identique à avant |
| Checkout Solo avec ou sans option (2 lignes d'UN SEUL abonnement), interface et total affiché | **Fait et testé en simulation** (`checkout/route.ts`, `billing.ts` `buildCheckoutLines`, `CheckoutDialog.tsx`, Paramètres) |
| Ajout / retrait de l'option sur un abonnement Solo existant | **Fait et testé en simulation** : route `/api/stripe/option` (uniquement sur clic) |
| Webhook : lit tous les éléments, droit `brand_entitlements` (source `stripe`) accordé/retiré, retrait de la ligne option si Pro/Illimité | **Fait et testé** (Stripe simulé ; base réelle en mémoire PGlite pour les limites et le droit) |
| Prix Stripe du patron (4 identifiants vérifiés en lecture le 30/10/2026) | **Vérifiés** (voir plus bas) ; variables locales renseignées dans `.env.local` (non versionné) |
| Variables Vercel, portail Stripe, tests en mode TEST, déploiement | **À faire par le patron** : voir `docs/CHECKLIST-LANCEMENT.md`, section « Stripe : mise en service » |

## (a) Nouveau prix Pro à 12,99 €

### Ce qui se passe avec un nouveau `price_…`

1. Le checkout n'utilise que `STRIPE_PRICE_PRO` : après changement de la variable, tout nouvel abonné Pro paie 12,99 €.
2. Les abonnés Pro existants restent sur l'ancien prix (Stripe ne les migre pas tout seul). Leur abonnement contient un `price_…` que `stripePrices()` ne connaît plus.
3. Au prochain événement webhook de cet abonnement : prix inconnu, donc `analysis.plan = null` et une erreur journalisée. `resolvePlan` conserve la formule précédente **seulement si** le profil a déjà ce `stripe_subscription_id` (cas normal d'un abonné dont le premier paiement a été enregistré) ; sinon, c'est **Gratuit** et les publications sont suspendues (rien n'est supprimé). Donc : risque réel pour un abonné dont le webhook initial n'aurait jamais été traité, et une alerte en erreur à chaque événement pour les autres.

### Solution implémentée : liste d'anciens prix

- Variables facultatives, séparées par des virgules : `STRIPE_PRICE_PRO_LEGACY` (et `_SOLO_LEGACY`, `_ILLIMITE_LEGACY` si un jour un autre prix change).
- Le webhook reconnaît ces prix comme la **même formule** ; ils ne sont **jamais** utilisés par le paiement ; un prix absent de toute liste reste « inconnu » (aucune formule accordée).
- Ancien et nouveau prix Pro sur le même abonnement : une seule formule (Pro), pas d'ambiguïté.
- À renseigner par le patron avec l'identifiant de l'ancien prix à 9,99 € **uniquement s'il y a des abonnés dessus** (sinon inutile).

### Décisions du patron

- Les abonnés à 9,99 € le restent-ils (recommandé tant qu'aucun avis n'a été envoyé) ou passent-ils à 12,99 € (migration dans Stripe + information préalable des abonnés, à cadrer juridiquement) ? Le code ne change pas leur prix.
- Ne **modifier ni archiver** l'ancien prix avant d'avoir vérifié, dans Stripe (Catalogue de produits, prix à 9,99 €, onglet des abonnements), qu'aucun abonné ne l'utilise. Archiver un prix empêche seulement de nouvelles souscriptions ; les abonnements existants continuent, mais mieux vaut ne pas y toucher avant vérification.

## (b) Option marque blanche pour Solo (+4,99 €/mois) : FAIT (30/10/2026, local, non déployé)

### Les 4 prix (vérifiés en lecture seule chez Stripe : mode LIVE, actifs, EUR, mensuels, `interval_count` 1)

| Variable | Identifiant | Montant | Produit |
|---|---|---|---|
| `STRIPE_PRICE_SOLO` | `price_1UTOYlQl0aNnS3rPqmzoTBfH` | 2,99 € | Décollage Solo |
| `STRIPE_PRICE_BRAND` | `price_1UWIsqQl0aNnS3rPe6swbnSW` | 4,99 € | Décollage — Option marque blanche |
| `STRIPE_PRICE_PRO` | `price_1UTOZXQl0aNnS3rPwL7z8Gb5` | 12,99 € | Décollage Pro |
| `STRIPE_PRICE_ILLIMITE` | `price_1UTOagQl0aNnS3rP9q3LLjc0` | 29,99 € | Décollage Illimité |

Ces prix sont en mode LIVE : ils n'existent pas en mode TEST (les identifiants de test sont différents).

### Paiement (`/api/stripe/checkout`)

- Corps : `plan` + `brandOption` (booléen). Liste blanche côté serveur (`buildCheckoutLines`) : l'option n'est acceptée que pour `solo` et seulement si `STRIPE_PRICE_BRAND` est renseignée ; toute autre valeur (texte, nombre, liste « deux fois ») est refusée en 400 ; Pro/Illimité + option : 400. Les prix ne viennent jamais du navigateur.
- Session d'abonnement unique : `line_items` = [Solo, option]. Clé d'idempotence = utilisateur + formule + « +brand » + identifiants de prix + fenêtre de 10 min (Solo et Solo+option ne se confondent pas).
- Inchangé : refus prudent si un abonnement existe (base ET relecture Stripe), preuve CGV + renonciation enregistrée avant l'ouverture du paiement.
- Interface : case « Ajouter l'option marque blanche » dans la fenêtre de commande de Solo, total 7,98 € ou 2,99 €. La case n'apparaît que si le serveur confirme que l'option est vendable (`GET /api/stripe/option`).

### Ajout / retrait sur un abonnement Solo existant (`/api/stripe/option`)

Choix retenu : route serveur dédiée (plutôt que le portail, dont le comportement sur plusieurs lignes n'est pas vérifié). Sur clic uniquement :
- l'abonnement est identifié en base, puis relu chez Stripe : même client, statut `active`/`trialing` (pas past_due, unpaid, paused), formule Solo reconnue, aucun élément inconnu, pas de fin programmée (pour l'ajout) ;
- **ajout** : `subscriptions.update` avec la ligne option, `proration_behavior: always_invoice` (le prorata du mois en cours est facturé tout de suite) et `payment_behavior: error_if_incomplete` (si le paiement échoue, Stripe refuse et rien n'est ajouté : pas d'accès offert) ; CGV et renonciation exigées et enregistrées ;
- **retrait** : suppression de la seule ligne option (`subscriptionItems.del`), crédit au prorata (`create_prorations`) sur la prochaine facture ;
- idempotente : option déjà présente (ajout) ou absente (retrait) = succès sans modification ; clés d'idempotence Stripe ;
- elle n'écrit JAMAIS le droit : seul le webhook le fait, après relecture de l'abonnement.

### Webhook

- Lit tous les éléments : formule = élément formule connu (ou ses `*_LEGACY`) ; option = élément `STRIPE_PRICE_BRAND` ; élément inconnu = rien accordé (journalisé).
- Droit : abonnement actif (`active`, `trialing`, `past_due` : accès gardé) + formule Solo + élément option → `brand_entitlements.enabled = true`, `source = 'stripe'`. Option retirée, abonnement `canceled`/`unpaid`/`paused`/`incomplete*`, ou formule ≠ Solo → ligne `stripe` désactivée (Pro/Illimité : droit inclus par la formule, `whiteLabelAllowed`). Retour à Solo sans option : la mention « Créé avec Décollage » est de nouveau affichée. Droit `manuel` : jamais modifié (la mise à jour est aussi filtrée par `source = 'stripe'` dans la requête) ; si l'option est payée alors qu'un droit manuel désactivé existe, c'est seulement journalisé.
- Aucune migration nécessaire : la colonne `source` existe depuis la migration 0006. Si elle manque, le webhook journalise, ne donne pas le droit, et la mention reste affichée.
- **Double facturation Solo+option → Pro/Illimité** : si une formule Pro/Illimité reconnue figure sur un abonnement actif/trialing qui porte encore l'élément option, le webhook SUPPRIME cet élément (crédit au prorata, clé d'idempotence par élément). Échec = 500, Stripe rejoue, et le rejeu ne trouve plus l'élément. Jamais fait sur un abonnement impayé (past_due…) ni sans formule reconnue ; seul un élément au prix exact de l'option est retiré.
- Erreur de lecture/écriture en base → 500 (rejeu), jamais de faux succès.

### Portail Stripe : ce que le patron doit configurer (action manuelle, mode TEST d'abord)

1. Dashboard → Paramètres → Facturation → Portail client. Activer « Résilier les abonnements » (au choix : immédiatement ou fin de période).
2. « Les clients peuvent changer de formule » : autoriser les produits Solo, Pro et Illimité (les 3 prix mensuels ci-dessus). **Ne pas ajouter le produit « Option marque blanche »** : l'ajout/retrait de l'option passe par Paramètres › Formule (route ci-dessus), qui est la voie testée.
3. Vérifier en mode TEST le comportement du portail sur un abonnement Solo+option : (a) ce que propose le portail ; (b) passage à Pro : l'option doit disparaître seule (sinon le webhook la retire, avec crédit) ; (c) Pro → Solo : l'option est absente par défaut. Si le portail refuse de changer de formule sur un abonnement à deux lignes, l'abonné doit d'abord retirer l'option dans Paramètres, puis changer de formule.
4. Webhook : mêmes 6 événements (checkout.session.completed, customer.subscription.created/updated/deleted/paused/resumed).

### Anciens prix (`STRIPE_PRICE_*_LEGACY`) : usage précis

- Rôle : le webhook reconnaît le prix porté par un abonné existant (ex. Pro à 9,99 €) comme la même formule ; le paiement ne les propose JAMAIS ; aucun prix d'abonné existant n'est modifié ; un abonné à l'ancien prix Pro garde Pro.
- **Avant** de remplacer `STRIPE_PRICE_PRO` dans Vercel : recopier l'ancien identifiant (la valeur actuelle de `STRIPE_PRICE_PRO` en production, si c'est l'ancien prix) dans `STRIPE_PRICE_PRO_LEGACY` (liste séparée par des virgules). Sans cela, ces abonnés auraient un « prix inconnu » : formule conservée seulement s'ils sont déjà connus, sinon Découverte.
- Même principe pour `STRIPE_PRICE_SOLO_LEGACY` et `STRIPE_PRICE_ILLIMITE_LEGACY` si un de ces prix change un jour. Pas de valeurs dans ce dépôt.

### Ce qui n'est testé qu'en simulation

Tout le comportement de Stripe (prorata, refus de paiement à l'ajout, effet du portail, envoi réel des webhooks, suppression d'élément) est SIMULÉ : aucun test n'appelle Stripe ni Supabase réels. Les limites (1/5/illimité) et le droit `my_white_label_allowed()` sont vérifiés sur de vraies migrations dans PGlite. Il reste à faire le parcours complet en mode TEST Stripe (carte 4242 4242 4242 4242 ; échecs 4000 0000 0000 0341 ou 4000 0000 0000 9995).

## (c) Ordre de déploiement

1. **Stripe en mode test** : créer les objets ci-dessous, tester le parcours complet (Solo, Pro à 12,99 €, résiliation, webhook reçu, portail).
2. **Stripe en live** : créer le nouveau prix Pro et le prix de l'option. Ne rien modifier ni archiver côté anciens prix.
3. **Vercel (production), dans la même opération** : renseigner `STRIPE_PRICE_PRO` avec le nouveau `price_…` ; si des abonnés sont sur l'ancien prix, mettre l'ancien dans `STRIPE_PRICE_PRO_LEGACY` ; puis déployer le code. Les variables ne s'appliquent qu'au déploiement suivant : le code qui affiche 12,99 € et la variable qui facture 12,99 € arrivent ensemble. **Ne jamais déployer l'affichage à 12,99 € avec l'ancien `STRIPE_PRICE_PRO`.**
4. Le checkout à deux lignes est écrit et testé en simulation. Renseigner `STRIPE_PRICE_BRAND` dans Vercel **avant** le déploiement qui contient ce code (sans la variable, l'option reste invendable et rien d'autre ne change). Ordre complet : `docs/CHECKLIST-LANCEMENT.md`.
5. Ne jamais déployer avant d'avoir testé le parcours en mode TEST Stripe.

Remarque : le code qui lit `STRIPE_PRICE_PRO_LEGACY` et celui qui affiche 12,99 € sont dans la même branche locale ; il n'y a donc pas de déploiement séparé possible, et c'est sans danger tant que la variable `STRIPE_PRICE_PRO` change dans la même opération (étape 3).

## Liste exacte des objets à créer dans Stripe (par le patron)

Aucun identifiant n'est inventé ici ; tu copieras les `price_…` créés.

1. **Prix** : nouveau prix récurrent mensuel de **12,99 €** (EUR) sur le produit « Décollage Pro » (ou un nouveau produit), même réglage de taxe que les trois prix existants. Son identifiant va dans `STRIPE_PRICE_PRO`. L'ancien prix à 9,99 € : laissé tel quel, actif.
2. **Produit « Décollage Marque blanche (option Solo) »** avec un prix récurrent mensuel de **4,99 €** (EUR), même réglage de taxe. Son identifiant ira dans `STRIPE_PRICE_BRAND` plus tard (étape 4).
3. **Portail client** : autoriser le nouveau prix Pro (et plus tard l'option) dans la section Abonnements ; vérifier résiliation et changement de formule.
4. **Webhook** : aucun changement (mêmes 6 événements).
5. **Entreprise** : aucun produit ni prix (devis, rien à créer).
6. **Variables Vercel** (par le patron, jamais par le code ou un agent) : `STRIPE_PRICE_PRO` (nouveau), `STRIPE_PRICE_PRO_LEGACY` (ancien, si abonnés dessus), `STRIPE_PRICE_BRAND` (plus tard).
7. **Vérification avant d'archiver quoi que ce soit** : nombre d'abonnements actifs sur l'ancien prix Pro.

## Fichiers touchés par cette adaptation

- `src/lib/billing.ts` : 5e paramètre facultatif `legacyPrices` de `analyzeSubscription`.
- `src/lib/env.ts` : `stripeLegacyPrices()`.
- `src/app/api/stripe/webhook/route.ts` : passe `stripeLegacyPrices()` à l'analyse.
- `src/lib/billing.test.ts` : 4 tests des anciens prix.
- `.env.example` : lignes commentées, sans valeur.
- Inchangés : `checkout/route.ts`, `portal/route.ts`.
