// Kit du générateur : base de données Supabase facultative, pour la liste d'attente.
// Sans variables d'environnement, l'application reste en mode local (rien ne change).
// Avec elles, les inscriptions sont enregistrées dans la base et le propriétaire les consulte
// après connexion. La sécurité est appliquée par la base (RLS), jamais par le navigateur seul.
// Mêmes règles que les autres kits : pas d'accent grave ni de « ${ » dans ces textes.

/** Migration SQL (supabase/migrations/0001_liste_attente.sql). Non destructive : rejouable sans perte. */
export const WAITLIST_SQL = String.raw`-- Liste d'attente : tables, sécurité (RLS) et fonction d'inscription publique.
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
`;

/** lib/cloud.ts : accès à Supabase avec les seules valeurs publiques. */
export const CLOUD_TS = String.raw`"use client";

import { createClient, type Session, type SupabaseClient } from "@supabase/supabase-js";

// Base de données Supabase (facultative). Seules des valeurs publiques sont lues ici : la sécurité
// repose sur les règles RLS de supabase/migrations/0001_liste_attente.sql, appliquées par la base.
const URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
export const LISTE_ID = (process.env.NEXT_PUBLIC_LISTE_ID ?? "").trim();
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** local : aucune base ; incomplet : base branchée mais liste non choisie ; pret : inscriptions en ligne. */
export const cloudState: "local" | "incomplet" | "pret" = !URL || !KEY ? "local" : UUID.test(LISTE_ID) ? "pret" : "incomplet";

let client: SupabaseClient | null = null;
export function db(): SupabaseClient | null {
  if (!URL || !KEY) return null;
  client ??= createClient(URL, KEY);
  return client;
}

export type Liste = { id: string; nom: string; created_at: string };
export type Inscrit = { id: number; email: string; donnees: Record<string, string>; created_at: string };
export type R<T = null> = { ok: true; data: T } | { ok: false; error: string };
const fail = (error: string) => ({ ok: false as const, error });
const NET = "Le service ne répond pas : rien n'a été enregistré. Réessaie dans un instant.";
/** Panne réseau (et non refus de la base) : supabase-js renvoie alors « Failed to fetch » ou équivalent. */
const net = (m: string) => m === NET || /fetch|network|load failed/i.test(m);

async function call(f: (c: SupabaseClient) => PromiseLike<{ data: unknown; error: { message: string } | null }>): Promise<R<unknown>> {
  const c = db();
  if (!c) return fail("La base de données n'est pas configurée.");
  try {
    const { data, error } = await f(c);
    if (error) return fail(error.message || NET);
    return { ok: true, data };
  } catch {
    return fail(NET);
  }
}

/** Inscription publique. Une adresse déjà inscrite reçoit la même réponse (rien n'est révélé). */
export async function inscrire(email: string, donnees: Record<string, string>): Promise<R> {
  if (cloudState !== "pret") return fail("Les inscriptions en ligne ne sont pas encore configurées.");
  const r = await call((c) => c.rpc("inscrire", { p_liste: LISTE_ID, p_email: email, p_donnees: donnees }));
  if (!r.ok) return fail(net(r.error) ? NET : "Inscription impossible : la base de données n'est pas prête (migration non exécutée ?). Rien n'a été enregistré.");
  if (r.data === "email_invalide") return fail("Adresse e-mail invalide.");
  if (r.data === "liste_inconnue") return fail("Cette liste d'attente n'existe pas : l'identifiant NEXT_PUBLIC_LISTE_ID est à vérifier.");
  if (r.data !== "ok") return fail("Inscription refusée : données invalides.");
  return { ok: true, data: null };
}

// ─── Espace propriétaire (connexion Supabase Auth) ───
export async function session(): Promise<Session | null> {
  const c = db();
  if (!c) return null;
  const { data } = await c.auth.getSession();
  return data.session;
}
export function onSession(cb: (s: Session | null) => void): () => void {
  const c = db();
  if (!c) return () => {};
  const { data } = c.auth.onAuthStateChange((_e, s) => cb(s));
  return () => data.subscription.unsubscribe();
}
export async function connexion(email: string, motDePasse: string): Promise<R> {
  const r = await call((c) => c.auth.signInWithPassword({ email: email.trim(), password: motDePasse }));
  if (r.ok) return { ok: true, data: null };
  if (net(r.error)) return fail(NET);
  return fail(/confirm/i.test(r.error) ? "Adresse pas encore confirmée : ouvre le lien reçu par e-mail." : "Connexion refusée : adresse ou mot de passe incorrect.");
}
/** Retourne true si le compte est ouvert tout de suite, false s'il faut d'abord confirmer l'adresse. */
export async function creerCompte(email: string, motDePasse: string): Promise<R<boolean>> {
  if (motDePasse.length < 8) return fail("Le mot de passe doit faire au moins 8 caractères.");
  const r = await call((c) => c.auth.signUp({ email: email.trim(), password: motDePasse }));
  return r.ok ? { ok: true, data: !!(r.data as { session: unknown } | null)?.session } : fail(net(r.error) ? NET : "Création du compte refusée : " + r.error);
}
export async function deconnexion() {
  await db()?.auth.signOut();
}
/** Les listes du compte connecté (la base ne renvoie que les siennes). */
export const mesListes = () => call((c) => c.from("listes").select("id, nom, created_at").order("created_at")).then((r) => r as R<Liste[]>);
export const creerListe = (nom: string) => call((c) => c.from("listes").insert({ nom: nom.trim().slice(0, 120) || "Liste d'attente" }).select("id, nom, created_at").single()).then((r) => r as R<Liste>);
export const inscrits = (liste: string) => call((c) => c.from("inscriptions").select("id, email, donnees, created_at").eq("liste_id", liste).order("created_at", { ascending: false }).limit(5000)).then((r) => r as R<Inscrit[]>);
/** Supprime une inscription ; vérifie qu'une ligne a réellement été supprimée. */
export async function supprimer(id: number): Promise<R> {
  const r = await call((c) => c.from("inscriptions").delete().eq("id", id).select("id"));
  if (!r.ok) return r;
  return (r.data as unknown[]).length === 1 ? { ok: true, data: null } : fail("Suppression refusée : cette inscription n'est pas dans tes listes.");
}
`;

