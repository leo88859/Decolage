# Sécurité des fonctions payantes (étape 3)

Objectif : une fonctionnalité payante ne doit plus pouvoir être débloquée en modifiant le `localStorage`.
Les formules et les prix restent dans `src/lib/plans.ts` (rien n'est redéfini ici).

## Ce qui est réellement protégé par le serveur

`POST /api/export` (`src/app/api/export/route.ts`) génère les archives **côté serveur** :

| Contrôle | Détail |
|---|---|
| Session | `getUser()` (Supabase) ; sinon 401 |
| Formule | lue dans `profiles.plan` en base, jamais dans la requête ni le `localStorage` ; profil absent = Découverte ; base en erreur = 503 |
| Droits | `can(plan, "exportFichiers")` puis modèles premium (`can(plan, "modelesPremium")`) ; sinon 403 |
| Schéma | corps strict `{ kind: "next" \| "archive" \| "landing", project }` ; toute autre clé (ex. `plan`) est refusée (400) ; id, nom (1 à 80 car.), modèle, briques, configuration vérifiés (`checkProject`) |
| Taille | 2 Mo au plus (`EXPORT_BODY_MAX_BYTES`), contrôlée sur `Content-Length` puis sur les octets réellement lus (413) |
| Origine | `originOk(req, { referer: false })` : même origine, `NEXT_PUBLIC_APP_URL` ou `ALLOWED_ORIGINS` ; sinon 403 |
| Débit | par compte : 10 / minute et 30 / heure en mémoire (par instance) ; avec Supabase, en plus via la fonction existante `limite_debit` (migration 0007, déjà en place, aucune nouvelle migration) : 30 / heure par compte et 60 / heure par IP |
| Réponse | `application/zip`, `Content-Disposition: attachment`, `Cache-Control: no-store`, `X-Content-Type-Options: nosniff` |

Séparation du code : `src/lib/codegen/index.ts` et tous les `kit-*.ts` commencent par `import "server-only"` (paquet déjà présent dans `package.json`, aucune installation). Le plan de génération (liste des pages, affichée dans l'interface) a été déplacé dans `src/lib/codegen/plan.ts`, sans code payant. Un test (`export-route.test.ts`) vérifie qu'aucun fichier `"use client"` n'importe directement un module `server-only`, et que `next build` refuse de toute façon un tel import.

## Mode local (sans Supabase)

Aucun compte ni base : le serveur ne peut pas connaître de formule. En développement (`NODE_ENV` différent de `production`), la route fonctionne en **démonstration** (toutes les exports accordées, décision du serveur, pas du navigateur) pour que les démonstrations locales continuent de marcher. En production sans Supabase, la route répond 503 : aucune formule payante n'est jamais accordée sans base. Ce mode n'est **pas** une protection : il n'y a rien à protéger sur un poste local.

## Classification des fonctions (3.3)

| Fonction | Classe | Justification |
|---|---|---|
| Export du projet Next.js (.zip) | **Protection stricte serveur** | Le générateur est `server-only` et ne part plus dans le JavaScript du navigateur ; l'archive n'est produite que par la route, après lecture de la formule en base |
| Export de l'archive du prototype (index, style, prototype.html, JSON, README) | **Protection serveur de la livraison de l'archive ; contenu déjà visible dans l'aperçu** | Le ZIP est fourni par la route, mais les rendus (landing, prototype) restent dans le code navigateur pour l'aperçu : quelqu'un de technique peut reconstituer le même contenu sans payer |
| Export de la landing (HTML + CSS) | **Contenu déjà visible dans l'aperçu** (livraison via la route) | Même raison : l'aperçu affiche exactement ce HTML |
| Export « Configuration JSON seule » | Gratuit volontairement | Données de l'utilisateur, exportables dans toutes les formules |
| Modèles premium | **Protection serveur uniquement à l'export** | La route refuse un modèle premium sans droit. Mais la création du projet et l'aperçu se font dans le navigateur (`localStorage`) : le verrou de l'interface (`/nouveau`, générateur) est un confort, contournable |
| Personnalisation avancée (logo, thèmes, mises en page) | **Contenu déjà visible dans l'aperçu** | Réglage purement navigateur ; non protégé |
| Feuille de route détaillée | **Contenu déjà visible dans l'aperçu** | Calculée dans le navigateur à partir de données embarquées ; non protégée |
| Publication en ligne | **Protection stricte serveur** (déjà en place avant l'étape 3) | `/api/sites` lit `profiles.plan`, applique `maxSites`, et la base refuse aussi (migration 0006) |
| Duplication, nombre de projets | Interface seulement | Les projets sont dans le `localStorage` : non protégés par le serveur |

## Risques restants

- Les formules affichées par l'interface (`useData().plan`) viennent encore du `localStorage` en mode local, et d'une synchronisation avec `profiles` en mode connecté : elles ne servent qu'à griser des boutons. Un utilisateur qui modifie le `localStorage` voit des boutons actifs mais le serveur refuse l'export.
- Le code des rendus de landing et de prototype reste côté navigateur : l'archive du prototype et la landing ne sont pas « secrètes ».
- Limite de débit en mémoire : par instance seulement ; la limite en base la complète quand `limite_debit` est installée (si la fonction est absente, seule la mémoire s'applique).
- Tests : ce sont des simulations (faux Supabase). Une vérification sur un déploiement réel avec un vrai compte reste à faire.

## Variables d'environnement

`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` (limite en base), `NEXT_PUBLIC_APP_URL`, `ALLOWED_ORIGINS` (facultatif). Aucune nouvelle variable.
