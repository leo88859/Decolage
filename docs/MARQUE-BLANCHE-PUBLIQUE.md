# Marque blanche des boutiques publiées

Ce qui est branché : la mention « Créé avec Décollage » du pied de page des boutiques `/b/<slug>` est masquée selon la formule du propriétaire et son option marque blanche.

## Règle

| Compte du propriétaire | Mention « Créé avec Décollage » |
|---|---|
| Découverte (`gratuit`) | affichée (jamais de marque blanche, et il ne publie pas) |
| Solo sans option, ou option désactivée (`enabled = false`) | affichée |
| Solo avec option (`brand_entitlements.enabled = true`) | masquée |
| Pro, Illimité | masquée, sans ligne `brand_entitlements` |
| Compte rétrogradé (Solo+ vers Découverte), ancien droit encore présent | affichée : `profiles.plan` fait foi |
| Erreur de lecture, clé serveur absente, profil introuvable, formule inconnue | affichée (fail-closed) |

## Comment ça marche

1. `src/lib/brand/decision.ts` : `decideWhiteLabel(plan, optionActive)` est l'unique source de vérité (elle appelle `whiteLabelAllowed`, inchangée). `/api/brand` (`src/lib/brand/api.ts`) et les boutiques l'utilisent toutes les deux.
2. `src/lib/brand/public.ts` : `marqueBlancheBoutique(slug)` lit en `service_role` (serveur seulement) `boutiques.proprietaire_id` (boutique publiée), puis `profiles.plan` et `brand_entitlements.enabled`, et renvoie un booléen. Toute erreur renvoie `false`.
3. `GET /api/boutique/catalogue/{slug}` ajoute ce booléen `marque_blanche` à sa réponse. Le `select` public des boutiques ne contient toujours pas `proprietaire_id`.
4. `src/app/b/[slug]/layout.tsx` n'affiche la mention que si `marque_blanche !== true`. Son `generateMetadata` met le titre des pages panier et suivi sous la forme « Panier · Nom de la boutique » au lieu de « Panier · Décollage » quand la marque blanche est active.

Aucune migration : lecture directe avec la clé `service_role` déjà requise (webhook Stripe, `/api/brand`). Pas de migration 0009.

## Ce qui reste visible (volontairement)

- Liens légaux et « Suivre ma commande » du commerçant : ce ne sont pas de la marque.
- La barre et le pied de page de Décollage sont déjà masqués par CSS sur toutes les pages `/b/**` pour tout le monde.
- Pas d'e-mail envoyé par la boutique : rien à traiter. La page de confirmation de commande n'affiche pas la marque.

## Sites publiés `/s/<slug>`

La page publiée ne contient aucune mention « Créé avec Décollage ». Seule la phrase RGPD de la liste d'attente renvoie vers la politique de confidentialité de Décollage : c'est une information légale (Décollage héberge le site), à ne pas masquer. Rien n'est donc branché ni nécessaire. Le README d'un export ZIP contient « Généré avec Décollage » : non traité, hors boutique.

## Mise en cache

- Le layout est `force-dynamic` et lit les droits à chaque requête : pas de cache serveur partagé. Le rendu se fait par slug, donc les droits ne sont jamais mélangés entre boutiques (testé).
- L'API catalogue garde `cache-control: public, max-age=15, stale-while-revalidate=60` : un changement de formule ou de droit y apparaît en 15 s à 75 s au plus. Dans la page HTML de la boutique, il est visible dès le rechargement suivant. Le délai réel dépend du moment où le webhook Stripe met `profiles.plan` à jour.

## Activer pour un compte Solo (SQL à exécuter à la main dans Supabase)

```sql
insert into public.brand_entitlements (user_id, enabled, note)
values ('UUID-DU-CLIENT', true, 'Option marque blanche, accord du JJ/MM/AAAA')
on conflict (user_id) do update set enabled = true, note = excluded.note;
```

Retirer : `update public.brand_entitlements set enabled = false where user_id = 'UUID-DU-CLIENT';`
Les droits Stripe (`source = 'stripe'`) sont gérés par le webhook : ne pas les modifier à la main.
La variable `WHITE_LABEL_USER_IDS` ne sert qu'à `/api/brand` (tests) : elle ne masque jamais la mention publique.

## Testé / non testé

- Testé (`src/app/api/boutique/marque-blanche-publique.test.ts`, `src/app/b/[slug]/layout.test.ts`) : les six formules/droits, rétrogradation, erreurs de lecture (3 tables) et clé absente, isolation entre deux propriétaires, réponse publique sans `proprietaire_id` ni formule, paramètres d'URL et en-têtes sans effet, équivalence `/api/brand` / boutique sur 10 cas, rendu du pied de page et des titres.
- Simulation seulement : la base est simulée en mémoire, pas un vrai Supabase. À vérifier en vrai (voir ci-dessous).
- Non testé : navigateur, cache CDN Vercel réel, domaine personnalisé (non branché).
- Non vendu : l'option Solo n'a pas de produit Stripe (`STRIPE_PRICE_BRAND`) ; seule l'activation manuelle fonctionne.

## Vérification réelle conseillée

1. Compte Solo avec une boutique publiée : ouvrir `/b/<slug>`, la mention est visible.
2. Exécuter le SQL ci-dessus, recharger : la mention disparaît et le titre de `/b/<slug>/panier` n'a plus « Décollage ».
3. Mettre `enabled = false` : la mention revient.
4. `curl https://<site>/api/boutique/catalogue/<slug>` : vérifier la présence de `marque_blanche` et l'absence de `proprietaire_id`.
