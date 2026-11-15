-- Lancé EN PARALLÈLE par run-tests.mjs (deux sessions psql séparées). Chaque session appelle l'expiration.
-- Attendu : une seule annulation par commande éligible, une seule remise en stock (vérifié par verifier.sql).
select public.boutique_expirer_commandes_nouvelles();
