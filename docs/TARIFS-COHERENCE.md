# Cohérence des tarifs : audit (30/10/2026)

Audit en lecture seule : aucun code, aucun prix Stripe n'a été modifié. Seul ce fichier a été créé.

## Tarifs voulus

| Formule | Prix / mois | Marque blanche |
|---|---|---|
| Gratuit | 0 € | non |
| Solo | 2,99 € | option +1,99 € (total 4,98 €) |
| Pro | 9,99 € | incluse |
| Illimité | 29,99 € | incluse |
| Entreprise | sur devis | incluse |

## Ce qui est déjà cohérent

- Solo 2,99 / Pro 9,99 / Illimité 29,99 : identiques dans `plans.ts`, `.env.example`, `MISE-EN-LIGNE.md`, `LIMITES-SERVEUR.md`, README et test `legal-pages.test.ts`.
- Les cartes d'offres (`OfferCards.tsx`), le dialogue de paiement (`CheckoutDialog.tsx`), la CGV (`cgv/page.tsx`), l'accueil et les paramètres lisent les prix dans `PLANS` : un seul endroit à changer.
- La règle de marque blanche du code (`whiteLabelAllowed` dans `plans.ts`, `my_white_label_allowed()` dans `0004_limites_serveur.sql`) correspond déjà au voulu : Pro et Illimité inclus, Solo seulement avec l'option, Gratuit jamais.
- Il n'y a pas de page « tarifs » dédiée : les offres s'affichent sur l'accueil (`app/page.tsx`, Solo/Pro/Illimité sans la carte Gratuit) et dans Paramètres, section Formule (4 cartes).
- `PricingTab.tsx` ne concerne pas les tarifs de Décollage : c'est l'outil de prix du SaaS de l'utilisateur. Rien à corriger.

## Tableau des écarts

| # | Fichier | Affiché / appliqué | Voulu | Gravité |
|---|---|---|---|---|
| 1 | `docs/MISE-EN-LIGNE.md` (tableau, ligne Gratuit) | Gratuit : « 1 (aperçu) » projet | Code = 0 : à trancher (voir « Décision Gratuit ») | Moyenne |
| 1b | `src/lib/plans.ts` (gratuit.maxProjets = 0), `0004_limites_serveur.sql` (else 0), `cgv/page.tsx` (« pas de projet enregistré »), `LIMITES-SERVEUR.md` (0), `OfferCards.tsx` (« Générer et garder ton SaaS » barré) | Gratuit : 0 projet, 0 site | Cohérent entre eux, mais contredit le doc ci-dessus | Moyenne |
| 2 | `src/lib/plans.ts` | Pas de formule Entreprise (type `Plan` = gratuit/solo/pro/illimite) | Entreprise sur devis, marque blanche incluse | Moyenne |
| 3 | `supabase/0001_schema.sql` (contrainte `profiles.plan`), `0002_conformite.sql` (`formule`) | Contrainte limitée à 4 valeurs | Pas d'ajout nécessaire si Entreprise reste hors ligne (traitée à la main) | Basse |
| 4 | Accueil `app/page.tsx` et Paramètres (`OfferCards`) | Aucune carte Entreprise, aucune mention de l'option +1,99 € | Carte « Entreprise : sur devis » (bouton Contact) ; mention « Marque blanche : +1,99 € » sur Solo, « incluse » sur Pro/Illimité/Entreprise | Moyenne |
| 5 | `OfferCards.tsx` (liste de fonctions) | Ne parle jamais de la marque blanche | Ligne marque blanche par formule | Moyenne |
| 6 | `app/api/stripe/checkout/route.ts` | Un seul `line_items` (le prix de la formule) ; `isPaidPlan` n'accepte que solo/pro/illimite | Solo + option = 2 lignes (2,99 + 1,99 = 4,98 €) | Haute |
| 7 | `src/lib/env.ts` (`stripePrices`, `isPaymentConfigured`), `.env.example` | 3 variables de prix | Une 4e variable pour le prix de l'option (ex. `STRIPE_PRICE_MARQUE_BLANCHE`) | Haute |
| 8 | `app/api/stripe/webhook/route.ts` + `lib/billing.ts` | Lit `sub.items.data[0]` seulement ; un prix inconnu donne **Illimité** | Avec l'option sur le même abonnement, l'élément n°0 peut être l'option : un abonné Solo+option passerait Illimité (29,99 € d'accès pour 4,98 €) | **Critique** si l'option est ajoutée sans correction |
| 9 | Webhook | N'écrit jamais `brand_entitlements.enabled` | L'option payée doit activer le droit ; sa résiliation doit le retirer. Aujourd'hui : activation manuelle par SQL (`LIMITES-SERVEUR.md`) | Haute |
| 10 | `docs/MARQUE-BLANCHE.md` (« n'est dans aucune formule »), `app/parametres/marque-blanche/page.tsx` ligne 169 (« n'est pas comprise dans les formules : activée à la demande, par nous ») | Texte faux pour Pro/Illimité (inclus) et pour Solo (option payante) | Texte aligné sur la règle voulue | Moyenne |
| 11 | `cgv/page.tsx` §3 | « Toutes les formules payantes ont toutes les fonctions ; seules les quantités changent » | Faux dès que la marque blanche est une option sur Solo. Prix de l'option et Entreprise absents de la CGV | Haute (juridique) |
| 12 | `cgv/page.tsx` §3 | « illimités » (projets, sites) pour Illimité, sans nuance | Ajouter usage raisonnable (stockage, trafic, publication) | Moyenne |
| 13 | `OfferCards.tsx` (« SaaS illimités », « sites illimités »), `nouveau/page.tsx` (« · illimité ») | Promesse sans plafond | Même nuance, par renvoi à la CGV | Moyenne |
| 14 | `CheckoutDialog.tsx` | Affiche un seul prix (`prixCourt(plan)`) ; texte d'engagement sur un seul montant | Total 4,98 € avec option, détail 2,99 + 1,99 | Haute (obligation d'information avant paiement) |
| 15 | `docs/MISE-EN-LIGNE.md` §2 | « trois produits » ; portail : « ajoute les trois produits » | Quatrième prix (option) à créer et à déclarer au portail | Haute |
| 16 | `LIMITES-SERVEUR.md` | Décrit déjà l'écart (Entreprise absente, option manuelle) | À mettre à jour après correction | Basse |

