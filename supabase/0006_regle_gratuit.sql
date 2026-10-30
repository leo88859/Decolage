-- Décollage : migration 0006, règle Gratuit / publication (côté base).
-- À exécuter UNE FOIS À LA MAIN dans Supabase : SQL Editor -> New query -> coller -> Run.
-- Rejouable sans risque (idempotente). Ne supprime et ne modifie AUCUNE donnée existante.
-- Prérequis : 0001 à 0005 déjà exécutées, dans l'ordre. Ne modifie pas les fichiers 0004 et 0005 (déjà livrés) :
-- elle remplace seulement des fonctions, des déclencheurs et des politiques par de nouvelles versions.
--
-- Règle du patron :
--  * Gratuit : 1 projet (et 1 boutique en brouillon), création / modification / enregistrement / aperçu OK,
--    PUBLICATION INTERDITE (site comme boutique). Solo : 1 projet, publication autorisée. Pro : 5. Illimité : sans limite.
--  * Un contenu publié par quelqu'un qui n'a plus le droit de publier (rétrogradation, résiliation) n'est plus servi
--    publiquement (404), même si la ligne dit encore « publiée » : le serveur l'applique AUSSI à la lecture (RLS).
--  * Rien n'est supprimé : le contenu reste lisible et modifiable par son propriétaire.
--
-- Les valeurs DOIVENT rester identiques à src/lib/plans.ts (un test compare).

-- ─── 1. Limites ──────────────────────────────────────────────────────────────────────────────
-- Gratuit passe de 0 à 1 projet (décision du patron). Solo 1, Pro 5, Illimité sans limite.
create or replace function public.plan_max_projects(p text) returns integer
language sql immutable set search_path = public as $$
  select case p when 'gratuit' then 1 when 'solo' then 1 when 'pro' then 5 when 'illimite' then null else 1 end
$$;

-- Le droit de PUBLIER sur Internet (sites et boutiques) : toute formule payante, jamais le Gratuit.
create or replace function public.plan_can_publish(p text) returns boolean
language sql immutable set search_path = public as $$
  select p in ('solo', 'pro', 'illimite')
$$;

-- ─── 2. Colonnes ajoutées (aucune donnée touchée) ─────────────────────────────────────────────
-- Boutique suspendue (formule insuffisante) : même principe que sites.suspended_at (0002).
alter table public.boutiques add column if not exists suspended_at timestamptz;
-- Origine du droit marque blanche : 'manuel' (activé à la main, jamais touché par Stripe) ou 'stripe' (option payée).
alter table public.brand_entitlements add column if not exists source text not null default 'manuel';

