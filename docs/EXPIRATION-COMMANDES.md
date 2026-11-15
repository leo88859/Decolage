# Expiration des commandes « nouvelle » (48 heures par défaut, réglable) et limites anti-abus

Une commande passée sans paiement **réserve du stock dès sa création**. Si le commerçant ne la traite pas, le stock resterait bloqué. Une commande restée « nouvelle » est donc **annulée automatiquement** après le délai de sa boutique (**48 h par défaut, de 6 h à 168 h**) et son stock est remis en vente, **une seule fois**.

Tout est préparé dans le dépôt, **rien n'est exécuté ni planifié** tant que tu ne le fais pas toi-même (étapes plus bas). Les migrations `0010` et `0010b` n'ont PAS été exécutées par le développeur.

## Les fichiers

| Fichier | Rôle | État |
|---|---|---|
| `supabase/0010_expiration_antiabus.sql` (copie à coller : `A-COLLER-0010.sql`) | colonnes `delai_expiration_h` et `quantite_max_article`, fonction d'expiration par boutique, limites anti-abus dans la création de commande | à exécuter à la main, après 0001 à 0009 |
| `supabase/0010b_planification_pg_cron.sql` | appelle l'expiration **toutes les 15 minutes** avec pg_cron | à exécuter à la main, après 0010 ET après activation de pg_cron par toi |
| `src/app/api/boutique/expiration/route.ts` | même expiration, appelable par un planificateur externe (alternative à pg_cron) | prête, inactive sans `CRON_SECRET` |

