-- Décollage : schéma de base (comptes, projets synchronisés, sites publiés, listes d'attente, abonnement).
-- À exécuter une fois dans Supabase : SQL Editor → New query → coller → Run.

-- ─── Profils ─────────────────────────────────────────────────────────────
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  plan text not null default 'gratuit' check (plan in ('gratuit', 'solo', 'pro', 'illimite')),
  favorites text[] not null default '{}',
  stripe_customer_id text unique,
  stripe_subscription_id text,
  subscription_status text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.profiles enable row level security;

drop policy if exists "profil : lecture par son propriétaire" on public.profiles;
create policy "profil : lecture par son propriétaire" on public.profiles
  for select using (auth.uid() = id);
drop policy if exists "profil : favoris modifiables par son propriétaire" on public.profiles;
create policy "profil : favoris modifiables par son propriétaire" on public.profiles
  for update using (auth.uid() = id) with check (auth.uid() = id);

-- L'utilisateur ne peut modifier QUE ses favoris : la formule et Stripe sont gérés par le serveur.
revoke update on public.profiles from authenticated, anon;
grant update (favorites, updated_at) on public.profiles to authenticated;

-- Création automatique du profil à l'inscription.
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id) values (new.id) on conflict (id) do nothing;
  return new;
end;
$$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- ─── Projets (copie en ligne des projets du navigateur) ─────────────────
create table if not exists public.projects (
  user_id uuid not null references auth.users (id) on delete cascade,
  id text not null check (char_length(id) between 4 and 32),
  data jsonb not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, id)
);
alter table public.projects enable row level security;
drop policy if exists "projets : accès par leur propriétaire" on public.projects;
create policy "projets : accès par leur propriétaire" on public.projects
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ─── Sites publiés ───────────────────────────────────────────────────────
create table if not exists public.sites (
  slug text primary key check (slug ~ '^[a-z0-9]([a-z0-9-]{1,38}[a-z0-9])$'),
  user_id uuid not null references auth.users (id) on delete cascade,
  project_id text not null,
  data jsonb not null,
  published_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, project_id)
);
alter table public.sites enable row level security;
-- Un site publié est public par définition : tout le monde peut le lire.
drop policy if exists "sites : lecture publique" on public.sites;
create policy "sites : lecture publique" on public.sites for select using (true);
drop policy if exists "sites : gestion par leur propriétaire" on public.sites;
create policy "sites : gestion par leur propriétaire" on public.sites
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ─── Listes d'attente ────────────────────────────────────────────────────
create table if not exists public.waitlist (
  id bigint generated always as identity primary key,
  slug text not null references public.sites (slug) on delete cascade on update cascade,
  email text not null check (char_length(email) between 5 and 254),
  created_at timestamptz not null default now(),
  unique (slug, email)
);
alter table public.waitlist enable row level security;
-- Les visiteurs peuvent s'inscrire (insertion seulement, jamais de lecture).
drop policy if exists "liste : inscription publique" on public.waitlist;
create policy "liste : inscription publique" on public.waitlist
  for insert to anon, authenticated with check (exists (select 1 from public.sites s where s.slug = waitlist.slug));
-- Seul le propriétaire du site voit et supprime ses inscrits.
drop policy if exists "liste : lecture par le propriétaire du site" on public.waitlist;
create policy "liste : lecture par le propriétaire du site" on public.waitlist
  for select using (exists (select 1 from public.sites s where s.slug = waitlist.slug and s.user_id = auth.uid()));
drop policy if exists "liste : suppression par le propriétaire du site" on public.waitlist;
create policy "liste : suppression par le propriétaire du site" on public.waitlist
  for delete using (exists (select 1 from public.sites s where s.slug = waitlist.slug and s.user_id = auth.uid()));

create index if not exists waitlist_slug_idx on public.waitlist (slug, created_at desc);
