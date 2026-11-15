-- Scénario 02 : préparation des données de concurrence (validée par concurrence/verifier.sql).
-- Crée, en validant (commit) : une boutique de test, une commande ANCIENNE protégée (expiration_eligible = false), une commande
-- ÉLIGIBLE vieille de 49 h, et une commande CONFIRMÉE vieille de 49 h. Les slugs commencent par « test-conc- » pour le nettoyage.
-- ATTENTION : base de TEST uniquement. Les données sont supprimées par concurrence/verifier.sql.
delete from public.boutiques where slug like 'test-conc-%';

-- Le propriétaire de test doit pouvoir publier (sinon 0006 refuse la commande comme « boutique introuvable »).
update public.profiles set plan = 'illimite' where id = (select id from auth.users limit 1);

insert into public.boutiques (proprietaire_id, slug, nom, statut, modes, delai_expiration_h, quantite_max_article)
select id, 'test-conc-1', 'Test concurrence', 'publiee', '{retrait}', 48, 10
from auth.users limit 1;

do $$
declare
  b uuid := (select id from public.boutiques where slug = 'test-conc-1');
  v uuid;
  p uuid;
begin
  insert into public.produits (boutique_id, titre, prix_centimes) values (b, 'Test', 1000) returning id into p;
  insert into public.variantes (produit_id, boutique_id, nom, stock) values (p, b, 'T', 10) returning id into v;

  insert into public.commandes (ref, boutique_id, cle_idempotence, client_nom, client_email, mode, jeton_hash, statut, paiement, created_at, expiration_eligible)
  values ('CMD-TC-ANCIENNE', b, 'cle-test-conc-ancienne-01', 'Ancienne', 'a@test.invalide', 'retrait', 'h1', 'nouvelle', 'non_payee', now() - interval '49 hours', false),
         ('CMD-TC-ELIGIBLE', b, 'cle-test-conc-eligible-01', 'Eligible', 'e@test.invalide', 'retrait', 'h2', 'nouvelle', 'non_payee', now() - interval '49 hours', true),
         ('CMD-TC-CONFIRMEE', b, 'cle-test-conc-confirmee-1', 'Confirmee', 'c@test.invalide', 'retrait', 'h3', 'confirmee', 'non_payee', now() - interval '49 hours', true);

  -- Lignes : 1 article chacune, stock réservé dans les mêmes proportions.
  insert into public.lignes_commande (commande_id, variante_id, produit_titre, variante_nom, prix_unitaire_centimes, quantite)
  select c.id, v, 'Test', 'T', 1000, 1 from public.commandes c where c.boutique_id = b;
end $$;
