-- Liste d'attente : tables, sécurité (RLS) et fonction d'inscription publique.
-- À exécuter une fois dans Supabase (SQL Editor). Ne supprime aucune donnée.

create table if not exists public.listes (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  nom text not null default 'Liste d''attente' check (char_length(nom) between 1 and 120),
  created_at timestamptz not null default now()
);

create table if not exists public.inscriptions (
  id bigint generated always as identity primary key,
  liste_id uuid not null references public.listes (id) on delete cascade,
  email text not null check (char_length(email) <= 254 and email = lower(email) and email ~ '^[^\s@]+@[^\s@]+\.[^\s@]{2,}$'),
  donnees jsonb not null default '{}'::jsonb check (jsonb_typeof(donnees) = 'object' and pg_column_size(donnees) <= 2000),
  created_at timestamptz not null default now(),
  -- Une seule inscription par adresse et par liste (adresses enregistrées en minuscules).
  unique (liste_id, email)
);
create index if not exists listes_owner_idx on public.listes (owner_id);

alter table public.listes enable row level security;
alter table public.inscriptions enable row level security;

-- Les visiteurs (anon) n'ont aucun accès direct aux tables : ils passent par public.inscrire().
revoke all on table public.listes, public.inscriptions from anon;
revoke all on table public.inscriptions from authenticated;
grant select, insert, update, delete on table public.listes to authenticated;
grant select, delete on table public.inscriptions to authenticated;

-- Chaque propriétaire ne voit et ne modifie que ses propres listes.
drop policy if exists "listes du proprietaire" on public.listes;
create policy "listes du proprietaire" on public.listes
  for all to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));

-- Et seulement les inscriptions de ses listes (lecture et suppression).
drop policy if exists "inscriptions lues par le proprietaire" on public.inscriptions;
create policy "inscriptions lues par le proprietaire" on public.inscriptions
  for select to authenticated
  using (exists (select 1 from public.listes l where l.id = liste_id and l.owner_id = (select auth.uid())));
drop policy if exists "inscriptions supprimees par le proprietaire" on public.inscriptions;
create policy "inscriptions supprimees par le proprietaire" on public.inscriptions
  for delete to authenticated
  using (exists (select 1 from public.listes l where l.id = liste_id and l.owner_id = (select auth.uid())));

-- Inscription publique : vérifie l'adresse et la liste, ignore les doublons.
-- Ne révèle jamais si une adresse était déjà inscrite (même réponse « ok »).
create or replace function public.inscrire(p_liste uuid, p_email text, p_donnees jsonb default '{}'::jsonb)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_email text := lower(trim(coalesce(p_email, '')));
begin
  if char_length(v_email) > 254 or v_email !~ '^[^\s@]+@[^\s@]+\.[^\s@]{2,}$' then
    return 'email_invalide';
  end if;
  if p_donnees is null or jsonb_typeof(p_donnees) <> 'object' or pg_column_size(p_donnees) > 2000 then
    return 'donnees_invalides';
  end if;
  if not exists (select 1 from public.listes where id = p_liste) then
    return 'liste_inconnue';
  end if;
  insert into public.inscriptions (liste_id, email, donnees)
  values (p_liste, v_email, p_donnees)
  on conflict (liste_id, email) do nothing;
  return 'ok';
end;
$$;

revoke all on function public.inscrire(uuid, text, jsonb) from public;
grant execute on function public.inscrire(uuid, text, jsonb) to anon, authenticated;
