# Format d'export Décollage (version 2)

Tous les exports sont des fichiers JSON encodés en UTF-8. Deux enveloppes existent.

## Projet seul : `decollage-projet`

```json
{
  "format": "decollage-projet",
  "version": 2,
  "exportedAt": "2026-10-18T12:00:00.000Z",
  "project": { "...": "voir Project ci-dessous" }
}
```

## Toutes les données : `decollage-donnees`

```json
{
  "format": "decollage-donnees",
  "version": 2,
  "exportedAt": "…",
  "data": { "version": 2, "projects": [Project], "favorites": ["id-idee"], "plan": "gratuit" | "solo" | "pro" | "illimite" }
}
```

## Project

| Champ | Type | Description |
|---|---|---|
| `id` | string | Identifiant local (régénéré à l'import en cas de doublon) |
| `createdAt`, `updatedAt` | ISO 8601 | Dates de création et de dernière modification |
| `ideaId` | string \| null | Idée du catalogue d'origine (`src/data/ideas.ts`) |
| `config` | Config | Configuration du constructeur (voir ci-dessous) |
| `landing` | Landing | Mise en page, sections ordonnées, textes, visibilité |
| `validation` | Record<string, string> | Réponses au questionnaire ; les clés `check.*` sont les cases cochées |
| `roadmap` | Record<taskId, { status, notes, checks[] }> | État des tâches (`a-faire`, `en-cours`, `termine`) |
| `pricing` | Pricing | Modèle, offres et hypothèses du calculateur |
| `launch` | { date, items } | Date de lancement et état des actions |
| `metrics` | Metric[] | Relevés saisis : `date`, `visiteurs`, `inscrits`, `actifs`, `payants` |
| `activity` | { date, label }[] | Historique des 30 dernières actions |

## Config

| Champ | Description |
|---|---|
| `templateId`, `templateVersion` | Modèle de SaaS utilisé et sa version (`src/data/templates.ts`) |
| `nom`, `description`, `cible` | Identité du produit |
| `couleurs.primaire`, `couleurs.accent` | Couleurs `#RRGGBB` |
| `initiales`, `logo` | Initiales (1 à 3 caractères) ou image en data URL (300 Ko maximum) |
| `style` | `moderne`, `minimal` ou `audacieux` |
| `modules` | Briques actives (`src/data/modules.ts`), dépendances incluses |
| `reglages` | Réglages des briques (`auth.methode`, `abonnement.essai`…) |
| `roles` | Types d'utilisateurs |
| `pages` | Pages du modèle désactivées (`{ "pageId": false }`) |
| `revenu`, `prix` | `gratuit`, `abonnement`, `paiement-unique`, `freemium`, `commission` |
| `domaine` | Domaine souhaité (jamais réservé par Décollage) |

## Vérifications à l'import

Un fichier est refusé si :

- son format ou sa version n'est pas reconnu ;
- un projet référence un modèle ou une brique inconnus ;
- la configuration ne passe pas `validateConfig` : champs invalides, brique requise absente, dépendance manquante, briques incompatibles, ou modèle de revenus incompatible.
