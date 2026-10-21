# Décollage

Constructeur guidé de micro-SaaS, **sans IA et sans clé API**. Tout repose sur des modèles prédéfinis, des briques préprogrammées, des règles déterministes et des contenus rédigés à l'avance.

## Lancer le projet

```bash
npm install
npm run dev        # http://localhost:3000
npm run check      # types + lint + tests
npm run build
```

Aucune variable d'environnement n'est nécessaire.

## Organisation

| Dossier | Contenu |
|---|---|
| `src/data/` | Catalogue de 216 idées, 16 modèles, 17 briques, feuille de route et actions de lancement |
| `src/lib/` | Logique pure et testée : dépendances des briques, validation, prix, landing, prototype, export, ZIP |
| `src/components/builder/` | Constructeur (trois zones, historique, aperçu en direct) |
| `src/components/project/` | Onglets du projet |
| `src/lib/plans.ts` | **Tous** les prix et limites des formules (Gratuit, Solo 2,99 €, Pro 9,99 €, Illimité 29,99 €) |
| `src/lib/codegen/` | Générateur de projets Next.js : kit de composants écrit à l'avance (`kit-*.ts`) + configuration du projet |
| `docs/FORMAT.md` | Format d'export JSON |

## Fonctions en ligne (facultatives)

Ces fonctions s'activent dès que les variables de `.env.example` sont renseignées : comptes par lien magique, projets synchronisés, publication des SaaS sur `/s/<adresse>` avec une vraie liste d'attente, et abonnements Solo / Pro / Illimité via Stripe. Installation pas à pas : **`docs/MISE-EN-LIGNE.md`**. Schéma de la base : `supabase/0001_schema.sql`.

## Ce qui est réel, et ce qui ne l'est pas

- **Persistance :** les projets sont gardés dans le navigateur (`localStorage`). Avec Supabase configuré et un compte connecté, ils sont aussi copiés en ligne et synchronisés entre appareils. Sans Supabase, il faut passer par l'export et l'import JSON.
- **Paiement :** tant que Stripe n'est pas configuré, chaque formule s'active localement depuis Paramètres, pour tester.
- **SaaS générés :**
  - niveau 1 : application cliquable dans Décollage. Ajouts, modifications et suppressions sont enregistrés dans le projet (messages entre l'iframe isolé et la page, vérifiés par `src/lib/appdata.ts`), avec import et export CSV ;
  - niveau 2 : export d'un **projet Next.js exécutable** (onglet Export) et de fichiers réels (landing HTML/CSS, `prototype.html` autonome, configuration JSON). Les données du projet généré sont gardées dans le navigateur (`localStorage`) ;
  - niveau 3 : application en ligne multi-utilisateurs (comptes, base partagée, paiements). Ce niveau n'est pas généré.
- **Tester le générateur pour de vrai :** `GEN_OUT=<dossier> npx vitest run src/lib/codegen` écrit trois projets de référence (tâches, clients, revenus) ; dans chacun, `npm install` puis `npx next build`.
