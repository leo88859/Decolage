-- Décollage : fondations de la marque blanche (droit d'accès + configuration de marque).
-- NON EXÉCUTÉE automatiquement. À lancer à la main : Supabase -> SQL Editor -> New query -> coller -> Run.
-- Indépendante de 0001 et 0002 (ne dépend que de auth.users). Rejouable sans perte de données.
--
-- Principe de sécurité :
--  * le propriétaire peut LIRE son droit et sa marque (RLS) ;
--  * personne côté navigateur (rôles anon / authenticated) ne peut ÉCRIRE : tout passe par l'API serveur
--    (clé service_role) ou par Léo en SQL. Un utilisateur ne peut donc ni s'activer le droit, ni contourner l'API.
--  * les noms de colonnes évitent le mot réservé « primary » : color_primary, etc.

-- ─── Droit d'utiliser la marque blanche ──────────────────────────────────
create table if not exists public.brand_entitlements (
  user_id uuid primary key references auth.users (id) on delete cascade,
  enabled boolean not null default false,
  enabled_at timestamptz,
  note text check (note is null or char_length(note) <= 500)
);
alter table public.brand_entitlements enable row level security;

drop policy if exists "marque : droit lisible par son propriétaire" on public.brand_entitlements;
create policy "marque : droit lisible par son propriétaire" on public.brand_entitlements
  for select using (auth.uid() = user_id);

revoke all on public.brand_entitlements from anon, authenticated;
grant select on public.brand_entitlements to authenticated;

-- Date d'activation renseignée automatiquement quand le droit passe à vrai.
create or replace function public.brand_entitlements_stamp() returns trigger
language plpgsql set search_path = public as $$
begin
  if new.enabled and (tg_op = 'INSERT' or not old.enabled) and new.enabled_at is null then
    new.enabled_at := now();
  end if;
  return new;
end;
$$;
drop trigger if exists brand_entitlements_stamp on public.brand_entitlements;
create trigger brand_entitlements_stamp before insert or update on public.brand_entitlements
  for each row execute function public.brand_entitlements_stamp();

-- ─── Configuration de marque (une par utilisateur) ───────────────────────
create table if not exists public.brand_configs (
  user_id uuid primary key references auth.users (id) on delete cascade,
  name text not null,
  color_primary text not null,
  color_secondary text not null,
  color_accent text not null,
  color_surface text not null,
  color_text text not null,
  logo_data text,
  favicon_data text,
  version integer not null default 1 check (version >= 1),
  previous jsonb,
  updated_at timestamptz not null default now(),
  constraint brand_name_len check (char_length(name) between 1 and 40),
  constraint brand_name_no_tags check (name !~ '[<>]' and name !~ '[[:cntrl:]]'),
  constraint brand_color_primary_hex check (color_primary ~ '^#[0-9a-f]{6}$'),
  constraint brand_color_secondary_hex check (color_secondary ~ '^#[0-9a-f]{6}$'),
  constraint brand_color_accent_hex check (color_accent ~ '^#[0-9a-f]{6}$'),
  constraint brand_color_surface_hex check (color_surface ~ '^#[0-9a-f]{6}$'),
  constraint brand_color_text_hex check (color_text ~ '^#[0-9a-f]{6}$'),
  -- PNG, JPEG ou WebP en data URL (jamais SVG). 200 Ko binaires = environ 266 700 caractères en base64.
  constraint brand_logo_format check (logo_data is null or (logo_data ~ '^data:image/(png|jpeg|webp);base64,[A-Za-z0-9+/]+=*$' and char_length(logo_data) <= 270000)),
  -- Favicon : PNG seulement, 50 Ko binaires = environ 66 700 caractères en base64.
  constraint brand_favicon_format check (favicon_data is null or (favicon_data ~ '^data:image/png;base64,[A-Za-z0-9+/]+=*$' and char_length(favicon_data) <= 70000)),
  constraint brand_previous_size check (previous is null or pg_column_size(previous) < 800000)
);
alter table public.brand_configs enable row level security;

drop policy if exists "marque : lecture par son propriétaire" on public.brand_configs;
create policy "marque : lecture par son propriétaire" on public.brand_configs
  for select using (auth.uid() = user_id);

-- Aucune écriture depuis le navigateur : l'API serveur (service_role) écrit après avoir vérifié le droit.
revoke all on public.brand_configs from anon, authenticated;
grant select on public.brand_configs to authenticated;

-- ─── Activer un client (à exécuter à la main, une ligne par client) ──────
-- insert into public.brand_entitlements (user_id, enabled, note)
-- values ('UUID-DU-CLIENT', true, 'Accord du JJ/MM/AAAA, formule à définir')
-- on conflict (user_id) do update set enabled = true, note = excluded.note;
--
-- Désactiver (résiliation) :
-- update public.brand_entitlements set enabled = false where user_id = 'UUID-DU-CLIENT';
