-- Décollage : migration 0010, expiration réglable des commandes « nouvelle » (48 h par défaut) et limites anti-abus.
-- À exécuter UNE FOIS À LA MAIN dans Supabase : SQL Editor -> New query -> coller -> Run. (NON exécutée par le développeur.)
-- Rejouable sans erreur (idempotente). Ne supprime et ne modifie AUCUNE commande ni AUCUN stock existant.
-- Prérequis : 0001 à 0009 déjà exécutées, dans l'ordre. Ne rejoue jamais 0007 APRÈS elle (0007 remettrait l'ancienne
-- fonction de création de commande) : si tu le fais, rejoue 0010.
-- La PLANIFICATION (pg_cron, toutes les 15 minutes) est dans un fichier séparé : 0010b_planification_pg_cron.sql.
--
-- 1. boutiques.delai_expiration_h : délai avant annulation automatique d'une commande « nouvelle » (défaut 48, de 6 à 168).
--    Les boutiques existantes passent à 48 h (avant : 72 h pour l'appel sans argument, jamais planifié).
-- 2. boutiques.quantite_max_article : quantité maximale par article et par commande (défaut 10, de 1 à 99).
-- 3. boutique_expirer_commandes_nouvelles() (sans argument) : chaque boutique est traitée avec SON délai, indépendamment
--    des autres. N'annule que « nouvelle » ET non payée ; une commande confirmée n'est jamais touchée. Le stock est remis
--    par le déclencheur commande_transition (0005) au passage à « annulee » : une seule fois, même si deux appels se
--    chevauchent (verrou de ligne + UPDATE conditionnel sur le statut). La version à argument (0008) reste inchangée.
-- 4. boutique_creer_commande : limites anti-abus en base (mêmes valeurs que src/lib/boutique/money.ts) :
--      quantité par article : quantite_max_article (10 par défaut, 99 au plus)      -> E_QUANTITE_MAX
--      articles par commande : 50                                                    -> E_ARTICLES_MAX
--      commandes « nouvelle » en attente par contact et par boutique : 2             -> E_CONTACT_TROP_DE_COMMANDES
--      commandes « nouvelle » simultanées par boutique : 50                          -> E_TROP_DE_NOUVELLES
--    (le plafond de 100 commandes par heure et par boutique de 0007 reste). Les limites PAR IP (3 par minute, 10 par
--    heure) sont appliquées par la route API avec limite_debit (0007), pas ici : la base ne voit pas l'adresse IP.

-- ═══ 1. Colonnes ══════════════════════════════════════════════════════════════════════════════
alter table public.boutiques add column if not exists delai_expiration_h integer not null default 48;
alter table public.boutiques add column if not exists quantite_max_article integer not null default 10;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'boutiques_delai_expiration_check' and conrelid = 'public.boutiques'::regclass) then
    alter table public.boutiques add constraint boutiques_delai_expiration_check check (delai_expiration_h between 6 and 168);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'boutiques_quantite_max_check' and conrelid = 'public.boutiques'::regclass) then
    alter table public.boutiques add constraint boutiques_quantite_max_check check (quantite_max_article between 1 and 99);
  end if;
end $$;
-- Le public lit les deux réglages d'une vitrine publiée (affichage du délai et de la quantité maximale) ;
-- le propriétaire les règle à la création et ensuite.
grant select (delai_expiration_h, quantite_max_article) on public.boutiques to anon;
grant insert (delai_expiration_h, quantite_max_article), update (delai_expiration_h, quantite_max_article) on public.boutiques to authenticated;

-- Compte rapide des commandes en attente par boutique (plafond de 50 et expiration).
create index if not exists commandes_nouvelles_idx on public.commandes (boutique_id, created_at) where statut = 'nouvelle';

-- ═══ 2. Expiration par boutique ═══════════════════════════════════════════════════════════════
create or replace function public.boutique_expirer_commandes_nouvelles() returns integer
language plpgsql security definer set search_path = public as $$
declare
  b record;
  n integer;
  total integer := 0;
begin
  for b in select id, delai_expiration_h from public.boutiques order by id loop
    begin
      -- Une erreur sur UNE boutique (sous-transaction) ne bloque ni n'annule le travail des autres.
      with cibles as (
        select id from public.commandes
        where boutique_id = b.id and statut = 'nouvelle' and paiement = 'non_payee'
          and created_at < now() - make_interval(hours => b.delai_expiration_h)
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
      total := total + n;
    exception when others then
      raise warning 'expiration : boutique % ignorée (sqlstate %)', b.id, sqlstate;
    end;
  end loop;
  return total;
end;
$$;
revoke all on function public.boutique_expirer_commandes_nouvelles() from public, anon, authenticated;
grant execute on function public.boutique_expirer_commandes_nouvelles() to service_role;

-- ═══ 3. Création de commande avec limites anti-abus ═══════════════════════════════════════════
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
  if exists (select 1 from jsonb_array_elements(p_lignes) e where (e ->> 'quantite')::int < 1) then
    raise exception 'E_QUANTITE_INVALIDE';
  end if;
  -- Limites anti-abus : 50 articles au plus par commande ; quantité par article plafonnée par la boutique (10 par défaut).
  if (select sum((e ->> 'quantite')::int) from jsonb_array_elements(p_lignes) e) > 50 then
    raise exception 'E_ARTICLES_MAX';
  end if;
  if exists (
    select 1 from jsonb_array_elements(p_lignes) e
    group by lower(e ->> 'variante_id')
    having sum((e ->> 'quantite')::int) > b.quantite_max_article
  ) then
    raise exception 'E_QUANTITE_MAX';
  end if;

  -- Une seule création à la fois par boutique : les plafonds ci-dessous sont comptés sans course possible.
  perform pg_advisory_xact_lock(hashtext('commandes:' || b.id::text));
  -- Anti-inondation : au plus 100 commandes par heure et par boutique.
  if (select count(*) from public.commandes where boutique_id = b.id and created_at > now() - interval '1 hour') >= 100 then
    raise exception 'E_TROP_DE_COMMANDES';
  end if;
  -- Stock réservé sans paiement : au plus 50 commandes « nouvelle » simultanées par boutique.
  if (select count(*) from public.commandes where boutique_id = b.id and statut = 'nouvelle') >= 50 then
    raise exception 'E_TROP_DE_NOUVELLES';
  end if;
  -- Au plus 2 commandes « nouvelle » (non confirmées) en attente par contact et par boutique (elles expirent seules).
  email_n := public.contact_email_norm(email);
  tel_n := public.contact_tel_norm(tel);
  if (email_n is not null or tel_n is not null) and (
    select count(*) from public.commandes
    where boutique_id = b.id and statut = 'nouvelle'
      and ((email_n is not null and client_email_norm = email_n) or (tel_n is not null and client_tel_norm = tel_n))
  ) >= 2 then
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
notify pgrst, 'reload schema';
