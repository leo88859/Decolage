-- Lancé en TROIS sessions simultanées : même contact (même e-mail), variante A. Attendu : exactement 2 réussites
-- (limite de 2 commandes « nouvelle » en attente par contact), la 3e refusée par E_CONTACT_TROP_DE_COMMANDES.
do $$
declare
  v uuid := (select va.id from public.variantes va join public.boutiques bo on bo.id = va.boutique_id where bo.slug = 'test-lim-1' and va.nom = 'A');
begin
  begin
    perform public.boutique_creer_commande(
      'test-lim-1',
      'cle-lim-' || replace(gen_random_uuid()::text, '-', ''),
      jsonb_build_object('nom', 'Contact Limite', 'email', 'limite@test.invalide'),
      'retrait',
      jsonb_build_array(jsonb_build_object('variante_id', v::text, 'quantite', 1)));
    insert into public.test_conc_resultats (bloc, issue) values ('contact', 'ok');
  exception when others then
    insert into public.test_conc_resultats (bloc, issue) values ('contact', sqlerrm);
  end;
end $$;
