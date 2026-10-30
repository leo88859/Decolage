-- Décollage : migration 0004, limites de formule appliquées par la base (côté serveur).
-- À exécuter UNE FOIS À LA MAIN dans Supabase : SQL Editor -> New query -> coller -> Run.
-- Rejouable sans risque (idempotente). Ne supprime, ne modifie et ne bloque en lecture AUCUN projet existant.
-- Prérequis : 0001, 0002 et 0003 déjà exécutées. À exécuter AVANT de déployer le code qui lit la formule
-- pour la marque blanche (le code reste compatible si la migration manque : seul le trigger est alors absent).
--
-- Les valeurs ci-dessous DOIVENT rester identiques à src/lib/plans.ts (un test compare les deux).

-- ─── 1. Table des limites par formule (lecture seule, miroir de plans.ts) ─
create or replace function public.plan_max_projects(p text) returns integer
language sql immutable set search_path = public as $$
  select case p when 'solo' then 1 when 'pro' then 5 when 'illimite' then null else 0 end
$$;

-- Droits des formules payantes (modelesPremium, exportFichiers, duplication, personnalisationAvancee,
-- plansDetailles) : accordés à toute formule payante, refusés au Gratuit (comme plans.ts).
create or replace function public.plan_allows(p text, feature text) returns boolean
language sql immutable set search_path = public as $$
  select p in ('solo', 'pro', 'illimite')
    and feature in ('modelesPremium', 'exportFichiers', 'duplication', 'personnalisationAvancee', 'plansDetailles')
$$;

-- ─── 2. Formule de l'utilisateur connecté (lue dans profiles, jamais fournie par le navigateur) ─
create or replace function public.my_plan() returns text
language sql stable security definer set search_path = public as $$
  select coalesce((select plan from public.profiles where id = auth.uid()), 'gratuit')
$$;

create or replace function public.my_plan_allows(feature text) returns boolean
language sql stable security definer set search_path = public as $$
  select public.plan_allows(public.my_plan(), feature)
$$;

-- Marque blanche : Gratuit non ; Pro et Illimité inclus ; Solo seulement avec l'option activée
-- (brand_entitlements.enabled). Un droit activé sur un compte Gratuit ne donne rien.
create or replace function public.my_white_label_allowed() returns boolean
language sql stable security definer set search_path = public as $$
  select case public.my_plan()
    when 'pro' then true
    when 'illimite' then true
    when 'solo' then coalesce((select enabled from public.brand_entitlements where user_id = auth.uid()), false)
    else false
  end
$$;

revoke all on function public.my_plan(), public.my_plan_allows(text), public.my_white_label_allowed() from public, anon;
grant execute on function public.my_plan(), public.my_plan_allows(text), public.my_white_label_allowed() to authenticated;

-- ─── 3. Nombre de projets : contrôle à l'insertion ────────────────────────
-- Ne s'applique qu'aux comptes connectés depuis le navigateur (rôles authenticated / anon). Le serveur
-- (service_role) et l'administrateur (SQL Editor) ne sont pas bloqués.
-- Seule la CRÉATION d'une ligne neuve est contrôlée : modifier ou re-synchroniser un projet existant
-- (y compris par upsert) reste toujours permis, même au-delà de la limite après une résiliation.
create or replace function public.enforce_project_limit() returns trigger
language plpgsql set search_path = public as $$
declare
  maxp integer;
  n integer;
begin
  if current_user not in ('authenticated', 'anon') then
    return new;
  end if;
  -- Le projet existe déjà : c'est une mise à jour (upsert), pas une création.
  if exists (select 1 from public.projects where user_id = new.user_id and id = new.id) then
    return new;
  end if;
  -- Une seule création à la fois par utilisateur (évite de passer la limite avec des insertions simultanées).
  perform pg_advisory_xact_lock(hashtext('projects:' || new.user_id::text));
  maxp := public.plan_max_projects(public.my_plan());
  if maxp is null then
    return new;
  end if;
  select count(*) into n from public.projects where user_id = new.user_id;
  if n >= maxp then
    raise exception 'Limite de projets atteinte pour ta formule (% autorisé(s)).', maxp
      using errcode = 'P0001', hint = 'limite_projets';
  end if;
  return new;
end;
$$;
drop trigger if exists projects_enforce_limit on public.projects;
create trigger projects_enforce_limit before insert on public.projects
  for each row execute function public.enforce_project_limit();

-- ─── 4. Profils : le navigateur ne peut ni créer, ni supprimer, ni changer la formule ─
-- (déjà vrai par la RLS et le grant sur favorites seulement ; on retire aussi les droits inutiles.)
revoke insert, delete on public.profiles from anon, authenticated;
revoke update on public.profiles from anon;
