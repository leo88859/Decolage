# Préparation des migrations (pré-production) — Décollage

Document de procédure. **Aucune migration n'a été exécutée sur une base réelle.** Chaque étape ci-dessous est à faire
par le responsable, dans l'ordre, après validation de la précédente.

## 1. Ce qui est prêt et ce qui ne l'est pas

| Fichier | Rôle | État |
|---|---|---|
| `supabase/0010_expiration_antiabus.sql` | Expiration réglable (48 h, 6 à 168 h par boutique), garde `expiration_eligible`, limites anti-abus | Prêt pour une base de test. **Non exécuté sur la production.** |
| `supabase/A-COLLER-0010.sql` | Copie strictement identique de 0010, pour le collage manuel | Vérifié identique (test automatique). |
| `supabase/0010_controle_lecture_seule.sql` | Compte les commandes qui seraient annulées sans la garde. **Lecture seule.** | À exécuter AVANT 0010. |
| `supabase/0010b_planification_pg_cron.sql` | Planification toutes les 15 min | Nécessite pg_cron activé (toi). |
| `supabase/0011_waitlist_consentement.sql` | Consentement obligatoire, statut `a_verifier` pour les anciens inscrits | Prêt pour une base de test. |
| `supabase/0011b_retrait_waitlist_inscrire.sql` | Retire l'ancienne inscription sans consentement | **À exécuter seulement après déploiement du nouveau code.** |
| `supabase/tests/` | Suite PostgreSQL réelle à plusieurs connexions | Prête. Non exécutée ici : aucune base réelle disponible. |

## 2. Ordre d'exécution

Prérequis : les migrations `0001` à `0009` sont déjà exécutées, dans l'ordre. Ne **jamais** rejouer `0007` ni `0008` après `0010` ou `0011` :
elles remettraient les anciennes fonctions (création de commande sans limites, expiration sans garde).

1. **Sauvegarde** (section 3).
2. **Contrôle lecture seule** : exécuter `0010_controle_lecture_seule.sql`. Noter le total « commandes_nouvelles_de_plus_de_48h » :
   ce sont des commandes qui **ne seront pas annulées** grâce à la garde, mais qu'une version sans garde aurait annulées.
3. **Migration 0010** : exécuter `0010_expiration_antiabus.sql` (ou `A-COLLER-0010.sql`, identique). Vérifier (section 4).
4. **pg_cron** (toi) : activer l'extension dans Supabase (Database → Extensions). Disponibilité et coût selon ton plan : à vérifier.
5. **Migration 0010b** : exécuter `0010b_planification_pg_cron.sql`. Vérifier le job (section 4).
6. **Migration 0011** : exécuter `0011_waitlist_consentement.sql` **dans la même fenêtre que le déploiement** du nouveau code
   (l'ancien code appelle encore `waitlist_inscrire` ; la fonction reste en place jusqu'à 0011b).
7. **Déploiement** du code (hors de ce document).
8. **Migration 0011b** : exécuter `0011b_retrait_waitlist_inscrire.sql`, seulement quand plus aucune route n'appelle l'ancienne fonction.

Les migrations 0010 et 0011 ne suppriment aucune donnée. 0011b ne supprime que l'ancienne fonction.

## 3. Sauvegarde avant migration

Le fichier `docs/SAUVEGARDES-SUPABASE.md` ne figure pas dans le dépôt : ne pas s'y fier. Procédure proposée :

