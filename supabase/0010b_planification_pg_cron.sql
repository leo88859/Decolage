-- Décollage : migration 0010b, PLANIFICATION de l'expiration des commandes avec pg_cron (toutes les 15 minutes).
-- *** FICHIER NON EXÉCUTÉ PAR LE DÉVELOPPEUR. Il ne fait rien tant que tu ne le colles pas toi-même dans Supabase. ***
--
-- Prérequis, dans cet ordre :
--   1. Les migrations 0001 à 0010 sont déjà exécutées (0010 crée la fonction appelée ici).
--   2. TOI, tu actives l'extension pg_cron : Supabase -> Database -> Extensions -> chercher « pg_cron » -> activer.
--      (Disponibilité et coût : à vérifier sur ton plan Supabase. Ce fichier n'active PAS l'extension : aucune
--      commande « create extension » n'y figure, volontairement.)
--   3. SQL Editor -> New query -> coller CE fichier -> Run. Rejouable : l'ancienne planification du même nom est remplacée.
--
-- Vérifier : select jobid, jobname, schedule, active from cron.job where jobname = 'expirer-commandes-nouvelles';
-- Historique : select status, return_message, start_time from cron.job_run_details order by start_time desc limit 10;
-- Arrêter : select cron.unschedule('expirer-commandes-nouvelles');
-- Sans pg_cron, l'alternative reste la route /api/boutique/expiration appelée par un planificateur (voir docs/EXPIRATION-COMMANDES.md).

do $$
begin
  if exists (select 1 from cron.job where jobname = 'expirer-commandes-nouvelles') then
    perform cron.unschedule('expirer-commandes-nouvelles');
  end if;
end $$;

select cron.schedule(
  'expirer-commandes-nouvelles',
  '*/15 * * * *',
  $cron$select public.boutique_expirer_commandes_nouvelles()$cron$
);
