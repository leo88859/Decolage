-- Décollage : migration 0007, durcissement (audit de sécurité d'octobre 2026, « autres problèmes »).
-- À exécuter UNE FOIS À LA MAIN dans Supabase : SQL Editor -> New query -> coller -> Run.
-- Rejouable sans erreur ni effet indésirable (idempotente). Ne supprime et ne modifie AUCUNE donnée existante :
-- les nouvelles contraintes sont « not valid » (contrôlent les nouvelles écritures, pas les lignes déjà là).
-- Prérequis : 0001 à 0006 déjà exécutées, dans l'ordre. Ne modifie pas les fichiers 0001 à 0006 : elle remplace des
-- fonctions, déclencheurs, politiques et droits par de nouvelles versions.
-- ATTENTION : à EXÉCUTER EN DERNIER. Ne rejoue jamais 0005 ou 0006 APRÈS elle (elles recréeraient d'anciennes politiques
-- de lecture) ; si cela arrive, rejoue simplement 0007.
--
-- Contenu :
--   1. Limite de débit en base (table limites_debit + fonction limite_debit), utilisable depuis plusieurs instances Vercel.
--   2. Liste d'attente : plus d'insertion directe (anon / authenticated), inscription par waitlist_inscrire() (service_role),
--      format d'e-mail, plafond par site, réponse identique en cas de doublon.
--   3. Commandes : référence plus longue (12 caractères), plafond de quantité par commande, plafond de commandes « nouvelle »
--      par contact et par boutique, comptage « 100 par heure » verrouillé, expiration des commandes « nouvelle ».
--   4. Plafonds (produits, variantes, catégories) et validation des URL d'images / logo en base.
--   5. Exposition publique : sites.user_id, boutiques.proprietaire_id / suspended_at, stock exact (vue variantes_publiques).
--   6. Droits TRUNCATE / REFERENCES / TRIGGER retirés aux rôles du navigateur.
--   7. Création atomique d'un produit avec ses variantes.
--   8. Fonctions de déclencheur non appelables via /rpc, adresses réservées en base.

-- ═══ 1. Limite de débit en base ═══════════════════════════════════════════════════════════════
-- Fenêtre fixe : une ligne par (seau, clé hachée, fenêtre). La clé (ex. une adresse IP) n'est stockée que hachée.
create table if not exists public.limites_debit (
  cle text primary key,
  n integer not null default 0,
  expire_at timestamptz not null
);
create index if not exists limites_debit_expire_idx on public.limites_debit (expire_at);
alter table public.limites_debit enable row level security;
revoke all on public.limites_debit from public, anon, authenticated;

-- Renvoie TRUE si la limite est dépassée (la demande doit être refusée). Atomique (insert ... on conflict).
create or replace function public.limite_debit(p_seau text, p_cle text, p_max integer, p_fenetre_s integer)
returns boolean language plpgsql security definer set search_path = public as $$
declare
  slot bigint;
  v integer;
begin
  if p_seau is null or p_cle is null or p_max is null or p_max < 1 or p_fenetre_s is null or p_fenetre_s not between 1 and 86400 then
    raise exception 'E_LIMITE_PARAMETRES';
  end if;
  slot := floor(extract(epoch from now()) / p_fenetre_s);
  insert into public.limites_debit as l (cle, n, expire_at)
  values (left(p_seau, 40) || ':' || encode(sha256(convert_to(p_cle, 'UTF8')), 'hex') || ':' || slot::text, 1,
          to_timestamp((slot + 1) * p_fenetre_s::bigint) + interval '1 minute')
  on conflict (cle) do update set n = l.n + 1
  returning l.n into v;
  -- Ménage au passage (2 % des appels) : les fenêtres expirées ne servent plus.
  if random() < 0.02 then
    delete from public.limites_debit where expire_at < now();
  end if;
  return v > p_max;
end;
$$;
revoke all on function public.limite_debit(text, text, integer, integer) from public, anon, authenticated;
grant execute on function public.limite_debit(text, text, integer, integer) to service_role;

-- ═══ 2. Liste d'attente ═══════════════════════════════════════════════════════════════════════
-- Avant : anon pouvait insérer directement via PostgREST (aucune limite de débit, spam, et un doublon répondait 409 :
-- fuite de « cette adresse est déjà inscrite »). Après : seule la route /api/waitlist/[slug] (service_role) écrit.
drop policy if exists "liste : inscription publique" on public.waitlist;
revoke insert, update on public.waitlist from anon, authenticated;
revoke select, delete on public.waitlist from anon;
do $$
declare seq text := pg_get_serial_sequence('public.waitlist', 'id');
begin
  if seq is not null then
    execute format('revoke all on sequence %s from public, anon, authenticated', seq);
  end if;
end $$;

-- Format d'e-mail en base (en minuscules). « not valid » : les lignes existantes ne sont pas contrôlées.
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'waitlist_email_format' and conrelid = 'public.waitlist'::regclass) then
    alter table public.waitlist add constraint waitlist_email_format
      check (email = lower(email) and email ~ '^[^\s@]+@[^\s@]+\.[^\s@]{2,}$') not valid;
  end if;
