-- Lancé en DEUX sessions simultanées : chacune réserve la dernière unité (variante B, stock 1), contacts différents.
-- Attendu : exactement 1 réussite ; l'autre refusée (stock insuffisant) ; stock final 0, jamais négatif.
do $$
declare
  v uuid := (select va.id from public.variantes va join public.boutiques bo on bo.id = va.boutique_id where bo.slug = 'test-lim-1' and va.nom = 'B');
  suffixe text := replace(gen_random_uuid()::text, '-', '');
begin
  begin
    perform public.boutique_creer_commande(
      'test-lim-1',
      'cle-stk-' || suffixe,
      jsonb_build_object('nom', 'Stock ' || suffixe, 'email', 'stock-' || suffixe || '@test.invalide'),
      'retrait',
      jsonb_build_array(jsonb_build_object('variante_id', v::text, 'quantite', 1)));
    insert into public.test_conc_resultats (bloc, issue) values ('stock', 'ok');
  exception when others then
    insert into public.test_conc_resultats (bloc, issue) values ('stock', sqlerrm);
  end;
end $$;
