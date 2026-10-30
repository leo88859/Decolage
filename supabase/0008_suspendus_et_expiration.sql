-- Décollage : migration 0008, sites/boutiques suspendus hors limite + expiration des commandes « nouvelle » (72 h).
-- À exécuter UNE FOIS À LA MAIN dans Supabase : SQL Editor -> New query -> coller -> Run.
-- Rejouable sans erreur (idempotente). Ne supprime et ne modifie AUCUNE donnée existante.
-- Prérequis : 0001 à 0007 déjà exécutées, dans l'ordre. Ne modifie pas les fichiers 0001 à 0007 : elle remplace des
-- fonctions et des déclencheurs par de nouvelles versions. À EXÉCUTER EN DERNIER : si tu rejoues 0007 après elle, rejoue 0008.
--
-- 1. LIMITE DE PUBLICATION : seuls les sites et boutiques EN LIGNE (suspended_at nul) comptent, comme dans l'API
--    (commit 798be13 : /api/sites ignore les suspendus). Avant, les déclencheurs de 0006 comptaient aussi les suspendus,
--    donc la base refusait un nouveau site que l'API autorisait. Règle (identique dans la base et dans l'API) :
--      * un élément suspendu après rétrogradation ne compte pas dans la limite de publication ;
--      * publier un NOUVEL élément est refusé si (éléments en ligne) >= limite de la formule (Solo 1, Pro 5, Illimité sans limite) ;
--      * RÉACTIVER un élément suspendu (suspended_at repassé à NULL) est soumis à la même limite, pour TOUS les rôles
--        (navigateur, serveur service_role) ; seul l'administrateur SQL (postgres, supabase_admin) n'est pas bloqué ;
--      * Gratuit : jamais de publication ni de réactivation ; suspendre reste toujours permis ;
--      * sites et boutiques partagent UNE limite et UN verrou par propriétaire (pas de course entre deux publications).
--    Le navigateur ne peut toujours pas écrire suspended_at (aucun droit de colonne).
-- 2. EXPIRATION : boutique_expirer_commandes_nouvelles() prend 72 heures par défaut, n'annule que « nouvelle » ET non payée,
--    pose un marqueur « expirée automatiquement » (colonnes annulee_le, annulation_motif), reste exécutable par service_role seul.

-- ═══ 1. Sites ═════════════════════════════════════════════════════════════════════════════════
create or replace function public.sites_enforce_plan() returns trigger
language plpgsql set search_path = public as $$
declare
  maxs integer;
  n integer;
  formule text;
  exclu text := null;
begin
  if current_user in ('postgres', 'supabase_admin') then
    return new;
  end if;
  perform pg_advisory_xact_lock(hashtext('boutiques:' || new.user_id::text));
  formule := coalesce((select plan from public.profiles where id = new.user_id), 'gratuit');
  if not public.plan_can_publish(formule) then
    if tg_op = 'INSERT' or new.suspended_at is null then
      raise exception 'La publication en ligne n''est pas incluse dans la formule Gratuit.' using errcode = 'P0001', hint = 'publication_formule';
    end if;
    return new;
  end if;
  if tg_op = 'UPDATE' then
    exclu := old.slug;
  end if;
  maxs := public.plan_max_sites(formule);
  -- Un élément qui devient (ou est créé) EN LIGNE : nouvelle publication ou réactivation d'un site suspendu.
  if maxs is not null and new.suspended_at is null and (tg_op = 'INSERT' or old.suspended_at is not null) then
    select (select count(*) from public.sites where user_id = new.user_id and suspended_at is null and slug is distinct from exclu)
         + (select count(*) from public.boutiques where proprietaire_id = new.user_id and statut = 'publiee' and suspended_at is null)
      into n;
    if n >= maxs then
      raise exception 'Limite de sites publiés atteinte pour ta formule (% autorisé(s), boutiques comprises).', maxs using errcode = 'P0001', hint = 'limite_sites';
    end if;
  end if;
  return new;
end;
$$;
drop trigger if exists sites_enforce_plan on public.sites;
create trigger sites_enforce_plan before insert or update on public.sites
  for each row execute function public.sites_enforce_plan();

-- ═══ 2. Boutiques ═════════════════════════════════════════════════════════════════════════════
-- Se déclenche aussi quand suspended_at change (avant : seulement statut), pour que le serveur ne puisse pas
-- réactiver une boutique au-delà de la limite.
create or replace function public.boutique_enforce_limit() returns trigger
language plpgsql set search_path = public as $$
declare
  formule text;
  maxs integer;
  maxp integer;
  n integer;
  publication boolean;
  reactivation boolean;
