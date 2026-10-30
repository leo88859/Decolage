-- Décollage : migration 0005, boutique V1 (catalogue, stock, commandes SANS paiement en ligne).
-- À exécuter UNE FOIS À LA MAIN dans Supabase : SQL Editor -> New query -> coller -> Run.
-- Rejouable sans risque (idempotente). Ne supprime et ne modifie AUCUNE donnée existante.
-- Prérequis : 0001 à 0004 déjà exécutées.
--
-- Principes :
--  * Le commerçant (authenticated) lit/écrit uniquement SA boutique, ses produits, ses commandes (RLS).
--  * Le public (anon) lit uniquement le catalogue des boutiques publiées (produits et variantes actifs).
--  * Personne, hors commerçant propriétaire, ne lit une commande. Le client suit sa commande par un jeton
--    secret (seul son hachage est stocké) via une fonction réservée au serveur (service_role).
--  * Une commande ne se crée QUE par boutique_creer_commande() (appelée par la route API avec service_role) :
--    prix et stock sont relus en base, jamais pris du navigateur.
--  * Aucun paiement en ligne : commandes.paiement vaut toujours 'non_payee'.

-- ─── 1. Limite de formule : sites publiés (miroir de plans.ts maxSites) ───────────────────────
create or replace function public.plan_max_sites(p text) returns integer
language sql immutable set search_path = public as $$
  select case p when 'solo' then 1 when 'pro' then 5 when 'illimite' then null else 0 end
$$;

