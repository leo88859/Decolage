# Marque blanche : architecture, activation, limites

Statut : **fondations**. La marque d'un client s'enregistre et se prévisualise ; elle n'est pas encore appliquée aux sites publiés, aux exports ni à un domaine personnalisé (voir « Limites »).

## Vue d'ensemble

| Élément | Fichier |
|---|---|
| Migration SQL (jamais exécutée automatiquement) | `supabase/0003_marque_blanche.sql` |
| Types, validation, contraste, variables CSS, hôtes, droit | `src/lib/brand/` |
| Logique d'API partagée (serveur) | `src/lib/brand/api.ts` |
| API | `src/app/api/brand/route.ts` (GET, PUT, DELETE), `src/app/api/brand/restore/route.ts` (POST) |
| Écran | `src/app/parametres/marque-blanche/page.tsx`, aperçu `src/components/brand/BrandPreview.tsx` |
| Variable d'environnement (facultative) | `WHITE_LABEL_USER_IDS` (voir `.env.example`) |

## Le droit d'accès

La marque blanche n'est dans aucune formule. Elle est activée **par un contrôle explicite** :

1. table `brand_entitlements (user_id, enabled, enabled_at, note)` : lisible par son propriétaire, **non modifiable depuis le navigateur** (droits retirés aux rôles `anon` et `authenticated`) ;
2. en plus, pour les tests : variable serveur `WHITE_LABEL_USER_IDS` (UUID séparés par des virgules). Jamais préfixée `NEXT_PUBLIC_`.

Le droit est vérifié côté serveur **à chaque appel** de l'API. Sans droit : 403, aucune écriture, aucune donnée renvoyée, et l'écran affiche « Fonction non activée sur ton compte ».

### Activer / désactiver un client (SQL à exécuter à la main)

Dans Supabase, SQL Editor (l'identifiant du client est dans Authentication, Users) :

```sql
insert into public.brand_entitlements (user_id, enabled, note)
values ('UUID-DU-CLIENT', true, 'Accord du JJ/MM/AAAA')
on conflict (user_id) do update set enabled = true, note = excluded.note;
```

Désactivation (résiliation) :

```sql
update public.brand_entitlements set enabled = false where user_id = 'UUID-DU-CLIENT';
```

La marque déjà enregistrée reste en base mais devient inaccessible via l'API tant que le droit est désactivé.

## Données et sécurité

- `brand_configs` : une ligne par utilisateur ; contraintes SQL sur les longueurs, les couleurs `#rrggbb` en minuscules, les formats d'image et la taille ; RLS : lecture par le propriétaire uniquement.
- **Aucune écriture depuis le navigateur** : l'API écrit avec la clé `service_role` (déjà requise pour le webhook et la suppression de compte) après avoir vérifié session, droit et Origin. Les colonnes s'appellent `color_primary`, etc., car `primary` est un mot réservé de PostgreSQL.
- `user_id` est toujours celui de la session ; le corps de requête ne peut jamais en désigner un autre.
- Contrôle de l'en-tête `Origin` sur PUT, DELETE et POST (CSRF) ; corps limité à 450 000 octets ; type JSON obligatoire.
- Réponse « ok » seulement après écriture **et** relecture concordante.
- Historique minimal : chaque enregistrement copie l'ancien état dans `previous` (un seul niveau). `POST /api/brand/restore` revient à cet état (et l'état remplacé devient le nouveau `previous`). La réinitialisation (DELETE) remet les valeurs par défaut sans effacer la ligne : elle est annulable de la même façon. L'instantané est revalidé avant restauration.
- Logo : PNG, JPEG ou WebP uniquement, **jamais SVG**, 200 Ko maximum décodés, octets magiques vérifiés côté serveur, stocké en data URL dans la base, affiché uniquement via `<img>`. Favicon : PNG, 50 Ko.
- `brandToCssVars()` n'écrit que des couleurs `#rrggbb` revalidées ; toute autre valeur est remplacée par la valeur par défaut. Le nom et les images n'y figurent jamais. Il n'existe pas de CSS libre.
- Contraste : avertissements non bloquants (couleur principale à 4,5:1 avec du texte blanc ou la couleur du texte ; texte sur fond), calculés avec `src/lib/a11y/contrast.ts`.

## Limites actuelles (à dire honnêtement aux clients)

- **Non appliquée** : aux sites publiés (`/s/<slug>`, qui ont leur propre nom, logo et couleurs par projet), aux exports ZIP, à l'interface de Décollage, aux e-mails, à la facturation Stripe. Ces pages ne contiennent d'ailleurs aucune marque Décollage à retirer, sauf la ligne « Généré avec Décollage » du README d'un export (`src/lib/export.ts`), non modifiée.
- **Pas de domaine personnalisé** : voir `docs/DOMAINES-PERSONNALISES.md`. `resolveBrandFromHost()` existe et est testée mais n'est pas branchée dans `proxy.ts`.
- Logos stockés en base (data URL) : acceptable pour quelques clients ; Supabase Storage est l'évolution prévue (bucket privé, URL signée ou publique en lecture, mêmes contrôles d'octets).
- Un seul niveau d'historique ; une marque par compte.
- Les contrôles d'octets vérifient la signature du fichier, pas l'intégrité complète de l'image (pas de réencodage). L'affichage en `<img>` neutralise les scripts éventuels.
- Pas de limitation de débit sur l'API (comme les autres routes du projet).
- Les tests PGlite vérifient les règles SQL dans un PostgreSQL simulé ; ils ne remplacent pas un essai sur le vrai projet Supabase.

## Tests

`src/lib/brand/brand.test.ts` (validation, XSS, CSS, contraste, hôtes, liste d'ID), `src/app/api/brand/route.test.ts` (401, 403, Origin, isolation, relecture), `src/lib/brand/brand-rls.test.ts` (migration réelle dans PGlite avec deux comptes). Lancer `npm run check`.
