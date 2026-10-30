-- Décollage : migration 0002, mise en conformité et protection.
-- À exécuter UNE FOIS À LA MAIN dans Supabase : SQL Editor → New query → coller → Run.
-- Elle peut être rejouée sans risque (idempotente) et ne supprime aucune donnée.
-- À exécuter AVANT de mettre en ligne la nouvelle version du site (le paiement demande la table
-- legal_acceptances ; les autres changements sont sans effet tant que le code n'est pas déployé).
-- Prérequis : 0001_schema.sql déjà exécutée.

-- ─── 1. Sites : écriture réservée au serveur (audit I-1) ─────────────────
-- Avant : un utilisateur connecté pouvait écrire directement dans « sites » avec sa clé publique et
-- contourner la limite de sites de sa formule, la liste d'adresses réservées et la validation du contenu.
-- Après : seul le serveur (clé service_role, via /api/sites) écrit. La lecture publique reste en place :
-- un site publié est public par définition.
drop policy if exists "sites : gestion par leur propriétaire" on public.sites;
revoke insert, update, delete on public.sites from anon, authenticated;
-- (Le service_role contourne la RLS et garde tous ses droits : /api/sites continue de fonctionner.)

-- ─── 2. Sites : suspension (audit I-7) ───────────────────────────────────
-- Un site « suspendu » (abonnement résilié, au-delà de la limite de la formule) n'est plus servi et
-- n'accepte plus d'inscription, mais son contenu et sa liste d'attente sont conservés.
-- Posé et retiré par le serveur (webhook Stripe). Si l'abonnement reprend, le site revient.
alter table public.sites add column if not exists suspended_at timestamptz;

-- Plus d'inscription publique sur un site suspendu (audit I-7 : « stopper la liste d'attente »).
drop policy if exists "liste : inscription publique" on public.waitlist;
create policy "liste : inscription publique" on public.waitlist
  for insert to anon, authenticated
  with check (exists (select 1 from public.sites s where s.slug = waitlist.slug and s.suspended_at is null));

-- ─── 3. Supprimer un projet dépublie son site (audit I-8) ────────────────
-- Quand une ligne de « projects » disparaît, le site publié correspondant est supprimé, et avec lui sa
-- liste d'attente (suppression en cascade déjà prévue). Fonctionne aussi pour la suppression d'un compte.
create or replace function public.unpublish_site_of_deleted_project() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  delete from public.sites where user_id = old.user_id and project_id = old.id;
  return old;
end;
$$;
revoke all on function public.unpublish_site_of_deleted_project() from public, anon, authenticated;
drop trigger if exists projects_unpublish_site on public.projects;
create trigger projects_unpublish_site after delete on public.projects
  for each row execute function public.unpublish_site_of_deleted_project();

-- ─── 4. Preuve d'acceptation des documents légaux ────────────────────────
-- Une ligne par document accepté : qui, quel document, quelle version, quand, dans quel contexte
-- (inscription ou achat) et, pour un achat, si la demande d'accès immédiat avec renonciation au droit de
-- rétractation a été cochée. Volontairement SANS adresse IP (minimisation) : la date, la version et les
-- cases cochées servent de preuve. Écriture uniquement par le serveur ; lecture par le propriétaire.
-- Suppression du compte = suppression de ces lignes (cascade). Durée de conservation : voir inventaire-donnees.md.
create table if not exists public.legal_acceptances (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  document text not null check (document in ('cgu', 'cgv', 'confidentialite')),
  version text not null check (char_length(version) between 1 and 40),
  accepted_at timestamptz not null default now(),
  contexte text not null check (contexte in ('inscription', 'achat')),
  renonciation_retractation boolean not null default false,
  formule text check (formule is null or formule in ('solo', 'pro', 'illimite'))
);
alter table public.legal_acceptances enable row level security;

drop policy if exists "acceptations : lecture par leur propriétaire" on public.legal_acceptances;
create policy "acceptations : lecture par leur propriétaire" on public.legal_acceptances
  for select using (auth.uid() = user_id);
-- Aucune politique d'écriture : le navigateur ne peut rien insérer, modifier ni effacer.
revoke insert, update, delete on public.legal_acceptances from anon, authenticated;
revoke select on public.legal_acceptances from anon;

create index if not exists legal_acceptances_user_idx on public.legal_acceptances (user_id, document, accepted_at desc);

-- ─── 5. Plafonds de taille (audit M-9) ───────────────────────────────────
-- Évite qu'un compte remplisse la base par écriture directe. Marqués « not valid » : les lignes
-- existantes ne sont pas contrôlées (aucun risque de blocage), seules les nouvelles écritures le sont.
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'projects_data_taille') then
    alter table public.projects add constraint projects_data_taille check (pg_column_size(data) < 3000000) not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'profiles_favorites_taille') then
    alter table public.profiles add constraint profiles_favorites_taille check (coalesce(array_length(favorites, 1), 0) <= 500) not valid;
  end if;
end $$;
