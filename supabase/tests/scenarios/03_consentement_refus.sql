-- Scénario 03 : la base refuse une inscription sans consentement, avant tout autre contrôle. Aucune donnée n'est écrite.
do $$
declare
  avant bigint;
begin
  select count(*) into avant from public.waitlist;
  if public.waitlist_inscrire_consent('site-inexistant-test', 'refus@test.invalide', false, '2026-11-15') <> 'consentement_requis' then
    raise exception 'ECHEC : consentement faux non refusé';
  end if;
  if public.waitlist_inscrire_consent('site-inexistant-test', 'refus@test.invalide', null, '2026-11-15') <> 'consentement_requis' then
    raise exception 'ECHEC : consentement absent non refusé';
  end if;
  if public.waitlist_inscrire_consent('site-inexistant-test', 'refus@test.invalide', true, '') <> 'consentement_requis' then
    raise exception 'ECHEC : version du texte vide non refusée';
  end if;
  if (select count(*) from public.waitlist) <> avant then
    raise exception 'ECHEC : une ligne a été écrite malgré le refus';
  end if;
  raise notice 'OK : inscriptions sans consentement refusées par la base, aucune écriture';
end $$;
