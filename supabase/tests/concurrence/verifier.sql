-- Vérifie le résultat des deux sessions simultanées, puis nettoie les données de test (slugs « test-conc- »).
do $$
declare
  b uuid := (select id from public.boutiques where slug = 'test-conc-1');
  st_ancienne text;
  st_eligible text;
  st_confirmee text;
  stock_total integer;
  annulations integer;
begin
  if b is null then raise exception 'ECHEC : boutique de test absente (scénario 02 non exécuté ?)'; end if;
  select statut into st_ancienne from public.commandes where ref = 'CMD-TC-ANCIENNE';
  select statut into st_eligible from public.commandes where ref = 'CMD-TC-ELIGIBLE';
  select statut into st_confirmee from public.commandes where ref = 'CMD-TC-CONFIRMEE';
  select sum(stock) into stock_total from public.variantes where boutique_id = b;
  select count(*) into annulations from public.commandes where boutique_id = b and annulation_motif = 'expiree_automatiquement';

  if st_ancienne <> 'nouvelle' then raise exception 'ECHEC : une commande ANCIENNE protégée a été annulée (%)', st_ancienne; end if;
  if st_eligible <> 'annulee' then raise exception 'ECHEC : la commande éligible n''est pas annulée (%)', st_eligible; end if;
  if st_confirmee <> 'confirmee' then raise exception 'ECHEC : une commande CONFIRMÉE a été touchée (%)', st_confirmee; end if;
  if annulations <> 1 then raise exception 'ECHEC : % annulations au lieu de 1', annulations; end if;
  -- Stock initial 10 ; une seule remise en stock de 1 pour l'éligible : 11 au total.
  if stock_total <> 11 then raise exception 'ECHEC : stock total % au lieu de 11 (remise en stock non unique ou absente)', stock_total; end if;

  -- Nettoyage (base de test uniquement).
  delete from public.lignes_commande where commande_id in (select id from public.commandes where boutique_id = b);
  delete from public.commandes where boutique_id = b;
  delete from public.variantes where boutique_id = b;
  delete from public.produits where boutique_id = b;
  delete from public.boutiques where id = b;
  raise notice 'OK : expiration simultanée : 1 annulation, 1 remise en stock, commandes protégées et confirmée intactes';
end $$;