end $$;

-- Plafond d'inscrits par site (5000), pour tous les rôles : un site ne peut pas remplir la base.
create or replace function public.waitlist_plafond() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform pg_advisory_xact_lock(hashtext('waitlist:' || new.slug));
  if (select count(*) from public.waitlist where slug = new.slug) >= 5000 then
    raise exception 'La liste d''attente de ce site est pleine.' using errcode = 'P0001', hint = 'liste_pleine';
  end if;
  return new;
end;
$$;
drop trigger if exists waitlist_plafond on public.waitlist;
create trigger waitlist_plafond before insert on public.waitlist
  for each row execute function public.waitlist_plafond();

-- Seule voie d'inscription (service_role). Renvoie toujours un code texte, jamais d'erreur :
--   'ok' (inscrit OU déjà inscrit : réponse identique, rien n'est révélé), 'email_invalide', 'site_inconnu',
--   'trop_de_demandes' (plafond horaire du site), 'liste_pleine'.
-- Le site doit être lisible publiquement (non suspendu, propriétaire autorisé à publier), comme pour la page elle-même.
create or replace function public.waitlist_inscrire(p_slug text, p_email text) returns text
language plpgsql security definer set search_path = public as $$
declare
  e text := lower(btrim(coalesce(p_email, '')));
begin
  if p_slug is null or p_slug !~ '^[a-z0-9]([a-z0-9-]{1,38}[a-z0-9])$' then
    return 'site_inconnu';
  end if;
  if char_length(e) not between 5 and 254 or e !~ '^[^\s@]+@[^\s@]+\.[^\s@]{2,}$' then
    return 'email_invalide';
  end if;
  if not exists (select 1 from public.sites s where s.slug = p_slug and s.suspended_at is null and public.owner_can_publish(s.user_id)) then
    return 'site_inconnu';
  end if;
  if public.limite_debit('wl-site', p_slug, 300, 3600) then
    return 'trop_de_demandes';
  end if;
  perform pg_advisory_xact_lock(hashtext('waitlist:' || p_slug));
  -- Liste pleine : même réponse pour tout le monde (un doublon ne se distingue pas d'une nouvelle adresse).
  if (select count(*) from public.waitlist where slug = p_slug) >= 5000 then
    return 'liste_pleine';
  end if;
  insert into public.waitlist (slug, email) values (p_slug, e) on conflict (slug, email) do nothing;
  return 'ok';
end;
$$;
revoke all on function public.waitlist_inscrire(text, text) from public, anon, authenticated;
grant execute on function public.waitlist_inscrire(text, text) to service_role;

-- ═══ 3. Commandes ═════════════════════════════════════════════════════════════════════════════
-- Contacts normalisés (colonnes internes, non lisibles par le navigateur : le grant de colonnes de 0005 ne les cite pas).
alter table public.commandes add column if not exists client_email_norm text;
alter table public.commandes add column if not exists client_tel_norm text;
create index if not exists commandes_contact_email_idx on public.commandes (boutique_id, client_email_norm)
  where statut = 'nouvelle' and client_email_norm is not null;
create index if not exists commandes_contact_tel_idx on public.commandes (boutique_id, client_tel_norm)
  where statut = 'nouvelle' and client_tel_norm is not null;
create index if not exists commandes_nouvelles_age_idx on public.commandes (created_at) where statut = 'nouvelle';

-- « Jean.Dupont+promo@Exemple.fr » -> « jean.dupont@exemple.fr » ; téléphone -> 9 derniers chiffres.
create or replace function public.contact_email_norm(e text) returns text
language sql immutable set search_path = public as $$
  select case when e is null or position('@' in e) = 0 then null
              else lower(split_part(split_part(e, '@', 1), '+', 1)) || '@' || lower(split_part(e, '@', 2)) end
$$;
create or replace function public.contact_tel_norm(t text) returns text
language sql immutable set search_path = public as $$
  select case when t is null then null
              when length(regexp_replace(t, '[^0-9]', '', 'g')) < 6 then null
              else right(regexp_replace(t, '[^0-9]', '', 'g'), 9) end
$$;
revoke all on function public.contact_email_norm(text), public.contact_tel_norm(text) from public, anon, authenticated;

-- Référence publique : « CMD- » + 12 caractères hexadécimaux aléatoires (48 bits, générateur cryptographique de
-- gen_random_uuid) pour les NOUVELLES commandes. Les anciennes (8 caractères) restent valables.
create or replace function public.boutique_generer_ref() returns text
language sql volatile set search_path = public as $$
  select 'CMD-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 12))
$$;
revoke all on function public.boutique_generer_ref() from public, anon, authenticated;

-- Nouvelle version de la création de commande (même signature qu'en 0005 : la route API ne change pas).
-- Changements : validation des lignes sans conversion risquée (une quantité non numérique donne E_QUANTITE_INVALIDE,
-- jamais une erreur brute), plafond de 200 articles par commande, verrou par boutique (le comptage « 100 par heure »
-- et le plafond par contact deviennent fiables), au plus 3 commandes « nouvelle » en 7 jours par contact et par boutique
-- (E_CONTACT_TROP_DE_COMMANDES), référence de 12 caractères avec nouvelle tentative en cas de collision.
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
  email_n text;
  tel_n text;
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

  -- Lignes : chaque contrôle est une instruction à part (aucune conversion avant validation du format).
  if p_lignes is null or jsonb_typeof(p_lignes) <> 'array' then
    raise exception 'E_QUANTITE_INVALIDE';
  end if;
  if jsonb_array_length(p_lignes) not between 1 and 20 then
    raise exception 'E_QUANTITE_INVALIDE';
  end if;
  if exists (
    select 1 from jsonb_array_elements(p_lignes) e
    where jsonb_typeof(e) <> 'object'
       or case when jsonb_typeof(e -> 'quantite') = 'number' then (e ->> 'quantite') !~ '^[0-9]{1,2}$' else true end
       or case when jsonb_typeof(e -> 'variante_id') = 'string'
               then (e ->> 'variante_id') !~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
               else true end
  ) then
    raise exception 'E_QUANTITE_INVALIDE';
  end if;
  -- Le format est validé : la conversion est sûre.
  if exists (select 1 from jsonb_array_elements(p_lignes) e where (e ->> 'quantite')::int < 1)
     or (select sum((e ->> 'quantite')::int) from jsonb_array_elements(p_lignes) e) > 200 then
    raise exception 'E_QUANTITE_INVALIDE';
  end if;

  -- Une seule création à la fois par boutique : les plafonds ci-dessous sont comptés sans course possible.
  perform pg_advisory_xact_lock(hashtext('commandes:' || b.id::text));
  -- Anti-inondation : au plus 100 commandes par heure et par boutique.
  if (select count(*) from public.commandes where boutique_id = b.id and created_at > now() - interval '1 hour') >= 100 then
    raise exception 'E_TROP_DE_COMMANDES';
  end if;
  -- Stock bloqué sans paiement : au plus 3 commandes « nouvelle » (non confirmées) en 7 jours par contact et par boutique.
  email_n := public.contact_email_norm(email);
  tel_n := public.contact_tel_norm(tel);
  if (email_n is not null or tel_n is not null) and (
    select count(*) from public.commandes
    where boutique_id = b.id and statut = 'nouvelle' and created_at > now() - interval '7 days'
      and ((email_n is not null and client_email_norm = email_n) or (tel_n is not null and client_tel_norm = tel_n))
  ) >= 3 then
    raise exception 'E_CONTACT_TROP_DE_COMMANDES';
  end if;

  token := replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');
  loop
    cref := public.boutique_generer_ref();
    begin
      insert into public.commandes (id, ref, boutique_id, cle_idempotence, client_nom, client_email, client_telephone,
                                    adresse_livraison, note, mode, jeton_hash, client_email_norm, client_tel_norm)
      values (cid, cref, b.id, p_cle, nom, email, tel, adresse, note, p_mode,
              encode(sha256(convert_to(token, 'UTF8')), 'hex'), email_n, tel_n);
      exit;
    exception when unique_violation then
      -- Référence déjà prise (collision) : on en tire une autre.
      tries := tries + 1;
      if tries > 8 then raise exception 'E_REF'; end if;
    end;
  end loop;

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
revoke all on function public.boutique_creer_commande(text, text, jsonb, text, jsonb) from public, anon, authenticated;
grant execute on function public.boutique_creer_commande(text, text, jsonb, text, jsonb) to service_role;

-- Expiration des commandes « nouvelle » trop anciennes : statut « annulee », stock remis UNE seule fois par le
-- déclencheur commande_transition (0005). Renvoie le nombre de commandes annulées. Âge minimum : 1 heure.
-- NON planifiée par cette migration : voir docs/BOUTIQUE-API.md (pg_cron ou route protégée par CRON_SECRET).
create or replace function public.boutique_expirer_commandes_nouvelles(p_age interval) returns integer
language plpgsql security definer set search_path = public as $$
declare
  n integer;
begin
  if p_age is null or p_age < interval '1 hour' then
    raise exception 'E_AGE_INVALIDE';
  end if;
  with annulees as (
    update public.commandes set statut = 'annulee'
    where statut = 'nouvelle' and created_at < now() - p_age
    returning 1
  )
  select count(*) into n from annulees;
  return n;
end;
$$;
revoke all on function public.boutique_expirer_commandes_nouvelles(interval) from public, anon, authenticated;
grant execute on function public.boutique_expirer_commandes_nouvelles(interval) to service_role;

-- ═══ 4. Plafonds et validation des URL en base ════════════════════════════════════════════════
-- Plafonds : 500 produits par boutique et 2000 par compte (boutiques cumulées), 50 variantes par produit,
-- 50 catégories par boutique. Pour tous les rôles (sauf modification de déclencheur par l'administrateur SQL).
create or replace function public.boutique_plafonds() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  n integer;
  proprio uuid;
begin
  if tg_table_name = 'produits' then
    perform pg_advisory_xact_lock(hashtext('plafond:' || new.boutique_id::text));
    select count(*) into n from public.produits where boutique_id = new.boutique_id;
    if n >= 500 then
      raise exception 'Limite de 500 produits par boutique atteinte.' using errcode = 'P0001', hint = 'plafond_produits';
    end if;
    select proprietaire_id into proprio from public.boutiques where id = new.boutique_id;
    if proprio is not null then
      select count(*) into n from public.produits p join public.boutiques b on b.id = p.boutique_id where b.proprietaire_id = proprio;
      if n >= 2000 then
        raise exception 'Limite de 2000 produits par compte atteinte.' using errcode = 'P0001', hint = 'plafond_produits';
      end if;
    end if;
  elsif tg_table_name = 'variantes' then
    perform pg_advisory_xact_lock(hashtext('plafond:' || new.produit_id::text));
    select count(*) into n from public.variantes where produit_id = new.produit_id;
    if n >= 50 then
      raise exception 'Limite de 50 variantes par produit atteinte.' using errcode = 'P0001', hint = 'plafond_variantes';
    end if;
  elsif tg_table_name = 'categories' then
    perform pg_advisory_xact_lock(hashtext('plafond:' || new.boutique_id::text));
    select count(*) into n from public.categories where boutique_id = new.boutique_id;
    if n >= 50 then
      raise exception 'Limite de 50 catégories par boutique atteinte.' using errcode = 'P0001', hint = 'plafond_categories';
    end if;
  end if;
  return new;
end;
$$;
drop trigger if exists produits_plafonds on public.produits;
create trigger produits_plafonds before insert on public.produits for each row execute function public.boutique_plafonds();
drop trigger if exists variantes_plafonds on public.variantes;
create trigger variantes_plafonds before insert on public.variantes for each row execute function public.boutique_plafonds();
drop trigger if exists categories_plafonds on public.categories;
create trigger categories_plafonds before insert on public.categories for each row execute function public.boutique_plafonds();

-- URL d'image : https uniquement, 500 caractères au plus, ni espace, ni < > " ' \, ni identifiants (user@) dans l'adresse.
create or replace function public.url_https_valide(u text) returns boolean
language sql immutable set search_path = public as $$
  select u is not null and char_length(u) <= 500 and u ~ '^https://[^\s<>"''\\/?#@]+([/?#][^\s<>"''\\]*)?$'
$$;
create or replace function public.images_https_valides(imgs text[]) returns boolean
language sql immutable set search_path = public as $$
  select imgs is null or (
    coalesce(cardinality(imgs), 0) <= 5
    and not exists (select 1 from unnest(imgs) as u where not public.url_https_valide(u))
  )
$$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'produits_images_https' and conrelid = 'public.produits'::regclass) then
    alter table public.produits add constraint produits_images_https check (public.images_https_valides(images)) not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'boutiques_logo_https' and conrelid = 'public.boutiques'::regclass) then
    alter table public.boutiques add constraint boutiques_logo_https check (logo is null or public.url_https_valide(logo)) not valid;
  end if;
end $$;

-- ═══ 5. Exposition publique ═══════════════════════════════════════════════════════════════════
-- sites : le public (anon) ne lit plus user_id ni project_id (colonnes accordées une à une). La page publique et
-- site-server.ts lisent seulement data et suspended_at. Un compte connecté ne lit plus que SES sites (plus ceux des autres).
revoke select on public.sites from anon;
grant select (slug, data, published_at, updated_at, suspended_at) on public.sites to anon;
drop policy if exists "sites : lecture publique des sites publiables" on public.sites;
create policy "sites : lecture publique des sites publiables" on public.sites for select to anon
  using (suspended_at is null and public.owner_can_publish(user_id));

-- boutiques : un compte connecté ne lit plus que SES boutiques (plus proprietaire_id / suspended_at des autres) ;
-- le public lit les boutiques publiées par les colonnes déjà accordées en 0005 (sans proprietaire_id ni suspended_at).
-- La vitrine publique passe par la route /api/boutique/catalogue (clé anonyme) : elle n'est pas touchée.
drop policy if exists "boutique : lecture" on public.boutiques;
drop policy if exists "boutique : lecture publique" on public.boutiques;
create policy "boutique : lecture publique" on public.boutiques for select to anon
  using (statut = 'publiee' and suspended_at is null and public.owner_can_publish(proprietaire_id));
drop policy if exists "boutique : lecture par son propriétaire" on public.boutiques;
create policy "boutique : lecture par son propriétaire" on public.boutiques for select to authenticated
  using (proprietaire_id = auth.uid());

-- Stock exact : plus lisible par le public. Le public (anon) ne lit plus la table variantes ; il lit la vue
-- variantes_publiques (disponible / stock bas, jamais la quantité). Le commerçant lit toujours le stock exact de SES variantes.
-- (Les politiques de produits et catégories ne dépendent pas du stock : elles ne changent pas.)
revoke select on public.variantes from anon;
drop policy if exists "variante : lecture" on public.variantes;
drop policy if exists "variante : lecture par le commerçant" on public.variantes;
create policy "variante : lecture par le commerçant" on public.variantes for select to authenticated
  using (public.boutique_possedee(boutique_id));

create or replace view public.variantes_publiques with (security_barrier = true) as
  select v.id, v.produit_id, v.boutique_id, v.nom, v.position,
         (v.stock > 0) as disponible,
         (v.stock > 0 and v.stock <= 5) as stock_bas
  from public.variantes v
  where v.actif and public.produit_actif(v.produit_id) and public.boutique_publiee(v.boutique_id);
-- Une vue simple est modifiable par défaut : on ne laisse que la lecture.
revoke all on public.variantes_publiques from public, anon, authenticated;
grant select on public.variantes_publiques to anon, authenticated, service_role;

-- ═══ 6. TRUNCATE / REFERENCES / TRIGGER : jamais utiles au navigateur ═══════════════════════════
-- Le serveur (service_role) et les cascades (suppression de compte) ne passent pas par ces droits.
do $$
declare
  t text;
begin
  foreach t in array array['profiles', 'projects', 'sites', 'waitlist', 'legal_acceptances', 'brand_entitlements', 'brand_configs',
                           'boutiques', 'categories', 'produits', 'variantes', 'commandes', 'lignes_commande', 'limites_debit']
  loop
    if to_regclass('public.' || t) is not null then
      execute format('revoke truncate, references, trigger on public.%I from public, anon, authenticated', t);
    end if;
  end loop;
end $$;

-- ═══ 7. Création atomique d'un produit avec ses variantes ═════════════════════════════════════
-- SECURITY INVOKER : tout s'exécute avec les droits du commerçant connecté (RLS, droits de colonnes, plafonds,
-- limites de formule). Une erreur annule tout : jamais de produit sans variante. Appelée par POST /api/boutique/{id}/produits.
create or replace function public.boutique_creer_produit(p_boutique uuid, p_produit jsonb, p_variantes jsonb default null)
returns jsonb language plpgsql security invoker set search_path = public as $$
declare
  p public.produits;
  vr public.variantes;
  lst jsonb := coalesce(p_variantes, '[{"nom":"Unique","stock":0}]'::jsonb);
  x jsonb;
  i integer := 0;
  imgs text[] := '{}';
  res jsonb := '[]'::jsonb;
begin
  if p_boutique is null or jsonb_typeof(p_produit) is distinct from 'object' or jsonb_typeof(lst) is distinct from 'array'
     or jsonb_array_length(lst) not between 1 and 50 then
    raise exception 'Produit invalide.' using errcode = '22023';
  end if;
  if exists (select 1 from jsonb_object_keys(p_produit) k where k not in ('titre', 'description', 'prix_centimes', 'images', 'actif', 'position', 'categorie_id'))
     or jsonb_typeof(p_produit -> 'titre') is distinct from 'string'
     or jsonb_typeof(p_produit -> 'prix_centimes') is distinct from 'number' or (p_produit ->> 'prix_centimes') !~ '^[0-9]{1,8}$'
     or (p_produit ? 'description' and jsonb_typeof(p_produit -> 'description') is distinct from 'string')
     or (p_produit ? 'actif' and jsonb_typeof(p_produit -> 'actif') is distinct from 'boolean')
     or (p_produit ? 'position' and (jsonb_typeof(p_produit -> 'position') is distinct from 'number' or (p_produit ->> 'position') !~ '^[0-9]{1,6}$'))
     or (p_produit ? 'categorie_id' and jsonb_typeof(p_produit -> 'categorie_id') not in ('string', 'null'))
     or (p_produit ? 'images' and jsonb_typeof(p_produit -> 'images') is distinct from 'array') then
    raise exception 'Produit invalide.' using errcode = '22023';
  end if;
  if p_produit ? 'images' then
    if exists (select 1 from jsonb_array_elements(p_produit -> 'images') e where jsonb_typeof(e) <> 'string') then
      raise exception 'Produit invalide.' using errcode = '22023';
    end if;
    select coalesce(array_agg(e), '{}') into imgs from jsonb_array_elements_text(p_produit -> 'images') e;
  end if;
  for x in select e from jsonb_array_elements(lst) e loop
    if jsonb_typeof(x) <> 'object'
       or exists (select 1 from jsonb_object_keys(x) k where k not in ('nom', 'stock', 'actif', 'position'))
       or jsonb_typeof(x -> 'nom') is distinct from 'string'
       or (x ? 'stock' and (jsonb_typeof(x -> 'stock') is distinct from 'number' or (x ->> 'stock') !~ '^[0-9]{1,7}$'))
       or (x ? 'actif' and jsonb_typeof(x -> 'actif') is distinct from 'boolean')
       or (x ? 'position' and (jsonb_typeof(x -> 'position') is distinct from 'number' or (x ->> 'position') !~ '^[0-9]{1,4}$')) then
      raise exception 'Variante invalide.' using errcode = '22023';
    end if;
  end loop;

  insert into public.produits (boutique_id, categorie_id, titre, description, prix_centimes, images, actif, position)
  values (p_boutique,
          case when jsonb_typeof(p_produit -> 'categorie_id') = 'string' then (p_produit ->> 'categorie_id')::uuid end,
          p_produit ->> 'titre',
          coalesce(p_produit ->> 'description', ''),
          (p_produit ->> 'prix_centimes')::integer,
          imgs,
          coalesce((p_produit ->> 'actif')::boolean, true),
          coalesce((p_produit ->> 'position')::integer, 0))
  returning * into p;

  for x in select e from jsonb_array_elements(lst) e loop
    insert into public.variantes (produit_id, boutique_id, nom, stock, actif, position)
    values (p.id, p_boutique, x ->> 'nom', coalesce((x ->> 'stock')::integer, 0), coalesce((x ->> 'actif')::boolean, true),
            coalesce((x ->> 'position')::integer, i))
    returning * into vr;
    res := res || to_jsonb(vr);
    i := i + 1;
  end loop;
  return to_jsonb(p) || jsonb_build_object('variantes', res);
end;
$$;
revoke all on function public.boutique_creer_produit(uuid, jsonb, jsonb) from public, anon;
grant execute on function public.boutique_creer_produit(uuid, jsonb, jsonb) to authenticated;

-- ═══ 8. Fonctions de déclencheur, adresses réservées ════════════════════════════════════════════
-- Un déclencheur ne vérifie le droit d'exécution qu'à la CRÉATION du déclencheur, pas à chaque déclenchement :
-- on retire donc l'exécution directe (via /rpc) à tous les rôles du navigateur.
do $$
declare
  f text;
begin
  foreach f in array array[
    'public.handle_new_user()', 'public.enforce_project_limit()', 'public.brand_entitlements_stamp()',
    'public.unpublish_site_of_deleted_project()', 'public.boutique_touch()', 'public.boutique_enforce_limit()',
    'public.boutique_garde()', 'public.commande_transition()', 'public.commande_boutique_publiable()',
    'public.sites_enforce_plan()', 'public.waitlist_plafond()', 'public.boutique_plafonds()']
  loop
    if to_regprocedure(f) is not null then
      execute format('revoke all on function %s from public, anon, authenticated', f);
    end if;
  end loop;
end $$;

-- Adresses réservées (miroir de RESERVED dans src/lib/publish.ts ; un test compare les deux listes).
create or replace function public.slug_reserve(s text) returns boolean
language sql immutable set search_path = public as $$
  select s = any (array['admin', 'api', 'app', 'www', 'decollage', 'connexion', 'parametres', 'guide', 'aide', 'support', 'stripe', 'auth'])
$$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'sites_slug_non_reserve' and conrelid = 'public.sites'::regclass) then
    alter table public.sites add constraint sites_slug_non_reserve check (not public.slug_reserve(slug)) not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'boutiques_slug_non_reserve' and conrelid = 'public.boutiques'::regclass) then
    alter table public.boutiques add constraint boutiques_slug_non_reserve check (not public.slug_reserve(slug)) not valid;
  end if;
end $$;
