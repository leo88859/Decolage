-- ═══════════════════════════════════════════════════════════════════════════════════════════
-- 0011 : liste d'attente avec consentement obligatoire (étape 5)
-- ═══════════════════════════════════════════════════════════════════════════════════════════
-- ATTENTION : fichier PRÉPARÉ, NON EXÉCUTÉ sur la vraie base. À lancer à la main dans le SQL Editor de Supabase,
-- après 0007 (il remplace waitlist_inscrire de 0007). Il ne touche à aucune politique RLS ni à aucun droit de table existant.
-- Rejouable sans danger (if not exists / create or replace / drop if exists).
--
-- Ce que fait la migration :
--   1. ajoute à public.waitlist trois colonnes :
--        consentement_statut : 'recueilli' (la personne a coché la case) ou 'a_verifier' (ancien inscrit, rien n'a été demandé) ;
--        consentement_le     : horodatage du consentement (NULL pour les anciens inscrits) ;
--        consentement_texte  : version du texte affiché au moment de l'inscription (NULL pour les anciens inscrits).
--   2. TOUS les inscrits existants prennent la valeur par défaut 'a_verifier' : AUCUN ancien inscrit n'est jamais marqué
--      comme ayant consenti automatiquement. Aucune ligne n'est supprimée ni modifiée dans ses autres colonnes.
--   3. ajoute des contraintes de cohérence : 'recueilli' exige un horodatage et une version de texte ; 'a_verifier' n'en a pas.
--   4. crée waitlist_inscrire_consent(slug, email, consentement, version_texte). L'ancienne waitlist_inscrire(text, text), qui permettait
--      de s'inscrire sans consentement, reste TEMPORAIREMENT en place : l'ancien code déployé l'appelle encore pendant la transition.
--      Elle est retirée par 0011b_retrait_waitlist_inscrire.sql, à exécuter SEULEMENT après déploiement complet du nouveau code.
--
-- ORDRE : 0010 -> 0010b (si pg_cron) -> 0011 -> déploiement du nouveau code -> 0011b. Ne jamais rejouer 0007 ni 0008 après 0011.
-- Aucun e-mail n'est envoyé par cette migration ni par le produit.

alter table public.waitlist add column if not exists consentement_statut text not null default 'a_verifier';
alter table public.waitlist add column if not exists consentement_le timestamptz;
alter table public.waitlist add column if not exists consentement_texte text;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'waitlist_consentement_statut_valeurs' and conrelid = 'public.waitlist'::regclass) then
    alter table public.waitlist add constraint waitlist_consentement_statut_valeurs
      check (consentement_statut in ('recueilli', 'a_verifier'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'waitlist_consentement_coherent' and conrelid = 'public.waitlist'::regclass) then
    alter table public.waitlist add constraint waitlist_consentement_coherent
      check (
        (consentement_statut = 'recueilli' and consentement_le is not null and consentement_texte is not null and char_length(consentement_texte) between 1 and 40)
        or (consentement_statut = 'a_verifier' and consentement_le is null and consentement_texte is null)
      );
  end if;
end $$;

-- Seule voie d'inscription (service_role). Codes renvoyés : 'ok' (inscrit OU déjà inscrit : réponse identique, rien n'est révélé),
-- 'consentement_requis', 'email_invalide', 'site_inconnu', 'trop_de_demandes', 'liste_pleine'.
-- Le consentement est vérifié ICI, côté base, en plus de la route : sans consentement, rien n'est écrit.
-- Une personne déjà inscrite avant cette migration ('a_verifier') qui s'inscrit à nouveau en cochant la case passe à 'recueilli'
-- (consentement réellement donné maintenant). Un consentement déjà recueilli n'est jamais modifié.
create or replace function public.waitlist_inscrire_consent(p_slug text, p_email text, p_consentement boolean, p_texte_version text) returns text
language plpgsql security definer set search_path = public as $$
declare
  e text := lower(btrim(coalesce(p_email, '')));
  v text := btrim(coalesce(p_texte_version, ''));
begin
  if p_consentement is distinct from true then
    return 'consentement_requis';
  end if;
  if p_slug is null or p_slug !~ '^[a-z0-9]([a-z0-9-]{1,38}[a-z0-9])$' then
    return 'site_inconnu';
  end if;
  if char_length(e) not between 5 and 254 or e !~ '^[^\s@]+@[^\s@]+\.[^\s@]{2,}$' then
    return 'email_invalide';
  end if;
  if char_length(v) not between 1 and 40 then
    return 'consentement_requis';
  end if;
  if not exists (select 1 from public.sites s where s.slug = p_slug and s.suspended_at is null and public.owner_can_publish(s.user_id)) then
    return 'site_inconnu';
  end if;
  if public.limite_debit('wl-site', p_slug, 300, 3600) then
    return 'trop_de_demandes';
  end if;
  perform pg_advisory_xact_lock(hashtext('waitlist:' || p_slug));
  if (select count(*) from public.waitlist where slug = p_slug) >= 5000 then
    return 'liste_pleine';
  end if;
  insert into public.waitlist (slug, email, consentement_statut, consentement_le, consentement_texte)
  values (p_slug, e, 'recueilli', now(), v)
  on conflict (slug, email) do update
    set consentement_statut = 'recueilli', consentement_le = now(), consentement_texte = excluded.consentement_texte
    where public.waitlist.consentement_statut = 'a_verifier';
  return 'ok';
end;
$$;
revoke all on function public.waitlist_inscrire_consent(text, text, boolean, text) from public, anon, authenticated;
grant execute on function public.waitlist_inscrire_consent(text, text, boolean, text) to service_role;

-- L'ancienne fonction waitlist_inscrire(text, text) n'est PAS supprimée ici (voir 0011b, après déploiement).
-- Tant qu'elle existe, elle reste réservée à service_role, comme avant ; le nouveau code ne l'appelle plus.
