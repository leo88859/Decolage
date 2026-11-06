-- Décollage : migration 0009, thème de la vitrine d'une boutique (classique, vitrine, atelier, marche, ecrin, street).
-- À exécuter UNE FOIS À LA MAIN dans Supabase : SQL Editor -> New query -> coller -> Run.
-- Rejouable sans erreur (idempotente). Ne supprime et ne modifie AUCUNE donnée existante : les boutiques déjà créées
-- prennent le thème « classique », c'est-à-dire leur apparence actuelle.
-- Prérequis : 0001 à 0008 déjà exécutées.
-- Tant qu'elle n'est pas exécutée, le site continue de marcher : les vitrines restent en thème classique, et choisir un
-- autre thème est sans effet (l'enregistrement repasse sans le thème).

alter table public.boutiques add column if not exists theme text not null default 'classique';

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'boutiques_theme_check' and conrelid = 'public.boutiques'::regclass) then
    alter table public.boutiques add constraint boutiques_theme_check
      check (theme in ('classique', 'vitrine', 'atelier', 'marche', 'ecrin', 'street'));
  end if;
end $$;

-- Le public lit le thème d'une vitrine publiée ; le propriétaire le choisit à la création et le modifie ensuite.
grant select (theme) on public.boutiques to anon;
grant insert (theme), update (theme) on public.boutiques to authenticated;

-- Le cache de schéma de l'API se recharge tout de suite (sinon la colonne n'apparaît qu'après quelques minutes).
notify pgrst, 'reload schema';
