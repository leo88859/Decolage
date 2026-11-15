-- Scénario 06 : RLS réelle de la liste d'attente, avec les rôles authenticated et anon. Base de TEST uniquement.
-- Deux propriétaires (A et B), chacun avec son site et ses inscrits. Chacun ne voit et ne supprime QUE les siens.
-- Tout est fait dans UN bloc : en cas d'erreur, la transaction annule aussi le changement de rôle.
delete from public.waitlist where slug like 'test-rls-%';
delete from public.sites where slug like 'test-rls-%';
delete from public.projects where id like 'proj-rls-%';

do $$
declare
  ua uuid := (select id from auth.users order by id limit 1);
  ub uuid := '00000000-0000-4000-8000-00000000000b';
  n integer;
begin
  insert into auth.users (id, email) values (ub, 'b@test.invalide') on conflict do nothing;
  update public.profiles set plan = 'illimite' where id in (ua, ub);

  insert into public.projects (user_id, id, data) values (ua, 'proj-rls-a', '{"nom":"A"}'::jsonb), (ub, 'proj-rls-b', '{"nom":"B"}'::jsonb);
  insert into public.sites (slug, user_id, project_id, data) values
    ('test-rls-a', ua, 'proj-rls-a', '{"a":1}'::jsonb),
    ('test-rls-b', ub, 'proj-rls-b', '{"b":1}'::jsonb);

  -- Inscriptions avec consentement (fonction de service : appelée ici en superutilisateur, comme la route serveur).
  if public.waitlist_inscrire_consent('test-rls-a', 'inscrit-a@test.invalide', true, '2026-11-15') <> 'ok' then raise exception 'ECHEC : inscription A'; end if;
  if public.waitlist_inscrire_consent('test-rls-b', 'inscrit-b@test.invalide', true, '2026-11-15') <> 'ok' then raise exception 'ECHEC : inscription B'; end if;

  -- 1. Le propriétaire A voit SES inscrits, et seulement les siens.
  perform set_config('request.jwt.claim.sub', ua::text, true);
  execute 'set role authenticated';
  select count(*) into n from public.waitlist where slug = 'test-rls-a';
  if n <> 1 then raise exception 'ECHEC RLS : A ne voit pas ses inscrits (%)', n; end if;
  select count(*) into n from public.waitlist where slug = 'test-rls-b';
  if n <> 0 then raise exception 'ECHEC RLS : A voit les inscrits de B (%)', n; end if;

  -- 2. A ne peut pas supprimer un inscrit de B (0 ligne touchée, sans erreur).
  delete from public.waitlist where slug = 'test-rls-b';
  execute 'reset role';
  if (select count(*) from public.waitlist where slug = 'test-rls-b') <> 1 then raise exception 'ECHEC RLS : A a supprimé un inscrit de B'; end if;

  -- 3. B ne voit pas les inscrits de A, et ne peut pas les supprimer.
  perform set_config('request.jwt.claim.sub', ub::text, true);
  execute 'set role authenticated';
  select count(*) into n from public.waitlist where slug = 'test-rls-a';
  if n <> 0 then raise exception 'ECHEC RLS : B voit les inscrits de A (%)', n; end if;
  delete from public.waitlist where slug = 'test-rls-a';
  execute 'reset role';
  if (select count(*) from public.waitlist where slug = 'test-rls-a') <> 1 then raise exception 'ECHEC RLS : B a supprimé un inscrit de A'; end if;

  -- 4. A supprime SON inscrit (retrait du consentement par le propriétaire) : une seule ligne.
  perform set_config('request.jwt.claim.sub', ua::text, true);
  execute 'set role authenticated';
  delete from public.waitlist where slug = 'test-rls-a' and email = 'inscrit-a@test.invalide';
  execute 'reset role';
  if (select count(*) from public.waitlist where slug = 'test-rls-a') <> 0 then raise exception 'ECHEC : suppression par le propriétaire non effective'; end if;

  -- 5. anon ne lit pas la liste d'attente.
  execute 'set role anon';
  begin
    perform 1 from public.waitlist limit 1;
    execute 'reset role';
    raise exception 'ECHEC RLS : anon lit la liste d''attente';
  exception when insufficient_privilege then
    execute 'reset role';
  end;

  -- Nettoyage des données de test.
  delete from public.waitlist where slug like 'test-rls-%';
  delete from public.sites where slug like 'test-rls-%';
  delete from public.projects where id like 'proj-rls-%';
  raise notice 'OK : RLS liste d''attente : chaque propriétaire ne voit et ne supprime que ses inscrits ; anon refusé';
end $$;