1. **Sauvegarde complète** (schéma et données) avant toute migration :
   `pg_dump` avec une chaîne de connexion que TU fournis hors du dépôt (variable d'environnement, jamais dans un fichier versionné).
   Commande de principe : `pg_dump --format=custom --file=sauvegarde-avant-0010.dump "$URL_BASE"`.
   Vérifier que le fichier n'est pas vide, puis le restaurer dans une base de test pour s'assurer qu'il est lisible.
2. **Sauvegarde gérée** Supabase, si ton plan la propose (à vérifier dans le tableau de bord).
3. **Comptage de référence** avant migration, à noter :
   - commandes par statut ;
   - somme des stocks (`select sum(stock) from public.variantes`) ;
   - nombre d'inscrits en liste d'attente.

## 4. Contrôles après chaque migration (lecture seule)

Après 0010 :
```sql
select to_regprocedure('public.boutique_expirer_commandes_nouvelles()') is not null as sans_argument,
       to_regprocedure('public.boutique_expirer_commandes_nouvelles(interval)') is not null as avec_argument,
       exists (select 1 from information_schema.columns where table_name = 'commandes' and column_name = 'expiration_eligible') as garde;
-- attendu : true, true, true
select count(*) filter (where expiration_eligible) as eligibles, count(*) filter (where not expiration_eligible) as protegees from public.commandes;
-- attendu : eligibles = 0 juste après 0010 (toutes les commandes existantes sont protégées)
```

Après 0010b :
```sql
select jobname, schedule, active from cron.job where jobname = 'expirer-commandes-nouvelles';
select status, return_message, start_time from cron.job_run_details order by start_time desc limit 10;
```

Après 0011 :
```sql
select to_regprocedure('public.waitlist_inscrire_consent(text,text,boolean,text)') is not null as nouvelle,
       to_regprocedure('public.waitlist_inscrire(text,text)') is not null as ancienne_transitoire;
-- attendu : true, true (ancienne encore présente pendant la transition)
select consentement_statut, count(*) from public.waitlist group by 1;
-- attendu : tous les anciens en 'a_verifier'
```

Après 0011b :
```sql
select to_regprocedure('public.waitlist_inscrire(text,text)') is not null as ancienne;  -- attendu : false
```

Vérifier aussi le comptage de référence (section 3) : rien ne doit avoir disparu.

## 5. Conséquences pour les données existantes

- **Commandes existantes** : aucune n'est annulée automatiquement (garde). Elles restent « nouvelle » jusqu'à décision du commerçant.
- **Délais** : les boutiques existantes passent à 48 h, sans effet sur les commandes anciennes (garde).
- **Liste d'attente** : tous les anciens inscrits passent en `a_verifier`. Aucun n'est marqué consentant. Le propriétaire les vérifie ou les supprime.
- **Stock** : aucune modification directe. Il ne change qu'à l'annulation d'une commande éligible (une seule remise en stock).

## 6. Procédure de correction ou de restauration

- **0010 ou 0011 en échec** : NON VÉRIFIÉ que l'éditeur SQL de Supabase enveloppe tout le fichier dans une seule transaction. En cas d'erreur, ne pas supposer que rien n'a été appliqué : relire l'erreur, contrôler l'état avec les requêtes de la section 4, puis corriger et relancer (les migrations sont rejouables).
- **Problème après exécution** : il n'existe **pas** de script de retour arrière. Supprimer des colonnes effacerait des données.
  La seule restauration fiable est la sauvegarde de la section 3, restaurée dans un projet ou une base distincte.
- **0011b exécutée trop tôt** (ancien code encore appelé) : les inscriptions échouent jusqu'au déploiement du nouveau code. Ne pas la rejouer avant.

## 7. Variables d'environnement liées

- `NEXT_PUBLIC_TURNSTILE_SITE_KEY` et `TURNSTILE_SECRET_KEY` : **les deux** sont nécessaires. Une seule bloque les commandes
  (erreur `configuration_turnstile`). Aucune clé n'est fournie par le dépôt.
- `CRON_SECRET` : facultative, uniquement pour la route d'expiration externe.

## 8. Commandes à exécuter à la main (rappel)

Dans cet ordre, sur la base cible, après validation : `0010_controle_lecture_seule.sql` (lecture), `0010_expiration_antiabus.sql`,
activation pg_cron (manuelle), `0010b_planification_pg_cron.sql`, `0011_waitlist_consentement.sql` (avec le déploiement),
puis `0011b_retrait_waitlist_inscrire.sql` (après déploiement).
