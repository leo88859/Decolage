-- Scénario 04 : pg_cron. N'ACTIVE JAMAIS l'extension. Si pg_cron n'est pas installé, le scénario est signalé « ignoré » (pas un échec).
do $$
begin
  if to_regclass('cron.job') is null then
    raise notice 'IGNORÉ : pg_cron non installé sur cette base de test (extension non activée, volontairement)';
    return;
  end if;
  if not exists (select 1 from cron.job where jobname = 'expirer-commandes-nouvelles' and schedule = '*/15 * * * *') then
    raise exception 'ECHEC : job pg_cron « expirer-commandes-nouvelles » absent ou mal planifié (0010b non exécutée ?)';
  end if;
  raise notice 'OK : job pg_cron planifié toutes les 15 minutes';
end $$;