Ne rejoue jamais 0007 après 0010 (elle remettrait l'ancienne création de commande) : si tu le fais, rejoue 0010. 0010 est rejouable sans erreur.

## Ce que fait l'expiration (`boutique_expirer_commandes_nouvelles()`)

- Chaque boutique est traitée **avec son propre délai** (`boutiques.delai_expiration_h`), **indépendamment** des autres : une erreur sur une boutique est consignée (avertissement) et n'empêche pas les autres, ni n'annule rien de partiel sur elle.
- N'annule **que** le statut `nouvelle` ET `paiement = 'non_payee'`. Une commande **confirmée**, prête, terminée ou déjà annulée n'est **jamais** touchée.
- Le stock est remis par le déclencheur de la base au passage à « annulee » : **une seule fois**. Deux appels qui se chevauchent ne le remettent pas deux fois (verrou de ligne `for update skip locked` + `UPDATE` conditionnel sur le statut).
- Marqueur sur la commande : `annulee_le` et `annulation_motif = 'expiree_automatiquement'` (une annulation manuelle n'en a pas).
- Réservée au serveur (`service_role`) ; refusée à `anon` et `authenticated`. Renvoie le nombre de commandes annulées.
- La version à argument de 0008 (`boutique_expirer_commandes_nouvelles(interval)`) reste disponible (âge unique forcé pour toutes les boutiques).
- Le délai appliqué est le délai **actuel** de la boutique au moment du passage : si le commerçant le change, cela vaut pour ses commandes en attente. Contrainte `CHECK` en base (6 à 168) et validation côté serveur (`validateBoutique`).

## Limites anti-abus (mêmes valeurs côté serveur TypeScript et côté base)

| Limite | Valeur | Où |
|---|---|---|
| Quantité par article | 10 par défaut, réglable par la boutique de 1 à 99 | base (`E_QUANTITE_MAX`) + `validateCommande` |
| Articles par commande | 50 | base (`E_ARTICLES_MAX`) + `validateCommande` (`QUANTITE_TOTALE_MAX`) |
| Commandes « nouvelle » en attente par contact (e-mail ou téléphone) et par boutique | 2 | base (`E_CONTACT_TROP_DE_COMMANDES`) |
| Commandes par adresse IP | 3 par minute, 10 par heure | route API, en mémoire puis `limite_debit` en base (0007) |
| Commandes « nouvelle » simultanées par boutique | 50 | base (`E_TROP_DE_NOUVELLES`) |
| Commandes par heure et par boutique | 100 (inchangé, 0007) | base |

La base ne voit pas l'adresse IP : les limites par IP sont donc appliquées par la route `/api/boutique/commande`. Les valeurs sont dans `src/lib/boutique/money.ts`. Le compteur par IP compte aussi les envois refusés pour champ invalide (un humain qui se trompe trois fois en une minute doit attendre).

## Cloudflare Turnstile (anti-robot, facultatif)

- Variables : `NEXT_PUBLIC_TURNSTILE_SITE_KEY` (clé publique, widget) et `TURNSTILE_SECRET_KEY` (clé secrète, serveur seulement). **Les deux sont nécessaires.** Aucune valeur n'est dans le dépôt.
- **Non configuré** (pas de clé secrète) : la vérification est ignorée, la commande passe sans jeton. C'est le comportement local et le comportement actuel en ligne ; les autres protections (IP, contact, champ piège, limites) restent actives.
- **Configuré** : jeton absent = refus (400 `turnstile_requis`) ; jeton invalide = refus (403 `turnstile_invalide`) ; jeton valide = autorisé ; Cloudflare injoignable ou en erreur = refus temporaire (503 `turnstile_indisponible`, jamais un passage).
- Mise en place (toi) : créer un widget Turnstile dans ton compte Cloudflare (gratuit à ma connaissance, à vérifier), ajouter les deux variables sur Vercel, redéployer. Ne mets que la clé publique côté navigateur.

## Réglage par le commerçant et affichage

- Réglage : « Modifier les infos » (étape « Commande » de l'assistant) : annulation automatique après N heures, quantité maximale par article.
- Commerçant : compteur des commandes en attente (vue d'ensemble et page Commandes), date d'expiration et temps restant estimé par commande « nouvelle », **annulation multiple** (`POST /api/boutique/[id]/commandes/annuler`, `{ "refs": [...] }`, 50 références au plus, uniquement des commandes « nouvelle » de sa boutique ; les autres sont renvoyées dans `ignorees` sans être modifiées).
- Acheteur (panier et suivi) : « Sans confirmation de la boutique sous 48 heures, ta commande sera automatiquement annulée. », avec le délai réel de la boutique.
- Tant que 0010 n'est pas exécutée, le site fonctionne : le texte affiche 48 h, la quantité reste à 10 côté interface, les réglages sont ignorés à l'enregistrement.

## Activer la planification (à faire par toi)

Deux solutions, une seule suffit.

### A. pg_cron (recommandée avec ce lot : toutes les 15 minutes)
1. Exécuter `0010_expiration_antiabus.sql` (Supabase -> SQL Editor -> coller -> Run). Idem pour `0001` à `0009` si ce n'est pas fait.
2. **Activer toi-même l'extension** : Supabase -> Database -> Extensions -> `pg_cron` -> activer (disponibilité et coût à vérifier sur ton plan). Le fichier 0010b ne l'active pas.
3. Exécuter `0010b_planification_pg_cron.sql` (SQL Editor). Vérifier : `select jobname, schedule, active from cron.job;` ; historique : `select status, return_message, start_time from cron.job_run_details order by start_time desc limit 10;`
4. Arrêter : `select cron.unschedule('expirer-commandes-nouvelles');`

### B. Route protégée + planificateur externe
La route `/api/boutique/expiration` (désactivée sans `CRON_SECRET`, 401 si faux secret) appelle la même fonction. **Sans paramètre, chaque boutique est traitée avec son délai** (réponse `{ "annulees": N, "heures": null }`). Avec `?heures=N` (1 à 720), un âge unique est forcé pour toutes les boutiques. Les crons Vercel du plan gratuit sont limités (à vérifier) : pour 15 minutes, pg_cron est plus adapté.
1. Définir `CRON_SECRET` sur Vercel (secret long), puis ajouter un cron qui appelle la route en GET avec `Authorization: Bearer <CRON_SECRET>`.
2. Test manuel : `curl -X POST -H "Authorization: Bearer TON_SECRET" https://decollage.vercel.app/api/boutique/expiration`.

### Appel manuel unique
SQL Editor : `select public.boutique_expirer_commandes_nouvelles();`

## Ce qui est testé, et ce qui ne l'est pas

- Testé avec PGlite (vrai moteur PostgreSQL, sans le vrai Supabase) : `src/lib/boutique/expiration-0010.test.ts` (expiration à 48 h, délai réglé, confirmée jamais annulée, stock remis une fois, boutiques indépendantes avec panne simulée, contraintes CHECK, limites en base, droits).
- Simulé : les « appels simultanés » partent ensemble mais PGlite n'a qu'une seule connexion ; les vrais verrous entre deux connexions ne sont **pas** testés. Turnstile et les routes sont testés avec un faux Cloudflare et un faux Supabase (`src/app/api/boutique/etape2-routes.test.ts`).
- **Non testé en production** : aucune migration n'a été exécutée sur la vraie base, pg_cron n'a pas été activé, Turnstile n'a pas été essayé avec de vraies clés.
