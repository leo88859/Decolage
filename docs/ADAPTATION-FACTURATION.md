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
| Checkout à deux lignes (Solo + option) | **Non fait volontairement** (facturation sensible, à valider par le patron) : décrit ci-dessous |
| Création des prix Stripe, variables Vercel, portail | **À faire par le patron** |

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

## (b) Option marque blanche pour Solo (+4,99 €/mois)

État actuel : le **webhook** sait déjà lire l'option (`STRIPE_PRICE_BRAND`, `analyzeSubscription`, `syncBrandOption` dans `brand_entitlements`, source `stripe`, sans jamais modifier la formule, ni toucher un droit `manuel`). Le **checkout** ne l'ajoute pas : l'option n'est pas achetable en ligne, et l'interface le dit (« bientôt disponible à l'achat »).

### Checkout à deux lignes (à décrire, pas fait)

Changements proposés dans `src/app/api/stripe/checkout/route.ts` :
1. Accepter un champ booléen `marqueBlanche` dans le corps. Règles serveur : valable **uniquement** si `plan === "solo"` ET `stripeBrandPrice()` est renseigné ; pour Pro ou Illimité, **refus 400** (jamais de ligne option : elle est déjà incluse, sinon double facturation) ; jamais de prix venant du navigateur.
2. `line_items: [{ price: <prix Solo>, quantity: 1 }, { price: <STRIPE_PRICE_BRAND>, quantity: 1 }]` : **un seul abonnement à deux lignes** (une facture, un renouvellement, un prorata).
3. Clé d'idempotence : y ajouter le drapeau de l'option, sinon un clic avec option réutiliserait la session sans option (même fenêtre de 10 minutes).
4. `subscription_data.metadata` : ajouter l'option pour le suivi.
5. `isPaymentConfigured` : ne pas exiger `STRIPE_PRICE_BRAND` (le paiement se couperait en production). Sans la variable, l'option reste invendable.
6. Interface : `CheckoutDialog.tsx` doit afficher le total 7,98 €/mois et le détail 2,99 + 4,99 avant paiement (obligation d'information) ; la CGV et le texte d'engagement doivent suivre ce montant.
7. Tests à ajouter : option refusée pour Pro/Illimité, option sans variable refusée, deux lignes pour Solo, clé d'idempotence distincte.

### Retrait de l'option au passage à Pro ou Illimité

- Pro et Illimité incluent la marque blanche : un abonné Solo+option qui passe à Pro paierait 4,99 € pour rien si la ligne option reste.
- Le portail Stripe gère mal les abonnements à plusieurs lignes (changement de formule avec retrait d'une ligne : **à vérifier en mode test**, ne pas supposer). Si le portail ne le permet pas : route serveur dédiée de changement de formule (remplace la ligne formule, supprime la ligne option dans la même mise à jour Stripe), ou traitement manuel par le support.
- Webhook : ajouter une alerte journalisée si l'option figure sur un abonnement Pro ou Illimité (double facturation détectée), sans rien changer automatiquement.
- Résiliation de l'option seule : le webhook repasse `brand_entitlements.enabled` à faux (déjà codé).

### Portail

- Ajouter le produit de l'option aux produits autorisés du portail (Paramètres Stripe > Portail client > Abonnements), et vérifier le comportement : ajout et retrait de l'option par l'abonné Solo ; changement Solo vers Pro ; résiliation.

## (c) Ordre de déploiement

1. **Stripe en mode test** : créer les objets ci-dessous, tester le parcours complet (Solo, Pro à 12,99 €, résiliation, webhook reçu, portail).
2. **Stripe en live** : créer le nouveau prix Pro et le prix de l'option. Ne rien modifier ni archiver côté anciens prix.
3. **Vercel (production), dans la même opération** : renseigner `STRIPE_PRICE_PRO` avec le nouveau `price_…` ; si des abonnés sont sur l'ancien prix, mettre l'ancien dans `STRIPE_PRICE_PRO_LEGACY` ; puis déployer le code. Les variables ne s'appliquent qu'au déploiement suivant : le code qui affiche 12,99 € et la variable qui facture 12,99 € arrivent ensemble. **Ne jamais déployer l'affichage à 12,99 € avec l'ancien `STRIPE_PRICE_PRO`.**
4. **Seulement plus tard**, une fois le checkout à deux lignes écrit, testé et validé : renseigner `STRIPE_PRICE_BRAND`, puis déployer ; l'option devient alors achetable (retirer alors « bientôt disponible » dans `OfferCards.tsx`, la CGV et la page marque blanche).
5. Ne jamais déployer le code du checkout à deux lignes avant que le prix de l'option existe dans Stripe.

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
