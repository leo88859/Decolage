-- Lancé EN PARALLÈLE par run-tests.mjs (deux sessions séparées). Chaque session appelle l'expiration.
-- Attendu : une seule annulation par commande éligible, une seule remise en stock (vérifié par verifier.sql).
-- La courte attente (0,3 s) fait arriver les deux sessions au même instant : sans elle, l'une finirait souvent avant l'autre.
select pg_sleep(0.3);
select public.boutique_expirer_commandes_nouvelles();
