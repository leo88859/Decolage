-- Décollage : CONTRÔLE EN LECTURE SEULE avant la migration 0010. Ce fichier n'est PAS une migration.
-- Il ne contient aucune écriture (ni insert, update, delete, alter, create, grant). Il peut être exécuté sans risque.
--
-- Question posée : combien de commandes « nouvelle » non payées de plus de 48 h seraient annulées au premier passage
-- du cron si l'on activait l'expiration SANS la garde expiration_eligible ? Ce sont les anciennes commandes : la migration
-- 0010 les protège (expiration_eligible = false) et ne les annule jamais.
--
-- 1. AVANT 0010 (la colonne expiration_eligible n'existe pas encore) : tout ce qui serait touché, par boutique.
select b.slug,
       count(*) as commandes_nouvelles_de_plus_de_48h
from public.commandes c
join public.boutiques b on b.id = c.boutique_id
where c.statut = 'nouvelle'
  and c.paiement = 'non_payee'
  and c.created_at < now() - interval '48 hours'
group by b.slug
order by commandes_nouvelles_de_plus_de_48h desc;

-- Total, à noter avant toute activation :
select count(*) as total_commandes_a_risque_sans_garde
from public.commandes c
where c.statut = 'nouvelle'
  and c.paiement = 'non_payee'
  and c.created_at < now() - interval '48 hours';

-- 2. APRÈS 0010 uniquement : anciennes commandes protégées par la garde (ne seront jamais annulées automatiquement).
--    À exécuter seulement si la colonne existe (sinon erreur « column does not exist » : c'est normal avant 0010).
select count(*) as anciennes_commandes_protegees
from public.commandes c
where c.statut = 'nouvelle'
  and c.paiement = 'non_payee'
  and c.expiration_eligible = false
  and c.created_at < now() - interval '48 hours';

-- 3. APRÈS 0010 : commandes réellement éligibles à l'expiration automatique (les seules qui seront annulées).
select count(*) as commandes_eligibles_a_expiration
from public.commandes c
where c.statut = 'nouvelle'
  and c.paiement = 'non_payee'
  and c.expiration_eligible = true;