begin
  if current_user in ('postgres', 'supabase_admin') then
    return new;
  end if;
  perform pg_advisory_xact_lock(hashtext('boutiques:' || new.proprietaire_id::text));
  formule := coalesce((select plan from public.profiles where id = new.proprietaire_id), 'gratuit');
  publication := new.statut = 'publiee' and (tg_op = 'INSERT' or old.statut is distinct from 'publiee');
  reactivation := tg_op = 'UPDATE' and new.statut = 'publiee' and old.statut = 'publiee'
                  and old.suspended_at is not null and new.suspended_at is null;
  if (publication or reactivation) and not public.plan_can_publish(formule) then
    raise exception 'La publication en ligne n''est pas incluse dans la formule Gratuit.' using errcode = 'P0001', hint = 'publication_formule';
  end if;
  maxs := public.plan_max_sites(formule);
  -- Création (même brouillon) : limite de projets, pour le navigateur (comme avant).
  if current_user in ('authenticated', 'anon') then
    maxp := public.plan_max_projects(formule);
    if tg_op = 'INSERT' and maxp is not null then
      select count(*) into n from public.boutiques where proprietaire_id = new.proprietaire_id;
      if n >= maxp then
        raise exception 'Limite de boutiques atteinte pour ta formule (% autorisée(s)).', maxp using errcode = 'P0001', hint = 'limite_boutiques';
      end if;
    end if;
  end if;
  -- Publication par le navigateur, OU réactivation par n'importe quel rôle (le serveur compris) : limite commune
  -- sites + boutiques, en ne comptant que ce qui est en ligne (suspended_at nul) et pas la ligne elle-même.
  if maxs is not null and new.suspended_at is null and new.statut = 'publiee'
     and (reactivation or (publication and current_user in ('authenticated', 'anon'))) then
    select (select count(*) from public.sites where user_id = new.proprietaire_id and suspended_at is null)
         + (select count(*) from public.boutiques where proprietaire_id = new.proprietaire_id and statut = 'publiee' and suspended_at is null and id <> new.id)
      into n;
    if n >= maxs then
      raise exception 'Limite de sites publiés atteinte pour ta formule (% autorisé(s), boutiques comprises).', maxs using errcode = 'P0001', hint = 'limite_sites';
    end if;
  end if;
  return new;
end;
$$;
drop trigger if exists boutiques_enforce_limit on public.boutiques;
create trigger boutiques_enforce_limit before insert or update of statut, suspended_at on public.boutiques
  for each row execute function public.boutique_enforce_limit();

-- ═══ 3. Expiration des commandes « nouvelle » ═════════════════════════════════════════════════
-- Marqueur d'annulation automatique. Colonnes ajoutées sans toucher aux lignes existantes (nulles).
alter table public.commandes add column if not exists annulee_le timestamptz;
alter table public.commandes add column if not exists annulation_motif text;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'commandes_annulation_motif' and conrelid = 'public.commandes'::regclass) then
    alter table public.commandes add constraint commandes_annulation_motif
      check (annulation_motif is null or annulation_motif in ('expiree_automatiquement')) not valid;
  end if;
end $$;
-- Le commerçant peut lire le marqueur de SES commandes (la politique de lecture 0005 limite déjà aux siennes).
grant select (annulee_le, annulation_motif) on public.commandes to authenticated;

-- Âge par défaut (appel sans argument) : 72 heures. Âge minimum accepté : 1 heure. N'annule QUE les « nouvelle » non payées (un paiement futur
-- ne serait jamais annulé automatiquement). Idempotente : verrou de ligne + filtre de statut, le stock est remis par le
-- déclencheur commande_transition (0005) au passage à « annulee », donc UNE seule fois même si deux appels se chevauchent.
create or replace function public.boutique_expirer_commandes_nouvelles(p_age interval) returns integer
language plpgsql security definer set search_path = public as $$
declare
  n integer;
begin
  if p_age is null or p_age < interval '1 hour' then
    raise exception 'E_AGE_INVALIDE';
  end if;
  with cibles as (
    select id from public.commandes
    where statut = 'nouvelle' and paiement = 'non_payee' and created_at < now() - p_age
    order by id
    for update skip locked
  ), annulees as (
    update public.commandes c
       set statut = 'annulee', annulee_le = now(), annulation_motif = 'expiree_automatiquement'
      from cibles
     where c.id = cibles.id and c.statut = 'nouvelle'
    returning 1
  )
  select count(*) into n from annulees;
  return n;
end;
$$;
revoke all on function public.boutique_expirer_commandes_nouvelles(interval) from public, anon, authenticated;
grant execute on function public.boutique_expirer_commandes_nouvelles(interval) to service_role;

-- Appel sans argument : 72 heures (valeur par défaut, sans modifier la signature de 0007 : rejouer 0007 reste possible).
create or replace function public.boutique_expirer_commandes_nouvelles() returns integer
language sql security definer set search_path = public as $$
  select public.boutique_expirer_commandes_nouvelles(interval '72 hours')
$$;
revoke all on function public.boutique_expirer_commandes_nouvelles() from public, anon, authenticated;
grant execute on function public.boutique_expirer_commandes_nouvelles() to service_role;
