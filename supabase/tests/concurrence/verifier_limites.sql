-- Vérifie les limites concurrentes (contact et stock), puis nettoie les données de test (slugs « test-lim- »).
do $$
declare
  b uuid := (select id from public.boutiques where slug = 'test-lim-1');
  ok_contact integer;
  refus_contact integer;
  ok_stock integer;
  stock_b integer;
  stock_negatif integer;
begin
  if b is null then raise exception 'ECHEC : boutique de test des limites absente (préparation non exécutée ?)'; end if;
  select count(*) filter (where issue = 'ok'), count(*) filter (where issue like '%E_CONTACT_TROP_DE_COMMANDES%')
    into ok_contact, refus_contact from public.test_conc_resultats where bloc = 'contact';
  select count(*) filter (where issue = 'ok') into ok_stock from public.test_conc_resultats where bloc = 'stock';
  select stock into stock_b from public.variantes where boutique_id = b and nom = 'B';
  select count(*) into stock_negatif from public.variantes where boutique_id = b and stock < 0;

  if ok_contact <> 2 then raise exception 'ECHEC : limite par contact : % réussites au lieu de 2', ok_contact; end if;
  if refus_contact <> 1 then raise exception 'ECHEC : limite par contact : % refus E_CONTACT_TROP_DE_COMMANDES au lieu de 1', refus_contact; end if;
  if ok_stock <> 1 then raise exception 'ECHEC : stock unique : % réussites au lieu de 1 (double réservation ?)', ok_stock; end if;
  if stock_b <> 0 then raise exception 'ECHEC : stock final de la variante B = % au lieu de 0', stock_b; end if;
  if stock_negatif <> 0 then raise exception 'ECHEC : stock négatif détecté'; end if;

  delete from public.lignes_commande where commande_id in (select id from public.commandes where boutique_id = b);
  delete from public.commandes where boutique_id = b;
  delete from public.variantes where boutique_id = b;
  delete from public.produits where boutique_id = b;
  delete from public.boutiques where id = b;
  delete from public.test_conc_resultats;
  raise notice 'OK : limite par contact (2 sur 3) et stock unique (1 sur 2) tiennent sous concurrence';
end $$;
