-- Préparation des limites concurrentes (lancée avant chaque tour par run-tests.mjs). BASE DE TEST uniquement.
-- Crée une boutique publiée « test-lim-1 » : variante A (stock 50, pour la limite par contact) et variante B (stock 1, pour l'unicité du stock).
delete from public.boutiques where slug like 'test-lim-%';
create table if not exists public.test_conc_resultats (id bigserial primary key, bloc text not null, issue text not null);
delete from public.test_conc_resultats;
update public.profiles set plan = 'illimite' where id = (select id from auth.users limit 1);

do $$
declare
  owner uuid := (select id from auth.users limit 1);
  b uuid;
  p uuid;
begin
  insert into public.boutiques (proprietaire_id, slug, nom, statut, modes, delai_expiration_h, quantite_max_article)
  values (owner, 'test-lim-1', 'Test limites', 'publiee', '{retrait}', 48, 10) returning id into b;
  insert into public.produits (boutique_id, titre, prix_centimes) values (b, 'Test limites', 1000) returning id into p;
  insert into public.variantes (produit_id, boutique_id, nom, stock) values (p, b, 'A', 50);
  insert into public.variantes (produit_id, boutique_id, nom, stock) values (p, b, 'B', 1);
end $$;
