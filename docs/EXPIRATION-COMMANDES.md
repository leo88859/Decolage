# Expiration des commandes « nouvelle » (72 heures)

Une commande passée sans paiement **réserve du stock**. Si le commerçant ne la traite jamais, le stock reste bloqué. Au bout de **72 heures**, une commande restée « nouvelle » est donc annulée automatiquement et son stock est remis, **une seule fois**.

**Rien n'est planifié aujourd'hui** : le code et la base sont prêts, mais personne n'appelle la fonction tant que tu n'as pas activé l'une des deux solutions ci-dessous. Aucun `vercel.json` de cron, aucun job `pg_cron` n'existe dans le dépôt.

## Ce que fait la fonction (migration 0008)

`public.boutique_expirer_commandes_nouvelles()` (sans argument : 72 heures) ou `...(interval '48 hours')` (minimum 1 heure).

- N'annule **que** le statut `nouvelle` ET `paiement = 'non_payee'`. Une commande confirmée, prête, terminée ou déjà annulée n'est jamais touchée. Si un paiement en ligne existe un jour, une commande payée ne sera jamais annulée par ce mécanisme.
- Le stock est remis par le déclencheur de la base au passage à « annulee » : un second appel, ou deux appels simultanés, ne remettent jamais le stock deux fois (verrou de ligne + filtre de statut, testé).
- Marqueur : colonnes `annulee_le` et `annulation_motif = 'expiree_automatiquement'` sur la commande (lisibles par le commerçant, pour ses seules commandes). Une annulation faite à la main n'a pas de marqueur.
- Exécutable **uniquement** par le serveur (`service_role`) ; refusé à `anon` et `authenticated`.
- Renvoie le nombre de commandes annulées.

## Comparaison

| | `pg_cron` (dans Supabase) | Route `/api/boutique/expiration` + planificateur |
|---|---|---|
| Principe | Supabase exécute la fonction SQL lui-même, à l'heure voulue | Un planificateur (Vercel Cron ou autre) appelle l'adresse avec `Authorization: Bearer <CRON_SECRET>` |
| Disponibilité | Extension de Supabase ; **à vérifier sur ton plan** (Database -> Extensions) | Route déjà codée et testée dans ce dépôt |
| Mise en place | Activer l'extension, coller 1 requête SQL | Définir `CRON_SECRET` sur Vercel, ajouter un cron, redéployer |
| Sécurité | Aucune adresse publique ; tout reste dans la base | Adresse publique protégée par un secret long : 404 sans secret configuré, 401 si faux, comparaison en temps constant (empreintes + `timingSafeEqual`) ; le secret doit rester confidentiel |
| Coût | À vérifier sur ton plan Supabase | À vérifier sur ton plan Vercel |
| Fiabilité | Dépend de l'extension et de la base ; pas de nouvelle tentative visible | Dépend du planificateur et du déploiement ; une erreur renvoie 500/503 visible dans les journaux |
| Observabilité | Historique des exécutions dans la base (`cron.job_run_details`, à vérifier) | Journaux Vercel de la route, réponse `{ annulees, heures }` |
| Dérive des versions | La planification vit dans la base, hors du code (à noter quelque part) | La planification vit dans le dépôt (fichier de config), versionnée |

### Cron Vercel : ce qu'il faut savoir (non vérifié ici, je n'ai consulté aucun service)
- Les crons Vercel appellent une adresse de ton site en **GET** et ajoutent eux-mêmes `Authorization: Bearer <CRON_SECRET>` si la variable `CRON_SECRET` existe. C'est pour cela que la route accepte GET **et** POST (POST : appel manuel).
- Le **plan gratuit (Hobby)** de Vercel limite les crons (nombre de tâches et fréquence ; à ma connaissance, au plus une exécution par jour avec une heure approximative). **À vérifier sur la page officielle des limites de Vercel avant de compter dessus.**
- Avec un délai de 72 heures, une exécution **par jour** suffit : une commande est annulée au plus ~24 h après ses 72 h.

## Recommandation pour ce projet

**La route protégée + un cron Vercel quotidien**, avec `pg_cron` comme solution de secours si ton plan Vercel ne le permet pas.

Pourquoi : le code est déjà écrit et testé, la planification reste dans le dépôt (visible, versionnée), les résultats se lisent dans les journaux Vercel, et rien de plus à activer côté Supabase. Un passage par jour suffit pour un délai de 72 heures.

## Comment l'activer plus tard (pas à pas, sans être développeur)

0. Demande à ton développeur de déployer la migration `supabase/A-COLLER-0008.sql` d'abord (Supabase -> SQL Editor -> coller -> Run). Sans elle, la route répond 503 « migration ».
1. Invente un secret long et aléatoire (au moins 32 caractères ; un gestionnaire de mots de passe sait en générer). Ne le partage nulle part.
2. Sur Vercel : ton projet -> Settings -> Environment Variables -> ajouter `CRON_SECRET` = ton secret (Production). Tant que cette variable n'existe pas, la route répond 404 et ne fait rien.
3. Ton développeur ajoute à la racine du dépôt un fichier `vercel.json` (il n'existe pas encore) :
   ```json
   { "crons": [{ "path": "/api/boutique/expiration", "schedule": "0 4 * * *" }] }
   ```
   (tous les jours à 04:00 UTC), puis redéploie le site.
4. Vérifie : Vercel -> ton projet -> Settings -> Cron Jobs (la tâche doit apparaître) ; un clic sur « Run » (si proposé) ou, depuis un terminal : `curl -X POST -H "Authorization: Bearer TON_SECRET" https://decollage.vercel.app/api/boutique/expiration` doit répondre `{"annulees":0,"heures":72}` (ou un nombre).
5. Lis les journaux de la route après le premier passage (Vercel -> Logs). Pour arrêter : supprimer `vercel.json` (ou la ligne `crons`) et redéployer, ou retirer `CRON_SECRET` (la route redevient introuvable).

### Variante `pg_cron` (si Vercel ne convient pas)
1. Supabase -> Database -> Extensions -> activer `pg_cron` (**à vérifier sur ton plan**).
2. SQL Editor :
   ```sql
   select cron.schedule('expirer-commandes-nouvelles', '17 * * * *', $$select public.boutique_expirer_commandes_nouvelles()$$);
   ```
   (toutes les heures, à la minute 17 ; la fonction sans argument utilise 72 h).
3. Pour arrêter : `select cron.unschedule('expirer-commandes-nouvelles');`

## Appel manuel unique
SQL Editor : `select public.boutique_expirer_commandes_nouvelles();` (renvoie le nombre de commandes annulées).
