# Limites de formule : ce que le serveur applique

Source des valeurs : `src/lib/plans.ts` (miroir SQL : `supabase/0004_limites_serveur.sql`, un test compare les deux).
Migration à exécuter À LA MAIN (Supabase, SQL Editor) : `supabase/0004_limites_serveur.sql`. Rejouable, ne supprime rien.

## Droits par formule

| | Gratuit | Solo (2,99 €) | Pro (9,99 €) | Illimité (29,99 €) |
|---|---|---|---|---|
| Projets (maxProjets) | 0 | 1 | 5 | illimité |
| Sites publiés (maxSites) | 0 | 1 | 5 | illimité |
| Modèles premium, export, duplication, personnalisation avancée, plans détaillés | non | oui | oui | oui |
| Marque blanche | non | option (+1,99 €/mois) | incluse | incluse |

« Entreprise » : n'existe ni dans `plans.ts` ni dans la contrainte `profiles.plan` (gratuit, solo, pro, illimite). Rien n'est appliqué pour elle. L'option marque blanche Solo à 1,99 € n'existe pas non plus dans le code de facturation : elle correspond aujourd'hui à une activation manuelle (`brand_entitlements.enabled = true`).

## Appliqué côté serveur (testé dans `src/lib/limites-serveur.test.ts`, `src/app/api/brand/route.test.ts`)

- **Nombre de projets** : trigger `projects_enforce_limit` (avant insertion). Lit la formule dans `profiles` (jamais envoyée par le navigateur). Seules les créations de nouvelles lignes sont bloquées ; lire, modifier, synchroniser (upsert) et supprimer un projet existant reste permis, même au-delà de la limite après une résiliation. Le serveur (service_role) et l'admin SQL ne sont pas bloqués. Verrou par utilisateur contre les insertions simultanées.
- **Duplication** : une copie est une insertion, donc comptée par la limite ci-dessus (Gratuit : bloqué car 0 projet ; Solo : bloqué au-delà de 1).
- **Sites publiés** : déjà serveur (`/api/sites`, migration 0002, webhook Stripe).
- **Formule** : `profiles.plan`, `stripe_*`, `subscription_status` non modifiables par le navigateur (update limité à `favorites` ; insert/delete retirés en 0004). Testé.
- **Isolation** : RLS sur `projects`, `profiles`, `brand_*` ; lecture/écriture du projet d'un autre refusée. Testé.
- **Marque blanche** : `/api/brand` exige maintenant la formule en plus du droit : Gratuit jamais (même avec un droit activé), Pro et Illimité inclus, Solo seulement si `brand_entitlements.enabled`. `WHITE_LABEL_USER_IDS` reste une dérogation de test. Le droit n'est pas écrivable depuis le navigateur. Fonction SQL équivalente : `my_white_label_allowed()`.
- **Droits premium en SQL** : `my_plan()`, `my_plan_allows('exportFichiers')`, etc., disponibles pour de futures routes serveur.

## Reste côté navigateur seulement

- **Export de fichiers/ZIP** : généré dans le navigateur à partir des données du projet (`export.ts`, `zip.ts`). Aucun appel serveur à bloquer : un utilisateur qui a déjà un projet peut contourner l'interface. Ne devient protégeable que si la génération passe par une route API qui lit `my_plan_allows('exportFichiers')`. (`/api/account/export` est l'export RGPD des données du compte, ouvert à tous : normal.)
- **Modèles premium, personnalisation avancée, plans détaillés** : contenu fourni avec l'application et utilisé dans le navigateur ; seule la création de projet (comptée) est protégée.
- **Mode sans cloud** : la formule se choisit localement pour tester ; aucune limite réelle.

## Ambiguïté à trancher (non modifiée)

Gratuit : `docs/MISE-EN-LIGNE.md` annonce « 1 (aperçu) » projet, `plans.ts` donne `maxProjets: 0`. Comportement conservé : 0 (le trigger refuse toute création Gratuit, comme l'interface). Si le Gratuit doit avoir 1 projet, changer `maxProjets` dans `plans.ts` ET `plan_max_projects` dans une migration 0005 (le test de cohérence échoue tant que les deux diffèrent).