-- ─── 2. Tables ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.boutiques (
  id uuid primary key default gen_random_uuid(),
  proprietaire_id uuid not null references auth.users (id) on delete cascade,
  slug text not null unique check (slug ~ '^[a-z0-9]([a-z0-9-]{1,38}[a-z0-9])$'),
  nom text not null check (char_length(nom) between 1 and 80),
  description text not null default '' check (char_length(description) <= 1000),
  couleur_principale text not null default '#2f5bff' check (couleur_principale ~ '^#[0-9a-f]{6}$'),
  couleur_accent text not null default '#ff6b4a' check (couleur_accent ~ '^#[0-9a-f]{6}$'),
  logo text check (logo is null or (char_length(logo) <= 500 and logo ~ '^https://')),
  adresse text not null default '' check (char_length(adresse) <= 200),
  whatsapp text check (whatsapp is null or whatsapp ~ '^\+?[0-9]{6,15}$'),
  email text check (email is null or (char_length(email) <= 254 and email ~ '^[^\s@]+@[^\s@]+\.[^\s@]{2,}$')),
  telephone text check (telephone is null or telephone ~ '^\+?[0-9]{6,15}$'),
  -- modes de commande proposés : retrait, livraison, contact (le client écrit, rien n'est réservé)
  modes text[] not null default '{retrait}'
    check (cardinality(modes) between 1 and 3 and modes <@ array['retrait', 'livraison', 'contact']::text[]),
  statut text not null default 'brouillon' check (statut in ('brouillon', 'publiee')),
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists boutiques_proprietaire_idx on public.boutiques (proprietaire_id);

create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  boutique_id uuid not null references public.boutiques (id) on delete cascade,
  nom text not null check (char_length(nom) between 1 and 60),
  position integer not null default 0 check (position between 0 and 10000),
  created_at timestamptz not null default now(),
  unique (id, boutique_id),
  unique (boutique_id, nom)
);

create table if not exists public.produits (
  id uuid primary key default gen_random_uuid(),
  boutique_id uuid not null references public.boutiques (id) on delete cascade,
  categorie_id uuid,
  titre text not null check (char_length(titre) between 1 and 120),
  description text not null default '' check (char_length(description) <= 2000),
  prix_centimes integer not null check (prix_centimes between 0 and 99999999),
  images text[] not null default '{}' check (cardinality(images) <= 5),
  actif boolean not null default true,
  position integer not null default 0 check (position between 0 and 100000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, boutique_id),
  -- la catégorie doit appartenir à la même boutique ; supprimer la catégorie détache seulement le produit
  foreign key (categorie_id, boutique_id) references public.categories (id, boutique_id) on delete set null (categorie_id)
);
create index if not exists produits_boutique_idx on public.produits (boutique_id, position);

create table if not exists public.variantes (
  id uuid primary key default gen_random_uuid(),
  produit_id uuid not null,
  boutique_id uuid not null,
  nom text not null check (char_length(nom) between 1 and 80),
  stock integer not null default 0 check (stock between 0 and 1000000),
  actif boolean not null default true,
  position integer not null default 0 check (position between 0 and 1000),
  created_at timestamptz not null default now(),
  foreign key (produit_id, boutique_id) references public.produits (id, boutique_id) on delete cascade,
  unique (produit_id, nom)
);
create index if not exists variantes_boutique_idx on public.variantes (boutique_id);

create table if not exists public.commandes (
  id uuid primary key default gen_random_uuid(),
  ref text not null unique,                                   -- identifiant public lisible, ex. CMD-3F9A1C2B
  boutique_id uuid not null references public.boutiques (id) on delete cascade,
  cle_idempotence text not null check (cle_idempotence ~ '^[A-Za-z0-9_-]{16,64}$'),
  client_nom text not null check (char_length(client_nom) between 1 and 80),
  client_email text check (client_email is null or char_length(client_email) <= 254),
  client_telephone text check (client_telephone is null or char_length(client_telephone) <= 20),
  adresse_livraison text not null default '' check (char_length(adresse_livraison) <= 300),
  note text not null default '' check (char_length(note) <= 500),
  mode text not null check (mode in ('retrait', 'livraison', 'contact')),
  statut text not null default 'nouvelle' check (statut in ('nouvelle', 'confirmee', 'prete', 'terminee', 'annulee')),
  total_centimes bigint not null default 0 check (total_centimes >= 0),
  -- Aucun paiement en ligne : la contrainte interdit toute autre valeur (jamais « payée »).
  paiement text not null default 'non_payee' check (paiement = 'non_payee'),
  jeton_hash text not null,                                   -- sha256 du jeton de suivi (le jeton lui-même n'est jamais stocké)
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (boutique_id, cle_idempotence)
);
create index if not exists commandes_boutique_idx on public.commandes (boutique_id, created_at desc);

create table if not exists public.lignes_commande (
  id uuid primary key default gen_random_uuid(),
  commande_id uuid not null references public.commandes (id) on delete cascade,
  variante_id uuid references public.variantes (id) on delete set null,
  produit_titre text not null,                                -- copie au moment de la commande
  variante_nom text not null,
  prix_unitaire_centimes integer not null check (prix_unitaire_centimes >= 0),
  quantite integer not null check (quantite between 1 and 99)
);
create index if not exists lignes_commande_idx on public.lignes_commande (commande_id);

-- ─── 3. Fonctions d'aide pour la RLS (security definer : pas de récursion entre politiques) ───
create or replace function public.boutique_possedee(b uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.boutiques where id = b and proprietaire_id = auth.uid())
$$;
create or replace function public.boutique_publiee(b uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.boutiques where id = b and statut = 'publiee')
$$;
create or replace function public.produit_actif(p uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.produits where id = p and actif)
$$;
revoke all on function public.boutique_possedee(uuid), public.boutique_publiee(uuid), public.produit_actif(uuid) from public;
grant execute on function public.boutique_possedee(uuid), public.boutique_publiee(uuid), public.produit_actif(uuid) to anon, authenticated, service_role;

-- ─── 4. Triggers ───────────────────────────────────────────────────────────────────────────
create or replace function public.boutique_touch() returns trigger
language plpgsql set search_path = public as $$
begin
  new.updated_at := now();
  return new;
end;
$$;
drop trigger if exists boutiques_touch on public.boutiques;
create trigger boutiques_touch before update on public.boutiques for each row execute function public.boutique_touch();
drop trigger if exists produits_touch on public.produits;
create trigger produits_touch before update on public.produits for each row execute function public.boutique_touch();
drop trigger if exists commandes_touch on public.commandes;
create trigger commandes_touch before update on public.commandes for each row execute function public.boutique_touch();

-- Limites de formule : seulement pour les comptes connectés depuis le navigateur (comme les projets en 0004) ;
-- le serveur (service_role) et l'administrateur SQL ne sont pas bloqués.
--  * créer une boutique (même brouillon) : au plus plan_max_sites boutiques (Gratuit : 0, comme les sites) ;
--  * publier une boutique : elle compte, avec les sites publiés, dans la limite maxSites de la formule.
-- Réduire sa formule ne retire rien : les boutiques existantes restent lisibles et modifiables.
create or replace function public.boutique_enforce_limit() returns trigger
language plpgsql set search_path = public as $$
declare
  maxs integer;
  n integer;
  publication boolean;
begin
  if current_user not in ('authenticated', 'anon') then
    return new;
  end if;
  perform pg_advisory_xact_lock(hashtext('boutiques:' || new.proprietaire_id::text));
  maxs := public.plan_max_sites(coalesce((select plan from public.profiles where id = new.proprietaire_id), 'gratuit'));
  if maxs is null then
    return new;
  end if;
  if tg_op = 'INSERT' then
    select count(*) into n from public.boutiques where proprietaire_id = new.proprietaire_id;
    if n >= maxs then
      raise exception 'Limite de boutiques atteinte pour ta formule (% autorisée(s)).', maxs using errcode = 'P0001', hint = 'limite_boutiques';
    end if;
  end if;
  publication := new.statut = 'publiee' and (tg_op = 'INSERT' or old.statut is distinct from 'publiee');
  if publication then
    select (select count(*) from public.sites where user_id = new.proprietaire_id)
         + (select count(*) from public.boutiques where proprietaire_id = new.proprietaire_id and statut = 'publiee' and id <> new.id)
      into n;
    if n >= maxs then
      raise exception 'Limite de sites publiés atteinte pour ta formule (% autorisé(s), boutiques comprises).', maxs using errcode = 'P0001', hint = 'limite_sites';
    end if;
  end if;
  return new;
end;
$$;
drop trigger if exists boutiques_enforce_limit on public.boutiques;
create trigger boutiques_enforce_limit before insert or update of statut on public.boutiques
  for each row execute function public.boutique_enforce_limit();

-- Date de première publication + propriétaire non modifiable (garde-fou en plus des droits de colonnes).
create or replace function public.boutique_garde() returns trigger
language plpgsql set search_path = public as $$
begin
  if tg_op = 'UPDATE' and new.proprietaire_id is distinct from old.proprietaire_id then
    raise exception 'Le propriétaire d''une boutique ne peut pas changer.' using errcode = 'P0001';
  end if;
  if new.statut = 'publiee' and new.published_at is null then
    new.published_at := now();
  end if;
  return new;
end;
$$;
drop trigger if exists boutiques_garde on public.boutiques;
create trigger boutiques_garde before insert or update on public.boutiques
  for each row execute function public.boutique_garde();

-- Statuts de commande : nouvelle -> confirmee -> prete -> terminee ; annulation possible avant « terminee ».
-- terminee et annulee sont définitifs. Une annulation remet les quantités en stock (une seule fois).
create or replace function public.commande_transition() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.statut = old.statut then
    return new;
  end if;
  if not (
       (old.statut = 'nouvelle'  and new.statut in ('confirmee', 'annulee'))
    or (old.statut = 'confirmee' and new.statut in ('prete', 'annulee'))
    or (old.statut = 'prete'     and new.statut in ('terminee', 'annulee'))
  ) then
    raise exception 'Changement de statut impossible : % vers %.', old.statut, new.statut using errcode = 'P0001', hint = 'statut_invalide';
  end if;
  if new.statut = 'annulee' then
    update public.variantes v set stock = v.stock + l.quantite
      from public.lignes_commande l where l.commande_id = old.id and l.variante_id = v.id;
  end if;
  return new;
end;
$$;
drop trigger if exists commandes_transition on public.commandes;
create trigger commandes_transition before update of statut on public.commandes
  for each row execute function public.commande_transition();

-- ─── 5. Création de commande (SEULE voie ; appelée par la route API avec la clé service_role) ───
-- Relit prix et stock en base, recalcule le total, refuse boutique non publiée / produit inactif /
-- quantité invalide / stock insuffisant, décrémente le stock sous verrou (pas de survente), et rejoue
-- sans effet une commande déjà reçue avec la même clé d'idempotence. Tout ou rien (une seule transaction).
-- Erreurs : message commençant par un code E_… (la route le traduit).
create or replace function public.boutique_creer_commande(p_slug text, p_cle text, p_client jsonb, p_mode text, p_lignes jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  b public.boutiques;
  ex public.commandes;
  l record;
  v record;
  cid uuid := gen_random_uuid();
  cref text;
  token text;
  total bigint := 0;
  nom text := btrim(coalesce(p_client ->> 'nom', ''));
  email text := nullif(btrim(coalesce(p_client ->> 'email', '')), '');
  tel text := nullif(btrim(coalesce(p_client ->> 'telephone', '')), '');
  adresse text := btrim(coalesce(p_client ->> 'adresse', ''));
  note text := btrim(coalesce(p_client ->> 'note', ''));
  tries integer := 0;
begin
  if p_cle is null or p_cle !~ '^[A-Za-z0-9_-]{16,64}$' then
    raise exception 'E_CLE_INVALIDE';
  end if;
  select * into b from public.boutiques where slug = p_slug and statut = 'publiee';
  if not found then
    raise exception 'E_BOUTIQUE_INTROUVABLE';
  end if;

  -- Deux envois simultanés de la même commande : le second attend le premier, puis la retrouve.
  perform pg_advisory_xact_lock(hashtext('commande:' || b.id::text || ':' || p_cle));
  select * into ex from public.commandes where boutique_id = b.id and cle_idempotence = p_cle;
  if found then
    return jsonb_build_object('ref', ex.ref, 'statut', ex.statut, 'total_centimes', ex.total_centimes,
                              'paiement', ex.paiement, 'mode', ex.mode, 'rejouee', true);
  end if;

  if p_mode is null or not (p_mode = any (b.modes)) then
    raise exception 'E_MODE_INVALIDE';
  end if;
  if char_length(nom) not between 1 and 80 or char_length(adresse) > 300 or char_length(note) > 500
     or (email is not null and (char_length(email) > 254 or email !~ '^[^\s@]+@[^\s@]+\.[^\s@]{2,}$'))
     or (tel is not null and tel !~ '^\+?[0-9 ().-]{6,20}$')
     or (email is null and tel is null)
     or (p_mode = 'livraison' and adresse = '') then
    raise exception 'E_CLIENT_INVALIDE';
  end if;
  if p_lignes is null or jsonb_typeof(p_lignes) <> 'array' or jsonb_array_length(p_lignes) not between 1 and 20 then
    raise exception 'E_QUANTITE_INVALIDE';
  end if;
  if exists (
    select 1 from jsonb_array_elements(p_lignes) e
    where jsonb_typeof(e) <> 'object' or jsonb_typeof(e -> 'quantite') is distinct from 'number' or coalesce(e ->> 'quantite', '') !~ '^[0-9]{1,2}$'
       or coalesce(e ->> 'variante_id', '') !~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
  ) or exists (
    select 1 from jsonb_array_elements(p_lignes) e where (e ->> 'quantite')::int < 1
  ) then
    raise exception 'E_QUANTITE_INVALIDE';
  end if;
  -- Anti-inondation : au plus 100 commandes par heure et par boutique.
  if (select count(*) from public.commandes where boutique_id = b.id and created_at > now() - interval '1 hour') >= 100 then
    raise exception 'E_TROP_DE_COMMANDES';
  end if;

  token := replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');
  loop
    cref := 'CMD-' || upper(substr(md5(random()::text || clock_timestamp()::text), 1, 8));
    exit when not exists (select 1 from public.commandes where ref = cref);
    tries := tries + 1;
    if tries > 10 then raise exception 'E_REF'; end if;
  end loop;

  insert into public.commandes (id, ref, boutique_id, cle_idempotence, client_nom, client_email, client_telephone,
                                adresse_livraison, note, mode, jeton_hash)
  values (cid, cref, b.id, p_cle, nom, email, tel, adresse, note, p_mode,
          encode(sha256(convert_to(token, 'UTF8')), 'hex'));

  -- Variantes verrouillées dans l'ordre de leur identifiant (évite les blocages croisés entre commandes).
  for l in
    select (e ->> 'variante_id')::uuid as vid, sum((e ->> 'quantite')::int) as q
    from jsonb_array_elements(p_lignes) e group by 1 order by 1
  loop
    if l.q > 99 then
      raise exception 'E_QUANTITE_INVALIDE';
    end if;
    select va.id, va.nom as vnom, p.titre, p.prix_centimes, va.actif as va_actif, p.actif as p_actif into v
      from public.variantes va join public.produits p on p.id = va.produit_id
      where va.id = l.vid and va.boutique_id = b.id
      for update of va;
    if not found or not v.va_actif or not v.p_actif then
      raise exception 'E_PRODUIT_INDISPONIBLE';
    end if;
    update public.variantes set stock = stock - l.q where id = l.vid and stock >= l.q;
    if not found then
      raise exception 'E_STOCK_INSUFFISANT';
    end if;
    insert into public.lignes_commande (commande_id, variante_id, produit_titre, variante_nom, prix_unitaire_centimes, quantite)
      values (cid, l.vid, v.titre, v.vnom, v.prix_centimes, l.q);
    total := total + v.prix_centimes::bigint * l.q;
  end loop;

  update public.commandes set total_centimes = total where id = cid;
  return jsonb_build_object('ref', cref, 'statut', 'nouvelle', 'total_centimes', total, 'paiement', 'non_payee',
                            'mode', p_mode, 'rejouee', false, 'jeton_suivi', token);
end;
$$;

-- Suivi par le client : référence + jeton secret reçu à la commande. Renvoie null si l'un des deux est faux.
create or replace function public.boutique_suivre_commande(p_ref text, p_jeton text)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'ref', c.ref, 'statut', c.statut, 'paiement', c.paiement, 'mode', c.mode, 'total_centimes', c.total_centimes,
    'boutique', (select jsonb_build_object('nom', b.nom, 'slug', b.slug) from public.boutiques b where b.id = c.boutique_id),
    'lignes', coalesce((select jsonb_agg(jsonb_build_object('titre', l.produit_titre, 'variante', l.variante_nom,
                          'prix_unitaire_centimes', l.prix_unitaire_centimes, 'quantite', l.quantite))
                        from public.lignes_commande l where l.commande_id = c.id), '[]'::jsonb))
  from public.commandes c
  where c.ref = p_ref and p_jeton is not null and c.jeton_hash = encode(sha256(convert_to(p_jeton, 'UTF8')), 'hex')
$$;

revoke all on function public.boutique_creer_commande(text, text, jsonb, text, jsonb), public.boutique_suivre_commande(text, text) from public, anon, authenticated;
grant execute on function public.boutique_creer_commande(text, text, jsonb, text, jsonb), public.boutique_suivre_commande(text, text) to service_role;

-- ─── 6. RLS ────────────────────────────────────────────────────────────────────────────────
alter table public.boutiques enable row level security;
alter table public.categories enable row level security;
alter table public.produits enable row level security;
alter table public.variantes enable row level security;
alter table public.commandes enable row level security;
alter table public.lignes_commande enable row level security;

-- Droits de table : on repart de zéro (Supabase accorde « tout » par défaut), puis on accorde le strict nécessaire.
revoke all on public.boutiques, public.categories, public.produits, public.variantes, public.commandes, public.lignes_commande from anon, authenticated;

-- boutiques
drop policy if exists "boutique : lecture" on public.boutiques;
create policy "boutique : lecture" on public.boutiques for select to anon, authenticated
  using (statut = 'publiee' or proprietaire_id = auth.uid());
drop policy if exists "boutique : création par son propriétaire" on public.boutiques;
create policy "boutique : création par son propriétaire" on public.boutiques for insert to authenticated
  with check (proprietaire_id = auth.uid());
drop policy if exists "boutique : modification par son propriétaire" on public.boutiques;
create policy "boutique : modification par son propriétaire" on public.boutiques for update to authenticated
  using (proprietaire_id = auth.uid()) with check (proprietaire_id = auth.uid());
drop policy if exists "boutique : suppression par son propriétaire" on public.boutiques;
create policy "boutique : suppression par son propriétaire" on public.boutiques for delete to authenticated
  using (proprietaire_id = auth.uid());
-- Le public voit les colonnes d'une vitrine, jamais l'identifiant du propriétaire.
grant select (id, slug, nom, description, couleur_principale, couleur_accent, logo, adresse, whatsapp, email, telephone, modes, statut, published_at, created_at, updated_at)
  on public.boutiques to anon;
grant select on public.boutiques to authenticated;
grant insert (proprietaire_id, slug, nom, description, couleur_principale, couleur_accent, logo, adresse, whatsapp, email, telephone, modes, statut)
  on public.boutiques to authenticated;
grant update (slug, nom, description, couleur_principale, couleur_accent, logo, adresse, whatsapp, email, telephone, modes, statut)
  on public.boutiques to authenticated;
grant delete on public.boutiques to authenticated;

-- categories
drop policy if exists "catégorie : lecture" on public.categories;
create policy "catégorie : lecture" on public.categories for select to anon, authenticated
  using (public.boutique_publiee(boutique_id) or public.boutique_possedee(boutique_id));
drop policy if exists "catégorie : création" on public.categories;
create policy "catégorie : création" on public.categories for insert to authenticated with check (public.boutique_possedee(boutique_id));
drop policy if exists "catégorie : modification" on public.categories;
create policy "catégorie : modification" on public.categories for update to authenticated
  using (public.boutique_possedee(boutique_id)) with check (public.boutique_possedee(boutique_id));
drop policy if exists "catégorie : suppression" on public.categories;
create policy "catégorie : suppression" on public.categories for delete to authenticated using (public.boutique_possedee(boutique_id));
grant select on public.categories to anon, authenticated;
grant insert (boutique_id, nom, position) on public.categories to authenticated;
grant update (nom, position) on public.categories to authenticated;
grant delete on public.categories to authenticated;

-- produits : le public ne voit que les produits actifs d'une boutique publiée
drop policy if exists "produit : lecture" on public.produits;
create policy "produit : lecture" on public.produits for select to anon, authenticated
  using (public.boutique_possedee(boutique_id) or (actif and public.boutique_publiee(boutique_id)));
drop policy if exists "produit : création" on public.produits;
create policy "produit : création" on public.produits for insert to authenticated with check (public.boutique_possedee(boutique_id));
drop policy if exists "produit : modification" on public.produits;
create policy "produit : modification" on public.produits for update to authenticated
  using (public.boutique_possedee(boutique_id)) with check (public.boutique_possedee(boutique_id));
drop policy if exists "produit : suppression" on public.produits;
create policy "produit : suppression" on public.produits for delete to authenticated using (public.boutique_possedee(boutique_id));
grant select on public.produits to anon, authenticated;
grant insert (boutique_id, categorie_id, titre, description, prix_centimes, images, actif, position) on public.produits to authenticated;
grant update (categorie_id, titre, description, prix_centimes, images, actif, position) on public.produits to authenticated;
grant delete on public.produits to authenticated;

-- variantes
drop policy if exists "variante : lecture" on public.variantes;
create policy "variante : lecture" on public.variantes for select to anon, authenticated
  using (public.boutique_possedee(boutique_id)
         or (actif and public.boutique_publiee(boutique_id) and public.produit_actif(produit_id)));
drop policy if exists "variante : création" on public.variantes;
create policy "variante : création" on public.variantes for insert to authenticated with check (public.boutique_possedee(boutique_id));
drop policy if exists "variante : modification" on public.variantes;
create policy "variante : modification" on public.variantes for update to authenticated
  using (public.boutique_possedee(boutique_id)) with check (public.boutique_possedee(boutique_id));
drop policy if exists "variante : suppression" on public.variantes;
create policy "variante : suppression" on public.variantes for delete to authenticated using (public.boutique_possedee(boutique_id));
grant select on public.variantes to anon, authenticated;
grant insert (produit_id, boutique_id, nom, stock, actif, position) on public.variantes to authenticated;
grant update (nom, stock, actif, position) on public.variantes to authenticated;
grant delete on public.variantes to authenticated;

-- commandes : lecture par le seul propriétaire de la boutique ; il ne peut changer que le statut ;
-- aucune insertion ni suppression depuis le navigateur ; le public n'a AUCUN droit.
drop policy if exists "commande : lecture par le commerçant" on public.commandes;
create policy "commande : lecture par le commerçant" on public.commandes for select to authenticated
  using (public.boutique_possedee(boutique_id));
drop policy if exists "commande : statut par le commerçant" on public.commandes;
create policy "commande : statut par le commerçant" on public.commandes for update to authenticated
  using (public.boutique_possedee(boutique_id)) with check (public.boutique_possedee(boutique_id));
grant select (id, ref, boutique_id, client_nom, client_email, client_telephone, adresse_livraison, note, mode, statut, total_centimes, paiement, created_at, updated_at)
  on public.commandes to authenticated;
grant update (statut) on public.commandes to authenticated;

drop policy if exists "ligne : lecture par le commerçant" on public.lignes_commande;
create policy "ligne : lecture par le commerçant" on public.lignes_commande for select to authenticated
  using (exists (select 1 from public.commandes c where c.id = commande_id and public.boutique_possedee(c.boutique_id)));
grant select on public.lignes_commande to authenticated;

