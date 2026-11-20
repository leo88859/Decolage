-- Décollage : migration 0011b, RETRAIT de l'ancienne inscription sans consentement waitlist_inscrire(text, text).
-- *** FICHIER PRÉPARÉ, NON EXÉCUTÉ. À lancer à la main, et SEULEMENT après déploiement COMPLET du nouveau code. ***
--
-- Pourquoi une migration séparée : pendant la transition, l'ancien code déployé appelle encore waitlist_inscrire.
-- La supprimer dans 0011 provoquerait des erreurs d'inscription pendant le déploiement. Cette suppression vient donc après.
--
-- Avant d'exécuter ce fichier, vérifier :
--   1. 0010, 0010b (si pg_cron) et 0011 sont déjà exécutées.
--   2. Le nouveau code est déployé en production (plus aucune route n'appelle waitlist_inscrire).
--   3. Dans le dépôt, aucun appel à waitlist_inscrire( ne subsiste hors tests et documentation.
--
-- Rejouable sans erreur (if exists). Ne supprime aucune donnée : seule l'ancienne fonction disparaît.
-- Après exécution, vérifier : select to_regprocedure('public.waitlist_inscrire(text,text)');  -- attendu : null
-- Ne jamais rejouer 0007 ni 0008 après cette migration (elles recréeraient l'ancienne fonction).

drop function if exists public.waitlist_inscrire(text, text);
