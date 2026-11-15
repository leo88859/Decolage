# Tests PostgreSQL RÉELS (plusieurs connexions) — Décollage

Ces scénarios vérifient ce que PGlite ne peut pas prouver : verrous entre deux connexions (`FOR UPDATE SKIP LOCKED`,
verrous consultatifs), permissions réelles des rôles, pg_cron, et remise en stock sous concurrence.

**PGlite (tests `npm test`) n'est PAS une preuve de ces comportements.** Il n'a qu'une connexion.

## Règles de sécurité

- **Jamais sur la production, jamais sur un projet Supabase.** `run-tests.mjs` refuse toute URL dont l'hôte contient « supabase » (code 2).
- **Une base de TEST uniquement** : locale, ou un PostgreSQL de test dans un conteneur que tu contrôles.
- Sans `TEST_PG_URL`, rien n'est exécuté : le script affiche « non exécuté » et sort avec le code 0.
- L'URL ne se met jamais dans le dépôt. Passe-la en variable d'environnement, pour la seule session du test.
- Aucune dépendance npm ajoutée : le script utilise `psql`, déjà présent sur la machine.

## Préparer une base de test locale (exemple, conteneur Docker)

Ceci est une proposition : aucune installation n'a été faite par le développeur. À valider par le responsable avant usage.

```bash
docker run --name decollage-test -e POSTGRES_PASSWORD=test -p 54329:5432 -d postgres:15
```

Puis créer les rôles et le schéma minimal Supabase (même logique que les tests PGlite) :

```sql
create role anon nologin;
create role authenticated nologin;
create role service_role nologin bypassrls;
create schema auth;
create table auth.users (id uuid primary key, email text);
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
grant usage on schema auth, public to anon, authenticated, service_role;
```

Les scénarios supposent un utilisateur présent dans `auth.users` (scénario 02). Ajoute-en un.

## Ordre d'exécution

1. Exécuter les migrations sur la base de TEST, dans cet ordre : `0001` à `0009`, puis `0010`, puis `0010b` (uniquement si pg_cron est installé), puis `0011`.
2. Ne **pas** exécuter `0011b` avant d'avoir vérifié le scénario « transition » (voir `docs/MIGRATIONS-PREPARATION.md`).
3. Lancer la suite :

```bash
TEST_PG_URL=postgres://postgres:test@localhost:54329/postgres node supabase/tests/run-tests.mjs
```

## Contenu

| Fichier | Vérifie |
|---|---|
| `scenarios/01_roles_permissions.sql` | anon, authenticated, service_role : droits sur fonctions et liste d'attente |
| `scenarios/02_expiration_preparation.sql` | crée une boutique de test, une commande protégée, une commande éligible et une commande confirmée |
| `scenarios/03_consentement_refus.sql` | inscription sans consentement refusée par la base, aucune écriture |
| `scenarios/04_pg_cron.sql` | job pg_cron planifié toutes les 15 min (ignoré si pg_cron absent) |
| `concurrence/expirer.sql` | lancé par DEUX sessions simultanées |
| `concurrence/verifier.sql` | une seule annulation, une seule remise en stock (stock attendu 11), commandes protégées et confirmée intactes ; nettoyage |

## Exécution réalisée (environnement local isolé)

- PostgreSQL 18.6 local (binaires du paquet npm `embedded-postgres`, installés HORS du dépôt), serveur sur `127.0.0.1` uniquement,
  base `decollage_test` jetable. Aucune base Supabase, aucune production.
- Mise en place : `setup-local-pg.mjs up` (variables `PG_BIN`, `PG_DATA`, `PG_PORT`, `TEST_PG_MODULE`). Migrations 0001 à 0011 appliquées sans erreur.
- Pilote : `psql` absent sur la machine ; la suite utilise donc le paquet `pg` désigné par `TEST_PG_MODULE`, une connexion par session.
- Résultats : permissions OK ; RLS liste d'attente OK ; consentement OK ; expiration simultanée (2 sessions) OK sur 10 tours ;
  limites concurrentes (contact 3 sessions, stock 2 sessions) OK sur 3 tours ; pg_cron IGNORÉ (extension non installée, volontairement).

### Contrôles négatifs (la suite doit échouer si la règle est cassée)

Exécutés sur des COPIES jetables de la base de test, supprimées ensuite :
- remise en stock DOUBLÉE à l'annulation : `ECHEC : stock total 12 au lieu de 11` ;
- garde `expiration_eligible` retirée : `ECHEC : une commande ANCIENNE protégée a été annulée`.

## Limites connues

- **Un seul moteur PostgreSQL testé (18.6)**, alors que Supabase tourne sur une autre version : des écarts sont possibles.
- **pg_cron n'est pas testé** : son extension n'est pas disponible dans ce paquet. Le scénario 04 le signale comme ignoré, il ne le valide pas.
- La concurrence est testée par deux ou trois sessions, en répétition : ce n'est pas une preuve exhaustive de tous les entrelacements.
- Le scénario de consentement ne couvre pas l'inscription réussie complète (la RLS de suppression, elle, est testée).
- Turnstile (réseau Cloudflare), Stripe et Vercel ne sont pas testés ici.
- Le paquet `pg` est pris hors du dépôt (`TEST_PG_MODULE`) : aucune dépendance n'est ajoutée au projet.
- L'authentification « trust » du serveur local est acceptable uniquement sur un poste de test, lié à `127.0.0.1`.
