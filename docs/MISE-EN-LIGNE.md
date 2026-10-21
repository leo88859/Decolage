# Mettre Décollage en ligne (pour l'administrateur)

Ce guide active les fonctions en ligne de Décollage : comptes, sauvegarde des projets, publication des SaaS, listes d'attente et abonnements.

| Formule | Prix | Projets | Sites en ligne |
|---|---|---|---|
| Gratuit | 0 € | 1 (aperçu) | 0 |
| Solo | 2,99 € / mois | 1 | 1 |
| Pro | 9,99 € / mois | 5 | 5 |
| Illimité | 29,99 € / mois | illimités | illimités |

Toutes les limites sont définies dans `src/lib/plans.ts`.

Sans ces étapes, le site fonctionne quand même, en mode local : les projets restent dans le navigateur, et chaque formule s'active en mode test.

> Pour les SaaS créés **par les utilisateurs**, chaque projet contient son propre guide, dans l'onglet « Mise en production ».

---

## 1. Supabase : base de données et comptes (20 min)

1. Crée un projet sur https://supabase.com/dashboard. Choisis une région en Europe et garde le mot de passe de la base.
2. Ouvre **SQL Editor → New query**, colle tout le fichier `supabase/0001_schema.sql`, puis clique sur **Run**.
3. Dans **Authentication → URL Configuration** :
   - Site URL : `http://localhost:3000` en local, puis l'adresse de production (ex. `https://decollage.fr`).
   - Redirect URLs : ajoute `http://localhost:3000/auth/callback` et `https://ton-domaine/auth/callback`.
4. Dans **Authentication → Sign In / Providers**, vérifie que le fournisseur **Email** est activé. La connexion se fait par lien magique, sans mot de passe.
5. Dans **Project Settings → API**, copie l'URL, la clé `anon` et la clé `service_role` dans `.env.local` (modèle : `.env.example`).
6. Avant le lancement public, configure un SMTP (par exemple Resend) dans **Authentication → Emails** : l'envoi intégré de Supabase est très limité.

Avec les deux premières variables seulement, les comptes, la synchronisation et la publication fonctionnent déjà.

## 2. Stripe : abonnements (30 min)

1. Sur https://dashboard.stripe.com, reste en **mode test**.
2. Dans **Catalogue de produits**, crée trois produits avec un prix récurrent mensuel :

   | Produit | Prix | Variable |
   |---|---|---|
   | Décollage Solo | 2,99 € / mois | `STRIPE_PRICE_SOLO` |
   | Décollage Pro | 9,99 € / mois | `STRIPE_PRICE_PRO` |
   | Décollage Illimité | 29,99 € / mois | `STRIPE_PRICE_ILLIMITE` |

   Copie l'identifiant `price_…` de chaque prix dans la variable correspondante.
3. Dans **Développeurs → Clés API**, copie la clé secrète dans `STRIPE_SECRET_KEY`.
4. Dans **Développeurs → Webhooks**, ajoute l'endpoint `https://ton-domaine/api/stripe/webhook` avec ces événements :
   - `checkout.session.completed`
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `customer.subscription.paused`
   - `customer.subscription.resumed`

   Copie la clé de signature dans `STRIPE_WEBHOOK_SECRET`.
5. En local, la Stripe CLI relaie les webhooks : `stripe listen --forward-to localhost:3000/api/stripe/webhook`. Elle affiche sa propre clé `whsec_…`, à utiliser en local.
6. Dans **Paramètres → Portail client**, active le portail : les abonnés pourront résilier et télécharger leurs factures. Dans la section **Abonnements** du portail, autorise le changement de formule et ajoute les trois produits : c'est là que les clients passent de Solo à Pro ou à Illimité, avec un prorata calculé par Stripe.
7. Teste avec la carte `4242 4242 4242 4242`.

Le paiement s'active quand **toutes** les variables sont présentes : les deux Supabase publiques, `SUPABASE_SERVICE_ROLE_KEY`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` et les trois `STRIPE_PRICE_…`.

La formule de chaque compte est déduite du prix de son abonnement. Un abonnement actif à un prix inconnu (un ancien tarif par exemple) donne Illimité, pour ne jamais retirer l'accès à un client qui paie.

## 3. Vercel : mise en ligne (15 min)

1. Envoie le dossier `decollage` sur un dépôt GitHub privé (le fichier `.env.local` est ignoré : il ne part pas).
2. Sur https://vercel.com/new, importe le dépôt.
3. Dans **Settings → Environment Variables**, ajoute toutes les variables de `.env.example`, avec `NEXT_PUBLIC_APP_URL=https://ton-domaine`.
4. Déploie, puis ajoute ton domaine dans **Settings → Domains**.
5. Mets à jour l'URL du site dans Supabase et l'endpoint du webhook dans Stripe avec le domaine final.

L'offre gratuite de Vercel est réservée aux projets non commerciaux : avec des abonnés payants, passe à l'offre Pro.

## 4. Avant d'ouvrir au public

- Pages légales de Décollage : mentions légales, confidentialité, CGU, et CGV pour les offres payantes.
- Stripe en mode réel :
  1. Active le compte (identité, compte bancaire).
  2. Recrée le produit et le webhook en mode réel.
  3. Remplace les clés dans Vercel.
- Teste les cas suivants :
  - deux comptes différents, pour vérifier qu'aucun ne voit les projets de l'autre ;
  - un paiement, puis une résiliation ;
  - une publication, une inscription sur le site publié, puis une dépublication.

## Où sont les données

| Table | Contenu | Accès |
|---|---|---|
| `profiles` | formule, favoris, client Stripe | le propriétaire lit ; seuls les favoris sont modifiables par lui |
| `projects` | copie des projets (JSON) | le propriétaire uniquement |
| `sites` | données des sites publiés (jamais de HTML) | lecture publique, écriture par le propriétaire |
| `waitlist` | emails des inscrits | inscription publique, lecture et suppression par le propriétaire du site |