## Décision Gratuit : 0 ou 1 projet ?

- Dans le code, Gratuit = 0 projet enregistré, 0 site : on décrit l'idée et on essaie les 10 designs en aperçu (accroche de `plans.ts`, FAQ de l'accueil « Pour générer ton SaaS, le garder… il faut une offre payante »).
- Seul `MISE-EN-LIGNE.md` dit « 1 (aperçu) ».
- Recommandation : garder 0 (c'est ce que le serveur applique et ce que la CGV promet) et corriger le doc en « 0 (aperçu seulement) ». Passer à 1 projet gratuit serait un changement de modèle commercial : il toucherait `plans.ts`, `0004_limites_serveur.sql`, la CGV, `OfferCards.tsx` et la FAQ. À décider par le patron, pas à déduire.

## Risques de facturation (option marque blanche)

1. **Double facturation.** Si l'option est ajoutée sur un abonnement Pro ou Illimité (qui l'inclut déjà), le client paie 1,99 € pour rien. Il faut : (a) ne proposer l'option qu'aux abonnés Solo ; (b) quand un Solo+option passe à Pro/Illimité, retirer la ligne option dans la même opération.
2. **Deux abonnements séparés.** Si l'option est un abonnement à part, le webhook ne gère qu'un `stripe_subscription_id` par profil et `checkout` refuse déjà un second achat (`plan !== gratuit`). Choisir **un seul abonnement à deux lignes** (formule + option) : une facture, un renouvellement, un prorata.
3. **Prix inconnu = Illimité** (`billing.ts`). Cette protection sert aux anciens tarifs. Avec l'option, le webhook doit parcourir **tous** les éléments : le prix de formule détermine le plan, le prix de l'option active `brand_entitlements`, et l'option seule ne doit jamais donner Illimité.
4. **Option sans formule Solo.** Option sur Pro/Illimité : inutile (déjà incluse), à ignorer côté droit et à signaler au support.
5. **Résiliation.** Si l'option est retirée, `brand_entitlements.enabled` repasse à false. `syncSitesWithPlan` existe pour les sites ; prévoir l'équivalent pour la marque blanche.

## Ce qu'il faut créer côté Stripe (par le patron, rien n'a été touché)

