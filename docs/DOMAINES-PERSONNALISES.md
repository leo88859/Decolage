# Domaines personnalisés : guide pour Léo (rien n'est opérationnel)

Ce document décrit une **architecture proposée**. Aucun routage par domaine n'est développé, aucun domaine n'est acheté, aucun service payant n'est activé. Source : synthèse de recherche du 29/10/2026 (documentation officielle Vercel et Next.js). Tout ce qui n'est pas cité ci-dessous est **à vérifier**.

## Ce qui existe dans le code

- `src/lib/brand/hosts.ts` : `normalizeHost()` et `resolveBrandFromHost(host, table)`. Fonction pure, testée (`brand.test.ts`). Elle ne renvoie une ligne que si le domaine est **vérifié et actif**.
- **Elle n'est PAS branchée dans `src/proxy.ts`.** Rien ne lit l'en-tête Host aujourd'hui.

## Décisions de Léo (avant tout développement)

1. **Vercel Pro.** Le plan Hobby est réservé à l'usage personnel non commercial (https://vercel.com/docs/limits/fair-use-guidelines) ; Décollage vend des abonnements, donc le plan Pro est à prévoir (20 $ par mois hors taxes d'après https://vercel.com/docs/plans/pro-plan, **à valider par Léo dans Settings, Billing**). C'est un service payant : décision de Léo.
2. Un **domaine de base** pour des sous-domaines de marque (ex. `*.exemple.fr`) : aucun achat n'a été fait.
3. Quels clients, quelle formule, qui paie quoi (voir `marque-blanche-offre.md` dans le dossier de mission).

## Architecture proposée, par étapes

**Étape 0 : prérequis** : Vercel Pro validé. Domaines par projet : 50 sur Hobby, illimités sur Pro (limite souple 100 000), sans coût par domaine (documentation Vercel). HTTPS Let's Encrypt automatique et gratuit.

**Étape 1 : sous-domaine de marque** (`client.exemple.fr`) : nécessite un domaine de base. Un certificat générique couvre un seul niveau et demande les serveurs de noms Vercel ou une délégation `_acme-challenge` (documentation Vercel).

**Étape 2 : domaines clients ajoutés à la main par Léo** : le client crée un enregistrement DNS ; Léo ajoute le domaine dans Vercel (Settings, Domains) et attend l'état « Valid ». Recommander un **sous-domaine** (`app.client.com`) plutôt que le domaine racine, pour ne pas toucher aux e-mails du client. DNS : domaine racine = enregistrement A, sous-domaine = CNAME, **valeurs exactes à copier depuis le tableau de bord Vercel** (ne pas les recopier d'ailleurs). Un enregistrement TXT `_vercel` n'est demandé que si le domaine est déjà utilisé ailleurs. Pièges connus : enregistrement CAA restrictif, proxy de type Cloudflare.

**Étape 3 : automatisation par l'API Vercel** (plus tard) : `POST /v10/projects/{id}/domains` (ajout, renvoie `verified` et `verification[]`), `POST /v9/projects/{id}/domains/{domain}/verify`, `DELETE /v9/projects/{id}/domains/{domain}`. Jeton Bearer **côté serveur uniquement**. Limites annoncées : 100 créations et 100 vérifications par minute.

**Étape 4 : routage** dans `src/proxy.ts` (Next.js 16 : `middleware` s'appelle `proxy`) : lire le Host, `resolveBrandFromHost(host, table)`, puis poser un en-tête interne ou réécrire. Règles : supprimer tout en-tête interne venant du client ; revérifier droit et propriété **dans chaque route** (le proxy ne suffit pas) ; ne jamais lire la table à chaque requête sans cache court.

## Table proposée (non créée)

```sql
create table public.brand_domains (
  host text primary key check (host = lower(host) and host ~ '^[a-z0-9.-]{3,253}$'),
  user_id uuid not null references auth.users (id) on delete cascade,
  verified boolean not null default false,
  verified_at timestamptz,
  active boolean not null default false,
  deactivated_at timestamptz,
  created_at timestamptz not null default now()
);
-- RLS : lecture par le propriétaire ; écritures par le serveur seulement (même schéma que 0003).
```

Règles : `active` ne passe à vrai que si `verified` est vrai (vérification Vercel, jamais une simple déclaration du client) ; **désactivation (`active=false`) et retrait du domaine chez Vercel à la résiliation ou à la désactivation du droit** ; contrôle périodique (par exemple hebdomadaire) que le DNS pointe toujours chez nous.

## Risques

- **Prise de contrôle de domaine** (domaine abandonné puis racheté par un tiers, enregistrement DNS qui pend) : désactiver à la résiliation, supprimer le domaine chez Vercel, contrôle périodique.
- **Cookies et sessions** : un domaine client ne doit pas partager les cookies de l'application. Garder l'authentification sur le domaine de Décollage ; contrôler Origin et CSRF ; envisager des cookies `__Host-`.
- **Contenu publié** : le problème de script stocké sur `/s/*` (audit de sécurité C-1) doit être corrigé avant d'exposer des domaines clients.
- **Revendication** : n'activer un domaine que si `verified === true`, jamais sur la foi du client.
- **E-mails du client** : ne jamais demander de modifier les enregistrements MX.

## Coûts (à valider par Léo)

Vercel Pro (voir plus haut), nom de domaine de base (annuel, variable selon l'extension), éventuel temps de support DNS. Rien de tout cela n'est engagé.

## Ce que ce document n'affirme pas

Aucun domaine n'est opérationnel, aucun test sur Vercel n'a été fait, les valeurs DNS et les limites sont celles de la documentation du 29/10/2026 et doivent être revérifiées avant mise en œuvre.
