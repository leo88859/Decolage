# Limites de formule : ce que le serveur applique

Source des valeurs : `src/lib/plans.ts` (miroir SQL : `supabase/0004_limites_serveur.sql`, `0005_boutique.sql`, puis `0006_regle_gratuit.sql` qui a le dernier mot ; des tests comparent le SQL à `plans.ts`).

**Migrations à exécuter À LA MAIN (Supabase, SQL Editor), dans cet ordre : `0004` puis `0005` puis `0006`.** Chacune est rejouable et ne supprime rien. `0006` ne modifie pas les fichiers 0004 et 0005 : elle remplace des fonctions, des déclencheurs et des politiques par de nouvelles versions. Tant que `0006` n'est pas exécutée, la règle « Gratuit = 1 projet » et les gardes décrites plus bas côté base ne sont pas actives (les gardes de l'API, elles, le sont dès le déploiement du code).

## Droits par formule (règle du patron, octobre 2026)

| | Gratuit | Solo (2,99 €) | Pro (9,99 €) | Illimité (29,99 €) | Entreprise |
|---|---|---|---|---|---|
| Projets (maxProjets) | **1** | 1 | 5 | illimité | sur devis, rien d'activé |
| Créer, modifier, enregistrer, retrouver, prévisualiser | oui | oui | oui | oui | |
| **Publier sur Internet** (sites ET boutiques) | **non** | oui | oui | oui | |
| Sites + boutiques publiés en même temps (maxSites) | 0 | 1 | 5 | illimité | |
| Modèles premium, export, duplication, personnalisation avancée, plans détaillés | non | oui | oui | oui | |
| Marque blanche | non | option (+1,99 €/mois, 4,98 € au total) | incluse | incluse | |

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
| Liste d'attente d'un site | | politique d'inscription : le site doit être non suspendu ET lisible par le public (donc propriétaire autorisé) |

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