-- ─── 3. Le propriétaire a-t-il le droit de publier ? (lue dans profiles, jamais fournie par le navigateur) ─
create or replace function public.owner_can_publish(uid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select public.plan_can_publish(coalesce((select plan from public.profiles where id = uid), 'gratuit'))
$$;
revoke all on function public.owner_can_publish(uuid) from public;
grant execute on function public.owner_can_publish(uuid) to anon, authenticated, service_role;

-- ─── 4. Boutiques : création, publication, suspension ─────────────────────────────────────────
-- Créer une boutique (même brouillon) : au plus plan_max_projects boutiques (Gratuit 1, Solo 1, Pro 5, Illimité ∞).
-- La publier : formule payante obligatoire (hint publication_formule, TOUS les rôles sauf l'administrateur SQL),
-- puis elle compte, avec les sites publiés, dans la limite maxSites (hint limite_sites, comptes navigateur).
create or replace function public.boutique_enforce_limit() returns trigger
language plpgsql set search_path = public as $$
declare
  formule text;
  maxs integer;
  maxp integer;
  n integer;
  publication boolean;
begin
  if current_user in ('postgres', 'supabase_admin') then
    return new;
  end if;
  perform pg_advisory_xact_lock(hashtext('boutiques:' || new.proprietaire_id::text));
  formule := coalesce((select plan from public.profiles where id = new.proprietaire_id), 'gratuit');
  publication := new.statut = 'publiee' and (tg_op = 'INSERT' or old.statut is distinct from 'publiee');
  if publication and not public.plan_can_publish(formule) then
    raise exception 'La publication en ligne n''est pas incluse dans la formule Gratuit.' using errcode = 'P0001', hint = 'publication_formule';
  end if;
  if current_user in ('authenticated', 'anon') then
    maxp := public.plan_max_projects(formule);
    if tg_op = 'INSERT' and maxp is not null then
      select count(*) into n from public.boutiques where proprietaire_id = new.proprietaire_id;
      if n >= maxp then
        raise exception 'Limite de boutiques atteinte pour ta formule (% autorisée(s)).', maxp using errcode = 'P0001', hint = 'limite_boutiques';
      end if;
    end if;
    maxs := public.plan_max_sites(formule);
    if publication and maxs is not null then
      select (select count(*) from public.sites where user_id = new.proprietaire_id)
           + (select count(*) from public.boutiques where proprietaire_id = new.proprietaire_id and statut = 'publiee' and id <> new.id)
        into n;
      if n >= maxs then
        raise exception 'Limite de sites publiés atteinte pour ta formule (% autorisé(s), boutiques comprises).', maxs using errcode = 'P0001', hint = 'limite_sites';
      end if;
    end if;
  end if;
  return new;
end;
$$;
drop trigger if exists boutiques_enforce_limit on public.boutiques;
create trigger boutiques_enforce_limit before insert or update of statut on public.boutiques
  for each row execute function public.boutique_enforce_limit();

-- Même garde-fous qu'en 0005 ; en plus, une boutique repassée en brouillon n'est plus « suspendue » (elle n'est plus publiée).
create or replace function public.boutique_garde() returns trigger
language plpgsql set search_path = public as $$
begin
  if tg_op = 'UPDATE' and new.proprietaire_id is distinct from old.proprietaire_id then
    raise exception 'Le propriétaire d''une boutique ne peut pas changer.' using errcode = 'P0001';
  end if;
  if new.statut = 'publiee' and new.published_at is null then
    new.published_at := now();
  end if;
  if new.statut <> 'publiee' then
    new.suspended_at := null;
  end if;
  return new;
end;
$$;
drop trigger if exists boutiques_garde on public.boutiques;
create trigger boutiques_garde before insert or update on public.boutiques
  for each row execute function public.boutique_garde();

-- ─── 5. Sites : publication interdite au Gratuit, même par le serveur (service_role) ──────────────
-- /api/sites écrit avec la clé service_role : cette garde protège même contre un bug ou une requête détournée.
-- Insertion : formule payante requise, puis limite maxSites (sites + boutiques publiées). Mise à jour : un site
-- qui n'est pas suspendu ne peut pas rester/devenir actif pour un compte Gratuit. Le service peut SUSPENDRE.
-- L'administrateur SQL (postgres, supabase_admin) n'est pas bloqué.
create or replace function public.sites_enforce_plan() returns trigger
language plpgsql set search_path = public as $$
declare
  maxs integer;
  n integer;
  formule text;
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
  maxs := public.plan_max_sites(formule);
  if tg_op = 'INSERT' and maxs is not null then
    select (select count(*) from public.sites where user_id = new.user_id)
         + (select count(*) from public.boutiques where proprietaire_id = new.user_id and statut = 'publiee')
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

-- ─── 6. Lecture publique : seulement ce qui est publiable, non suspendu, d'un propriétaire autorisé ──
-- Ancienne URL d'un site/boutique d'un compte devenu Gratuit : plus lisible par le public, même sans passage du webhook.
drop policy if exists "sites : lecture publique" on public.sites;
drop policy if exists "sites : lecture publique des sites publiables" on public.sites;
create policy "sites : lecture publique des sites publiables" on public.sites for select to anon, authenticated
  using (suspended_at is null and public.owner_can_publish(user_id));
drop policy if exists "sites : lecture par son propriétaire" on public.sites;
create policy "sites : lecture par son propriétaire" on public.sites for select to authenticated
  using (auth.uid() = user_id);

create or replace function public.boutique_publiee(b uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.boutiques
    where id = b and statut = 'publiee' and suspended_at is null and public.owner_can_publish(proprietaire_id)
  )
$$;

drop policy if exists "boutique : lecture" on public.boutiques;
create policy "boutique : lecture" on public.boutiques for select to anon, authenticated
  using ((statut = 'publiee' and suspended_at is null and public.owner_can_publish(proprietaire_id)) or proprietaire_id = auth.uid());

-- ─── 7. Commandes : aucune commande sur une boutique non publique (brouillon, suspendue, propriétaire Gratuit) ─
-- boutique_creer_commande() (0005) insère la commande ; ce déclencheur refuse l'insertion avec le même code d'erreur
-- que « boutique introuvable » (la route répond 404). Tout est annulé, le stock n'est pas touché.
create or replace function public.commande_boutique_publiable() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if not exists (
    select 1 from public.boutiques b
    where b.id = new.boutique_id and b.statut = 'publiee' and b.suspended_at is null and public.owner_can_publish(b.proprietaire_id)
  ) then
    raise exception 'E_BOUTIQUE_INTROUVABLE';
  end if;
  return new;
end;
$$;
drop trigger if exists commandes_boutique_publiable on public.commandes;
create trigger commandes_boutique_publiable before insert on public.commandes
  for each row execute function public.commande_boutique_publiable();
