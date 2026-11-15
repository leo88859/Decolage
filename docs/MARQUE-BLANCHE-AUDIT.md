# Marque blanche : audit et système central (étape 1, phase 1)

## Règle du droit (centralisée dans `src/lib/plans.ts` > `whiteLabelAllowed`, appelée par `src/lib/brand/decision.ts`)

| Formule | Option 4,99 EUR | Marque blanche |
|---|---|---|
| Gratuit | - | Non |
| Solo | non | Non |
| Solo | oui | Oui |
| Pro | incluse | Oui |
| Illimité | incluse | Oui |

Les prix ne changent pas. Toute valeur inconnue ou absente donne « non » (fail-closed).

## Ce qui existait (lecture / écriture / droit)

| Fonction | Fichier | Rôle |
|---|---|---|
| `authorize` | `src/lib/brand/api.ts` | Session, Origin, droit, à chaque appel de `/api/brand` et `/api/brand/restore` |
| `loadRow`, `persist`, `stateOf`, `rowToBrand` | idem | Lecture et écriture de `brand_configs` (user_id toujours pris de la session, version optimiste, relecture de confirmation) |
| `decideWhiteLabel` | `decision.ts` | Droit pur (formule + option) |
| `marqueBlancheBoutique` | `public.ts` | Droit pour la mention « Créé avec Décollage » des boutiques publiées (clé service) |
| `validateBrand/Name/Color/Logo/Favicon` | `validate.ts` | Validation stricte (hex `#rrggbb`, PNG/JPEG/WebP par octets magiques, 200 Ko logo, 50 Ko favicon, pas de SVG) |
| `brandToCssVars` | `css.ts` | Seules des couleurs revalidées sont écrites en CSS |
| `isAllowListed` | `access.ts` | Liste d'identifiants `WHITE_LABEL_USER_IDS` (variable serveur, tests) |
| Page `src/app/parametres/marque-blanche/page.tsx` | | Appelle `/api/brand` ; ne décide rien |

Tables : `brand_configs` (RLS : chaque compte ne lit que sa ligne, écriture réservée au serveur), `brand_entitlements` (lecture de sa ligne seulement), toutes deux déjà couvertes par `brand-rls.test.ts` (PGlite).

## Vérifications

- Sauvegarde : écriture par la clé service après contrôle du droit, relecture avant « ok ». Conforme.
- Perte du droit : aucune suppression nulle part (ni webhook ni routes) ; les lignes `brand_configs` restent. Conforme.
- Isolation : `user_id` vient de la session, jamais du corps ; RLS + tests existants à deux comptes. Conforme.
- Droit lu depuis le navigateur ou localStorage : aucun cas trouvé. La page n'envoie aucun droit ; les `localStorage` du projet (store, panier, consentement) ne concernent pas la marque blanche. L'état `entitled: true` côté page vient uniquement de la réponse serveur.
- Synchronisation locale/Supabase : la marque n'existe pas en local (uniquement en base) ; pas de double source.

## Incohérences trouvées et corrigées

1. Le droit était recalculé à deux endroits (`authorize` et `marqueBlancheBoutique`) avec deux séquences de lecture différentes. Les deux passent maintenant par `readEntitlement` (`effective.ts`).
2. Aucune fonction ne renvoyait l'identité « effective » : une ligne corrompue en base (couleur ou logo invalide écrit hors API) aurait été renvoyée telle quelle. `getEffectiveBrand` revalide chaque champ à la lecture, avec valeurs de remplacement.

## Système central (`src/lib/brand/effective.ts`)

- `getEffectiveBrand(supabase, userId)` : lit formule, option et configuration côté serveur ; renvoie `{ entitled, saved, brand, version, updatedAt }` ou `null` si une lecture échoue (l'appelant refuse). L'identité est renvoyée même sans droit : perdre le droit ne supprime rien, seul `entitled` change.
- `computeEffectiveBrand` (pur) et `sanitizeStoredBrand` : validation champ par champ ; nom vide ou balisé -> « Ma marque » ; couleur absente ou invalide -> couleur par défaut Décollage ; logo ou favicon invalide -> aucun.
- `readEntitlement` : droit seul, utilisé par `authorize` et `marqueBlancheBoutique`.
- `userId` doit venir de la session serveur ; la fonction n'accepte ni requête ni stockage navigateur.

## Logos, favicon, image de partage

- Logo : stockage conservé (data URL en base). Formats PNG, JPEG, WebP ; 200 Ko ; octets magiques contrôlés ; aucune URL externe, aucun SVG, aucun HTML.
- Favicon : déjà présent (PNG, 50 Ko, colonne `favicon_data`), non modifié.
- Image de partage social : non ajoutée. Elle exigerait une route publique servant l'image par domaine ou boutique (phase « domaine ») et une nouvelle colonne ; hors périmètre minimal de cette phase.

## Migration

Aucune migration nécessaire : tout le nécessaire existe (0003, 0004, 0006, 0007). Rien n'a été exécuté sur Supabase.

## Point d'attention (non modifié)

`WHITE_LABEL_USER_IDS` (liste d'identifiants serveur) accorde le droit sans lire la formule ; à garder vide en production.
