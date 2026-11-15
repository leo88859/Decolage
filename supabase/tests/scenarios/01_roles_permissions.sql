-- Scénario 01 : permissions réelles des rôles (anon, authenticated, service_role). Lecture seule.
-- Prérequis : migrations 0001 à 0011 exécutées sur la base de TEST (jamais sur la production).
do $$
begin
  if has_function_privilege('anon', 'public.boutique_expirer_commandes_nouvelles()', 'EXECUTE') then
    raise exception 'ECHEC : anon peut lancer l''expiration';
  end if;
  if has_function_privilege('authenticated', 'public.boutique_expirer_commandes_nouvelles()', 'EXECUTE') then
    raise exception 'ECHEC : authenticated peut lancer l''expiration';
  end if;
  if not has_function_privilege('service_role', 'public.boutique_expirer_commandes_nouvelles()', 'EXECUTE') then
    raise exception 'ECHEC : service_role ne peut pas lancer l''expiration';
  end if;
  if has_function_privilege('authenticated', 'public.boutique_creer_commande(text,text,jsonb,text,jsonb)', 'EXECUTE') then
    raise exception 'ECHEC : authenticated peut créer une commande en contournant les limites';
  end if;
  if has_function_privilege('anon', 'public.waitlist_inscrire_consent(text,text,boolean,text)', 'EXECUTE') then
    raise exception 'ECHEC : anon peut inscrire sur une liste d''attente';
  end if;
  if has_function_privilege('authenticated', 'public.limite_debit(text,text,integer,integer)', 'EXECUTE') then
    raise exception 'ECHEC : authenticated peut modifier les compteurs de limite';
  end if;
  if has_table_privilege('anon', 'public.waitlist', 'SELECT') then
    raise exception 'ECHEC : anon peut lire la liste d''attente';
  end if;
  raise notice 'OK : permissions des fonctions et des tables conformes';
end $$;