- Un nouveau produit « Décollage Marque blanche (option Solo) » avec un **prix récurrent mensuel de 1,99 € TTC/HT selon votre réglage actuel** (même choix que les trois prix existants). Noter son identifiant `price_…`.
- Ne PAS modifier les trois prix existants (Solo, Pro, Illimité) : des abonnés actifs y sont rattachés. Un prix Stripe ne se modifie pas ; changer un montant = créer un nouveau prix.
- Portail client (Paramètres → Portail client → Abonnements) : ajouter le nouveau produit pour que l'abonné puisse ajouter ou retirer l'option, et vérifier que le changement Solo → Pro/Illimité reste autorisé.
- Entreprise : pas de produit Stripe pour l'instant (devis, facture ou abonnement créé à la main).
- Ajouter la variable correspondante dans Vercel et dans `.env.local` une fois le code prêt (jamais avant : le paiement s'active quand toutes les variables sont présentes).

## Changer l'abonnement sans casser les abonnés actifs

- Ne jamais renommer ni remplacer les trois `STRIPE_PRICE_*` existants : `planFromSubscription` retrouve la formule par ces identifiants.
- Ajouter, ne pas remplacer : la nouvelle variable de l'option est **facultative** dans `isPaymentConfigured` (sinon le paiement se coupe en production tant qu'elle n'est pas renseignée).
- Corriger le webhook avant toute vente de l'option, et le tester sur un abonné Solo existant : sans l'option, son comportement doit rester identique (Solo, pas d'option).
- Les abonnés actuels restent au tarif actuel (la marque blanche n'était incluse nulle part avant : pas de changement de prix pour eux). Les abonnés Pro/Illimité obtiennent la marque blanche sans surcoût ; c'est la règle déjà codée.
- Avant de modifier la CGV (option, Entreprise, usage raisonnable), la versionner (le checkout enregistre `cgvVersion`) : les abonnés existants doivent être informés d'un changement de conditions.
- Tester en mode test Stripe : Solo seul, Solo + option, ajout puis retrait de l'option, Solo+option → Pro, résiliation.

## Promesses « illimité » à nuancer

- Textes concernés : `OfferCards.tsx` (« SaaS illimités », « sites illimités »), `cgv/page.tsx` §3 (« illimités »), `nouveau/page.tsx` (« illimité »).
- Aucune limite de stockage ni de trafic n'est définie dans le code (`PlanDef` n'a que projets et sites). Ne pas inventer de chiffre : décider d'abord d'un plafond réel avec les coûts Supabase/Vercel.
- Formulation proposée pour la CGV : « Illimité signifie sans plafond sur le nombre de projets et de sites, sous réserve d'un usage raisonnable (stockage, trafic, envoi d'e-mails) ; en cas d'usage anormal, nous te contactons avant toute limitation. »
- Ajouter dans la carte : « Usage raisonnable, voir les conditions » (lien vers `/cgv`).

## Plan de correction priorisé

**P0 (avant de vendre l'option ou d'afficher Entreprise)**
1. Décider Gratuit 0 ou 1 ; aligner `MISE-EN-LIGNE.md` (ou le code si 1).
2. Webhook et `billing.ts` : lire tous les éléments de l'abonnement, séparer prix de formule et prix de l'option, ne jamais retomber sur Illimité à cause de l'option ; activer/désactiver `brand_entitlements`.
3. `env.ts` et `.env.example` : variable facultative du prix de l'option.

**P1 (ce que voit l'acheteur)**
4. `checkout/route.ts` : paramètre `marqueBlanche` accepté seulement pour Solo ; deux lignes ; prix toujours choisi côté serveur.
5. `CheckoutDialog.tsx` : case « Marque blanche +1,99 € » (Solo uniquement), total 4,98 €, texte d'engagement au bon montant.
6. CGV §3 : option, Entreprise sur devis, retrait de « toutes les fonctions », usage raisonnable ; nouvelle version de la CGV.
7. Parcours de passage Solo+option vers Pro/Illimité (retrait de la ligne option, via portail ou route dédiée).

**P2 (affichage et documentation)**
8. `plans.ts` : champ d'affichage pour l'option (prix 1,99) et Entreprise (sans prix, hors `PAID_PLANS`) ; `OfferCards` : carte Entreprise, ligne marque blanche, mention usage raisonnable.
9. Textes de `app/parametres/marque-blanche/page.tsx` et `docs/MARQUE-BLANCHE.md`.
10. `MISE-EN-LIGNE.md` (4e prix, portail), `LIMITES-SERVEUR.md`, README, tests (`legal-pages.test.ts`).

## Actions pour le patron

1. Trancher : Gratuit = 0 projet (recommandé) ou 1.
2. Créer dans Stripe le prix récurrent mensuel de 1,99 € (option marque blanche) et me transmettre son `price_…` (ou le mettre directement dans les variables Vercel).
3. L'ajouter au portail client Stripe.
4. Décider du contenu d'Entreprise (ce qui est inclus, adresse de contact pour les devis) et si elle apparaît dans les paramètres.
5. Décider des plafonds d'usage raisonnable (stockage, trafic) à écrire dans la CGV, après vérification des coûts réels.
6. Faire relire la CGV modifiée (changement de conditions pour les abonnés actifs).
7. Valider le choix « un seul abonnement à deux lignes » pour l'option.
8. Tester en mode test Stripe avant de passer en production.