/** components/cloud.tsx : page d'inscription publique et espace propriétaire. */
export const CLOUD_TSX = String.raw`"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { SAAS } from "@/lib/config";
import { isEmail } from "@/lib/rules";
import { cloudState, connexion, creerCompte, creerListe, deconnexion, inscrire, inscrits, LISTE_ID, mesListes, onSession, session, supprimer, type Inscrit, type Liste } from "@/lib/cloud";
import { WaitlistView } from "@/components/views";

const E = SAAS.entite;
const SOURCE = SAAS.statuts.length > 0 ? E.champs[SAAS.statut] ?? "Source" : "";

/** Page publique : base de données si elle est configurée, sinon le mode local d'origine. */
export function WaitlistPage({ titre }: { titre: string }) {
  const [email, setEmail] = useState("");
  const [source, setSource] = useState(SAAS.statuts[0] ?? "");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  if (cloudState === "local") return <WaitlistView titre={titre} />;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!isEmail(email)) { setError("Adresse e-mail invalide."); return; }
    setBusy(true);
    const r = await inscrire(email, SOURCE ? { [SOURCE]: source } : {});
    setBusy(false);
    if (!r.ok) { setError(r.error); return; }
    setError("");
    setEmail("");
    setDone(true);
  }
  return (
    <div className="auth">
      <div className="card auth-c">
        <h1>{titre}</h1>
        <p className="mut">{SAAS.description}</p>
        {cloudState === "incomplet" ? (
          <p className="err" role="alert">Les inscriptions ne sont pas encore ouvertes : la liste d&apos;attente n&apos;est pas configurée (variable NEXT_PUBLIC_LISTE_ID).</p>
        ) : done ? (
          <div role="status"><p className="ok-msg">✓ C&apos;est noté : tu seras prévenu·e au lancement.</p><button className="b" onClick={() => setDone(false)}>Inscrire une autre adresse</button></div>
        ) : (
          <form className="form" onSubmit={submit} noValidate>
            <label htmlFor="wl-email">{E.champs[SAAS.unique ?? 0]}<input id="wl-email" type="email" autoComplete="email" value={email} onChange={(e) => { setEmail(e.target.value); setError(""); }} placeholder="nom@exemple.fr" aria-invalid={error ? true : undefined} aria-describedby={error ? "wl-err" : undefined} /></label>
            {SOURCE && <label htmlFor="wl-src">{SOURCE}<select id="wl-src" value={source} onChange={(e) => setSource(e.target.value)}>{SAAS.statuts.map((s) => <option key={s}>{s}</option>)}</select></label>}
            {error && <p id="wl-err" className="err" role="alert">{error}</p>}
            <button className="b primary lg" disabled={busy}>{busy ? "Envoi…" : "Je m'inscris"}</button>
          </form>
        )}
        <p className="mut xs">Ton adresse sert uniquement à te prévenir du lancement. Tu peux demander sa suppression à tout moment.</p>
        <p className="xs"><Link href="/proprietaire" className="mut">Espace propriétaire</Link></p>
      </div>
    </div>
  );
}

const dateFr = (s: string) => new Date(s).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" });

/** Espace propriétaire : connexion, puis les inscriptions de ses listes (la base filtre le reste). */
export function OwnerView() {
  const [s, setS] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    session().then((x) => { setS(x); setReady(true); });
    return onSession(setS);
  }, []);
  if (cloudState === "local") return (
    <div className="card fiche">
      <h1>Espace propriétaire</h1>
      <p className="err">La base de données n&apos;est pas configurée : les inscriptions restent dans le navigateur de chaque visiteur.</p>
      <p className="mut">Pour recevoir les inscriptions de tes visiteurs, suis la section « Base de données (Supabase) » du README : créer le projet, exécuter la migration, puis renseigner NEXT_PUBLIC_SUPABASE_URL et NEXT_PUBLIC_SUPABASE_ANON_KEY.</p>
    </div>
  );
  if (!ready) return <p className="mut">Chargement…</p>;
  return s ? <Owner email={s.user.email ?? ""} /> : <OwnerLogin />;
}

function OwnerLogin() {
  const [email, setEmail] = useState("");
  const [mdp, setMdp] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  async function go(nouveau: boolean) {
    if (!isEmail(email)) { setMsg({ ok: false, text: "Adresse e-mail invalide." }); return; }
    setBusy(true);
    if (nouveau) {
      const r = await creerCompte(email, mdp);
      setMsg(r.ok ? { ok: true, text: r.data ? "Compte créé." : "Compte créé : confirme ton adresse avec le lien reçu par e-mail, puis connecte-toi." } : { ok: false, text: r.error });
    } else {
      const r = await connexion(email, mdp);
      if (!r.ok) setMsg({ ok: false, text: r.error });
    }
    setBusy(false);
  }
  return (
    <div className="auth">
      <form className="card auth-c form" noValidate onSubmit={(e) => { e.preventDefault(); go(false); }}>
        <h1>Espace propriétaire</h1>
        <p className="mut">Connecte-toi pour consulter les inscriptions à ta liste d&apos;attente.</p>
        <label htmlFor="ow-email">E-mail<input id="ow-email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} /></label>
        <label htmlFor="ow-mdp">Mot de passe<input id="ow-mdp" type="password" autoComplete="current-password" value={mdp} onChange={(e) => setMdp(e.target.value)} /></label>
        {msg && <p className={msg.ok ? "ok-msg" : "err"} role={msg.ok ? "status" : "alert"}>{msg.text}</p>}
        <button className="b primary lg" disabled={busy}>{busy ? "Patiente…" : "Se connecter"}</button>
        <button type="button" className="b" disabled={busy} onClick={() => go(true)}>Créer mon compte</button>
      </form>
    </div>
  );
}

function Owner({ email }: { email: string }) {
  const [listes, setListes] = useState<Liste[] | null>(null);
  const [rows, setRows] = useState<Inscrit[] | null>(null);
  const [error, setError] = useState("");
  const liste = listes?.find((l) => l.id === LISTE_ID) ?? listes?.[0];

  async function load() {
    const r = await mesListes();
    if (!r.ok) { setError(r.error); return; }
    setListes(r.data);
    const l = r.data.find((x) => x.id === LISTE_ID) ?? r.data[0];
    if (!l) { setRows([]); return; }
    const i = await inscrits(l.id);
    if (!i.ok) { setError(i.error); return; }
    setError("");
    setRows(i.data);
  }
  useEffect(() => { load(); }, []);

  async function create() {
    const r = await creerListe(SAAS.nom);
    if (!r.ok) { setError(r.error); return; }
    load();
  }
  async function remove(i: Inscrit) {
    if (!window.confirm("Supprimer l'inscription de " + i.email + " ? Cette action est définitive.")) return;
    const r = await supprimer(i.id);
    if (!r.ok) { setError(r.error); return; }
    setRows((x) => (x ?? []).filter((y) => y.id !== i.id));
  }

  return (
    <div className="stack">
      <div className="ph"><div><h1>Inscriptions</h1><p className="mut">Connecté : {email}</p></div><div className="row"><button className="b" onClick={load}>Actualiser</button><button className="b" onClick={() => deconnexion()}>Se déconnecter</button></div></div>
      {error && <p className="err" role="alert">{error}</p>}
      {listes && !liste && (
        <div className="card fiche"><p>Tu n&apos;as pas encore de liste d&apos;attente.</p><button className="b primary" onClick={create}>Créer ma liste</button></div>
      )}
      {liste && liste.id !== LISTE_ID && (
        <p className="err" role="alert">La page d&apos;inscription n&apos;envoie pas encore vers cette liste. Renseigne NEXT_PUBLIC_LISTE_ID={liste.id} puis redémarre ou redéploie le site.</p>
      )}
      {liste && rows && (rows.length === 0 ? <p className="mut">Aucune inscription pour l&apos;instant.</p> : (
        <div className="card flush" style={{ overflowX: "auto" }}>
          <table>
            <thead><tr><th>E-mail</th>{SOURCE && <th>{SOURCE}</th>}<th>Date</th><th /></tr></thead>
            <tbody>{rows.map((i) => (
              <tr key={i.id}><td><b>{i.email}</b></td>{SOURCE && <td>{i.donnees[SOURCE] ?? "—"}</td>}<td>{dateFr(i.created_at)}</td><td className="r"><button className="b" onClick={() => remove(i)}>Supprimer</button></td></tr>
            ))}</tbody>
          </table>
        </div>
      ))}
      {liste && rows && <p className="mut xs">{rows.length} inscription{rows.length > 1 ? "s" : ""} · liste {liste.id}</p>}
    </div>
  );
}
`;
