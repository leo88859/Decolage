// Kit du générateur pour les SaaS à architecture dédiée (espace de travail, finance, formation,
// relation client, création, e-commerce) : site public + cadre de l'espace utilisateur + écrans.
// Même rôle que proto-arch.ts pour les aperçus, écrit en React. Écrit à l'avance, sans IA.
// Mêmes règles que kit-data.ts : pas d'accent grave ni de « ${ » dans ces textes.

/** components/arch-kit.tsx — outils partagés, état d'interface, petits composants. */
export const ARCH_KIT_TSX = String.raw`"use client";

import { useState, useSyncExternalStore } from "react";
import { SAAS } from "@/lib/config";
import { actions, amount, tone, useStore } from "@/lib/store";
import type { ArchConfig, Item } from "@/lib/types";

// Rôle de chaque colonne (titre, date, montant, groupe…) : défini dans lib/config.ts.
export const A: ArchConfig = SAAS.arch!;
export const R = A.roles;
export const E = SAAS.entite;
export const ST = SAAS.statut;
const POS = /confirm|valid|gagn|pay|résolu|livr|termin|fait|actif/i;

export const val = (i: Item, k: string) => { const j = R[k]; return typeof j === "number" ? i.values[j] ?? "" : ""; };
export const nameOf = (i: Item) => i.values[R.titre ?? 0] ?? "";
export const isDone = (i: Item) => POS.test(i.values[ST] ?? "") || /termin|livr|résolu/i.test(i.values[ST] ?? "");
export const firstStatus = () => SAAS.statuts[0] ?? "";
export const doneStatus = () => SAAS.statuts.find((s) => POS.test(s)) ?? SAAS.statuts[SAAS.statuts.length - 1] ?? "";
export const money = (n: number) => (Object.is(n, -0) ? 0 : n).toLocaleString("fr-FR", { style: "currency", currency: "EUR" });
export const num = (s: string) => amount(s) ?? 0;
export const words = (t: string) => (t.trim() ? t.trim().split(/\s+/).length : 0);
export const groupKey = () => (typeof R.groupe === "number" ? "groupe" : "personne");
export function groupsOf(items: Item[], k: string): string[] {
  const out: string[] = [];
  for (const i of items) { const g = val(i, k); if (g && !out.includes(g)) out.push(g); }
  return out;
}

// Dates écrites en français dans les données (« 2 mai », « 1er juil. », « Demain », « Lundi »).
const MOIS = ["janv", "févr", "mars", "avr", "mai", "juin", "juil", "août", "sept", "oct", "nov", "déc"];
const JOURS = ["dim", "lun", "mar", "mer", "jeu", "ven", "sam"];
export function today() { const d = new Date(); d.setHours(0, 0, 0, 0); return d; }
export function parseDate(s: string): Date | null {
  const t = s.toLowerCase().trim();
  const now = today();
  if (!t || t === "—") return null;
  if (/aujourd/.test(t)) return now;
  if (/demain/.test(t)) return new Date(now.getTime() + 86400000);
  if (/hier/.test(t)) return new Date(now.getTime() - 86400000);
  const m = t.match(/(\d{1,2})(?:er)?\s+([a-zéû]+)/);
  if (m) { const mo = MOIS.findIndex((x) => m[2]!.startsWith(x.slice(0, 3))); if (mo >= 0) return new Date(now.getFullYear(), mo, Number(m[1])); }
  const j = JOURS.findIndex((x) => t.startsWith(x));
  if (j >= 0) { const d = new Date(now); d.setDate(d.getDate() + ((j - d.getDay() + 7) % 7 || 7)); return d; }
  return null;
}
export const fmtDate = (d: Date) => d.toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
const soon = (i: Item) => { const d = parseDate(val(i, "date")); return !!d && d.getTime() - today().getTime() < 7 * 86400000 && !isDone(i); };
/** Listes intelligentes de l'espace de travail. */
export function filterList(items: Item[], list: string) {
  if (list === "all") return items.filter((i) => !isDone(i));
  if (list === "done") return items.filter(isDone);
  if (list === "soon") return items.filter(soon);
  if (list.startsWith("g:")) return items.filter((i) => val(i, groupKey()) === list.slice(2));
  return items;
}
export const screenHref = (view: string) => A.screens.find((s) => s.view === view)?.href ?? "/app";

// État d'interface partagé entre le cadre et les écrans (liste choisie, élément ouvert, période…).
export type Ui = { list: string; sel: string; drawer: boolean; period: string; chip: string; card: number; flip: boolean };
let ui: Ui = { list: "all", sel: "", drawer: false, period: "tout", chip: "", card: 0, flip: false };
const subs = new Set<() => void>();
const sub = (f: () => void) => { subs.add(f); return () => { subs.delete(f); }; };
export const useUi = () => useSyncExternalStore(sub, () => ui, () => ui);
export const setUi = (p: Partial<Ui>) => { ui = { ...ui, ...p }; subs.forEach((f) => f()); };
const none = () => () => {};
/** Vrai une fois dans le navigateur : l'espace utilisateur lit ses données dans localStorage. */
export const useMounted = () => useSyncExternalStore(none, () => true, () => false);
/** Élément ouvert (ou le premier de la liste). */
export function useSelected(items: Item[]) { const { sel } = useUi(); return items.find((i) => i.id === sel) ?? items[0]; }

export function Badge({ s }: { s: string }) {
  return <span className={"bdg " + tone(s)}>{s}</span>;
}
export function Avatar({ n, size = 32 }: { n: string; size?: number }) {
  const t = n || "?";
  return <span className="av" style={{ width: size, height: size, "--h": (t.charCodeAt(0) * 37) % 360 } as React.CSSProperties}>{t.split(" ").map((w) => w[0]).slice(0, 2).join("")}</span>;
}
export function Logo({ size = 30 }: { size?: number }) {
  return <span className="mark" style={{ width: size, height: size }}>{SAAS.initiales}</span>;
}
export function Empty({ t, sub: s }: { t: string; sub: string }) {
  return <div className="empty"><b>{t}</b><p className="mut">{s}</p></div>;
}
export function Ring({ pct, size = 72 }: { pct: number; size?: number }) {
  return <span className="ring-s" style={{ "--v": pct, width: size, height: size } as React.CSSProperties}><span>{pct}%</span></span>;
}

const P = {
  list: "M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01",
  kanban: "M4 4h4v16H4zM10 4h4v10h-4zM16 4h4v13h-4z",
  calendar: "M5 6h14v14H5zM5 10h14M9 3v4M15 3v4",
  settings: "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM4 12h2M18 12h2M12 4v2M12 18v2",
  dashboard: "M4 4h7v7H4zM13 4h7v4h-7zM13 10h7v10h-7zM4 13h7v7H4z",
  table: "M4 5h16v14H4zM4 10h16M10 10v9",
  chart: "M4 19h16M7 16v-5M12 16V8M17 16v-8",
  goals: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8z",
  grid: "M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z",
  play: "M7 5l12 7-12 7z",
  cards: "M6 4h12v16H6zM9 9h6",
  person: "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21a8 8 0 0 1 16 0",
  todo: "M4 12a8 8 0 0 1 14-5.3M20 4v4h-4M20 12a8 8 0 0 1-14 5.3M4 20v-4h4",
  edit: "M4 20h4L19 9l-4-4L4 16zM14 6l4 4",
  bag: "M6 7h12l-1 13H7zM9 7a3 3 0 0 1 6 0",
  activity: "M12 7v5l3 2M4 12a8 8 0 1 0 2.3-5.6M4 4v4h4",
  pricing: "M4 7h16v10H4zM4 11h16M8 15h3",
};
const ICON_OF: Record<string, string> = {
  "ws-list": P.list, "ws-board": P.kanban, "ws-timeline": P.calendar, "fi-overview": P.dashboard, "fi-ledger": P.table, "fi-analysis": P.chart, "fi-goals": P.goals,
  "le-courses": P.grid, "le-player": P.play, "le-cards": P.cards, "le-progress": P.chart, "crm-split": P.person, "crm-pipeline": P.kanban, "crm-followup": P.todo,
  "st-library": P.grid, "st-editor": P.edit, "co-products": P.grid, "co-orders": P.bag, "co-sales": P.chart, settings: P.settings,
  dashboard: P.dashboard, table: P.table, cards: P.list, grid: P.grid, kanban: P.kanban, agenda: P.calendar, todo: P.todo, goals: P.goals, pricing: P.pricing, activity: P.activity,
};
export function Icon({ v, size = 18 }: { v: string; size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={ICON_OF[v] ?? P.list} /></svg>;
}

/** Champs modifiables d'un élément : enregistrés en quittant le champ. */
export function FieldInputs({ item }: { item: Item }) {
  return (
    <div className="kvs1" key={item.id}>
      {E.champs.map((c, j) => (
        <label key={c} className="kv"><span className="mut sm">{c}</span>
          {j === ST
            ? <select value={item.values[j]} onChange={(e) => actions.setStatus(item.id, e.target.value)}>{SAAS.statuts.map((s) => <option key={s}>{s}</option>)}</select>
            : <input defaultValue={item.values[j]} maxLength={500} onBlur={(e) => { if (e.target.value !== item.values[j]) actions.update(item.id, item.values.map((x, k) => (k === j ? e.target.value : x))); }} />}
        </label>
      ))}
    </div>
  );
}

/** Texte libre rattaché à un élément (notes, contenu d'une leçon, corps d'un document). */
export function NoteArea({ id, rows, placeholder, className }: { id: string; rows?: number; placeholder: string; className?: string }) {
  const { notes } = useStore();
  return <textarea className={className} rows={rows} placeholder={placeholder} value={notes[id] ?? ""} maxLength={20000} onChange={(e) => actions.setNote(id, e.target.value)} />;
}

/** Panneau de détail de l'élément ouvert. */
export function Drawer() {
  const { items } = useStore();
  const { sel } = useUi();
  const [confirm, setConfirm] = useState(false);
  const it = items.find((i) => i.id === sel);
  if (!it) return null;
  return (
    <aside className="drawer" aria-label="Détail">
      <div className="row between"><b>Détail</b><button className="ib" onClick={() => setUi({ drawer: false })} aria-label="Fermer">✕</button></div>
      <h2>{nameOf(it)}</h2>
      <FieldInputs item={it} />
      <label className="kv"><span className="mut sm">Notes</span><NoteArea id={it.id} rows={5} placeholder="Ajoute une note…" /></label>
      <div className="row">
        <button className="b primary" onClick={() => actions.setStatus(it.id, isDone(it) ? firstStatus() : doneStatus())}>{isDone(it) ? "Rouvrir" : "Marquer terminé"}</button>
        {confirm
          ? <button className="b danger" onClick={() => { actions.remove(it.id); setUi({ drawer: false }); setConfirm(false); }}>Confirmer la suppression</button>
          : <button className="b danger" onClick={() => setConfirm(true)}>Supprimer</button>}
      </div>
    </aside>
  );
}
`;

/** components/site.tsx — site public : en-tête, accueil (composition propre au design), fonctionnalités, tarifs, comptes. */
export const SITE_TSX = String.raw`"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { A, Badge, E, Icon, Logo, nameOf } from "@/components/arch-kit";
import { PricingView } from "@/components/views";
import { SAAS } from "@/lib/config";
import { actions, useStore } from "@/lib/store";

const NAV = A.site.filter((p) => p.id !== "connexion" && p.id !== "inscription");

export function SiteShell({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const { session } = useStore();
  return (
    <div className="mode-site">
      <header className="site-h">
        <Link className="brand" href="/"><Logo size={30} /><b>{SAAS.nom}</b></Link>
        <nav aria-label="Site">{NAV.map((p) => <Link key={p.id} href={p.href} className={path === p.href ? "on" : ""}>{p.titre}</Link>)}</nav>
        <div className="row">
          {!A.accounts ? <Link className="b primary sm" href="/app">Ouvrir l&apos;application →</Link>
            : session ? <Link className="b primary sm" href="/app">Mon espace →</Link>
            : <><Link className="b sm ghost-l" href="/connexion">Connexion</Link><Link className="b primary sm" href="/inscription">Essai gratuit</Link></>}
        </div>
      </header>
      <main className="site-main">{children}</main>
      <footer className="site-f">
        <div><b>{SAAS.nom}</b><p className="mut sm">{SAAS.cible}</p></div>
        <div className="row">{A.site.map((p) => <Link key={p.id} href={p.href}>{p.titre}</Link>)}</div>
      </footer>
    </div>
  );
}

/** Aperçu de l'application sur l'accueil : les vraies données, dans le cadre de l'architecture. */
function Mock() {
  const { items } = useStore();
  return (
    <div className={"mock-app frame-" + A.frame}>
      <div className="mock-bar"><i /><i /><i /><span>{SAAS.nom}</span></div>
      <div className="mock-body">
        <div className="mock-nav">{A.screens.slice(0, 4).map((s, i) => <span key={s.id} className={i ? "" : "on"}>{s.titre}</span>)}</div>
        <div className="mock-rows">{items.slice(0, 4).map((i) => <div key={i.id}><b>{nameOf(i)}</b><Badge s={i.values[SAAS.statut] ?? ""} /></div>)}</div>
      </div>
    </div>
  );
}
function Feats() {
  return <>{SAAS.fonctionnalites.map(([a, b], i) => <div key={a} className="hf"><span className="hf-n">{String(i + 1).padStart(2, "0")}</span><b>{a}</b><p className="mut">{b}</p></div>)}</>;
}
function Cta() {
  return (
    <>
      <Link className="b primary lg" href={A.accounts ? "/inscription" : "/app"}>{A.accounts ? "Créer mon compte" : "Commencer"} →</Link>
      <Link className="b lg" href="/fonctionnalites">Voir les fonctionnalités</Link>
    </>
  );
}

export function Home() {
  const { items } = useStore();
  const title = SAAS.heroTitre || SAAS.nom;
  switch (A.home) {
    case "editorial":
      return (
        <>
          <section className="h-ed"><span className="tag">{SAAS.cible}</span><h1>{title}</h1><div className="h-ed-cols"><p className="lead">{SAAS.description}</p><div className="row"><Cta /></div></div></section>
          <section className="h-ed-list"><Feats /></section>
          <section className="h-quote"><p>« {SAAS.fonctionnalites[0]?.[1] ?? SAAS.description} »</p></section>
        </>
      );
    case "bento":
      return (
        <section className="h-bento">
          <div className="hb-main"><span className="tag">{SAAS.cible}</span><h1>{title}</h1><p className="lead">{SAAS.description}</p><div className="row"><Cta /></div></div>
          {SAAS.fonctionnalites.slice(0, 3).map(([a, b], i) => <div key={a} className={"hb-tile t" + i}><b>{a}</b><p>{b}</p></div>)}
          <div className="hb-tile t-app"><Mock /></div>
          <div className="hb-tile t-num"><span className="big">{items.length}</span><span>{E.pluriel.toLowerCase()} dans ton espace</span></div>
        </section>
      );
    case "asym":
      return (
        <>
          <section className="h-asym"><h1><span>{title}</span></h1><div className="h-asym-side"><p className="lead">{SAAS.description}</p><div className="row"><Cta /></div></div><div className="h-asym-mock"><Mock /></div></section>
          <section className="h-asym-feats"><Feats /></section>
        </>
      );
    case "terminal":
      return (
        <section className="h-term">
          <div className="term-win">
            <div className="term-h"><i /><i /><i /></div>
            <p><span className="mut">$</span> {SAAS.nom.toLowerCase().replace(/\s+/g, "-")} --demarrer</p>
            <h1>{title}</h1>
            <p className="mut">{SAAS.description}</p>
            {SAAS.fonctionnalites.map(([a]) => <p key={a}><span className="ok">✓</span> {a}</p>)}
            <div className="row" style={{ marginTop: 18 }}><Cta /></div>
          </div>
        </section>
      );
    case "split":
      return (
        <>
          <section className="h-split"><div><span className="tag">{SAAS.cible}</span><h1>{title}</h1><p className="lead">{SAAS.description}</p><div className="row"><Cta /></div></div><Mock /></section>
          <section className="h-grid"><Feats /></section>
        </>
      );
    default:
      return (
        <>
          <section className="h-centre"><span className="tag">{SAAS.cible}</span><h1>{title}</h1><p className="lead">{SAAS.description}</p><div className="row center"><Cta /></div><Mock /></section>
          <section className="h-grid"><Feats /></section>
        </>
      );
  }
}

export function Features() {
  return (
    <>
      <section className="site-sec"><span className="tag">Fonctionnalités</span><h1>Tout ce que fait {SAAS.nom}</h1><div className="h-grid"><Feats /></div></section>
      <section className="site-sec alt">
        <h2>Dans l&apos;application</h2>
        <div className="scr-list">{A.screens.map((s) => <div key={s.id} className="scr"><span className="feat-ic"><Icon v={s.view} size={20} /></span><b>{s.titre}</b></div>)}</div>
        <div className="row" style={{ marginTop: 22 }}><Cta /></div>
      </section>
    </>
  );
}

export function Pricing() {
  return <section className="site-sec"><PricingView titre="Tarifs" /></section>;
}

/** Compte local : enregistré dans ce navigateur, sans mot de passe ni serveur. */
export function Auth({ signup }: { signup?: boolean }) {
  const router = useRouter();
  const [err, setErr] = useState("");
  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const email = String(f.get("email") ?? "");
    if (signup) { actions.signup(String(f.get("nom") ?? ""), email); router.push("/app"); return; }
    if (actions.login(email)) router.push("/app");
    else setErr("Aucun compte avec cet email dans ce navigateur. Crée-le d'abord.");
  }
  return (
    <section className="site-auth">
      <div className="card auth-c">
        <div className="logo-l"><Logo size={44} /></div>
        <h1>{signup ? "Créer un compte" : "Connexion"}</h1>
        <form className="form" onSubmit={submit}>
          {signup && <label>Nom<input name="nom" required maxLength={80} placeholder="Ton nom" /></label>}
          <label>Email<input type="email" name="email" required maxLength={120} placeholder="toi@exemple.fr" /></label>
          <button className="b primary lg">{signup ? "Créer mon compte" : "Se connecter"}</button>
          {err && <p className="neg sm" role="alert">{err}</p>}
        </form>
        <p className="mut sm">{signup ? <>Déjà inscrit ? <Link href="/connexion">Connexion</Link></> : <>Pas encore de compte ? <Link href="/inscription">Inscription</Link></>}</p>
        <p className="mut xs">Compte local : enregistré seulement dans ce navigateur, sans mot de passe ni serveur. Ce n&apos;est pas une vraie authentification (voir le README).</p>
      </div>
    </section>
  );
}
`;

/** components/frame.tsx — cadre de l'espace utilisateur, propre à chaque architecture. */
export const FRAME_TSX = String.raw`"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { A, Avatar, Drawer, E, filterList, groupKey, groupsOf, Icon, Logo, R, screenHref, setUi, useMounted, useUi, val } from "@/components/arch-kit";
import { SAAS } from "@/lib/config";
import { storageError, useStore } from "@/lib/store";

const NAV = [...A.screens, ...A.extras.map((p) => ({ id: p.id, titre: p.titre, view: p.kind as string, href: p.href }))];
const LISTS: [string, string][] = [["all", "Toutes"], ["soon", "Bientôt"], ["done", "Terminées"]];
const PERIODS: [string, string][] = [["tout", "Toute la période"], ["3m", "3 derniers mois"], ["1m", "Dernier mois"]];

export function AppFrame({ children }: { children: React.ReactNode }) {
  const mounted = useMounted();
  const path = usePathname();
  const state = useStore();
  const ui = useUi();
  if (!mounted) return <div className="boot mut">Chargement…</div>;
  if (A.accounts && !state.session) {
    return (
      <div className="site-auth">
        <div className="card auth-c">
          <div className="logo-l"><Logo size={44} /></div>
          <h1>Connexion requise</h1>
          <p className="mut">L&apos;espace {SAAS.nom} s&apos;ouvre avec un compte créé dans ce navigateur.</p>
          <div className="row"><Link className="b primary" href="/connexion">Se connecter</Link><Link className="b" href="/inscription">Créer un compte</Link><Link className="b" href="/">Retour au site</Link></div>
        </div>
      </div>
    );
  }
  const cur = NAV.find((p) => p.href === path) ?? NAV[0]!;
  const tabs = (cls: string) => (
    <nav className={cls} aria-label="Navigation de l'application">
      {NAV.map((p) => <Link key={p.id} href={p.href} data-t={p.titre} className={p.href === cur.href ? "on" : ""}><Icon v={p.view} /><span>{p.titre}</span></Link>)}
    </nav>
  );
  const me = <Link className="me-c" href={screenHref("settings")} title="Paramètres"><Avatar n={state.compte?.nom || state.profil.nom || "Moi"} size={30} /></Link>;
  const site = <Link className="b sm" href="/" title="Retour au site">Site</Link>;
  const err = storageError();
  const main = (cls: string) => <main className={cls}>{err && <div className="card" role="alert">{err}</div>}<div className="enter">{children}</div></main>;
  let body: React.ReactNode;
  if (A.frame === "board") {
    const gk = groupKey();
    body = (
      <>
        <header className="app-top"><Logo size={28} /><b>{SAAS.nom}</b>{tabs("tabs-h")}<div className="row" style={{ marginLeft: "auto" }}>{site}{me}</div></header>
        <div className="board-wrap">
          <aside className="lists">
            <span className="mut xs up">Listes</span>
            {LISTS.map(([k, l]) => <Link key={k} href={screenHref("ws-list")} className={ui.list === k ? "on" : ""} onClick={() => setUi({ list: k, drawer: false })}>{l}<em>{filterList(state.items, k).length}</em></Link>)}
            <span className="mut xs up">{E.champs[R[gk] ?? 0]}</span>
            {groupsOf(state.items, gk).map((g) => (
              <Link key={g} href={screenHref("ws-list")} className={ui.list === "g:" + g ? "on" : ""} onClick={() => setUi({ list: "g:" + g, drawer: false })}>
                <i className="dotc" style={{ "--h": (g.charCodeAt(0) * 47) % 360 } as React.CSSProperties} />{g}<em>{state.items.filter((i) => val(i, gk) === g).length}</em>
              </Link>
            ))}
          </aside>
          {main("")}
          {ui.drawer && <Drawer />}
        </div>
      </>
    );
  } else if (A.frame === "ledger") {
    body = (
      <>
        <header className="ledger-h">
          <div className="row"><Logo size={30} /><b>{SAAS.nom}</b></div>
          {tabs("tabs-u")}
          <div className="row"><select value={ui.period} onChange={(e) => setUi({ period: e.target.value })} aria-label="Période">{PERIODS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>{site}{me}</div>
        </header>
        {main("ledger-main")}
      </>
    );
  } else if (A.frame === "course") {
    body = <><header className="course-h"><div className="row"><Logo size={30} /><b>{SAAS.nom}</b></div>{tabs("tabs-c")}<div className="row">{site}{me}</div></header>{main("course-main")}</>;
  } else if (A.frame === "split") {
    body = (
      <>
        <aside className="rail-n"><Logo size={34} />{tabs("rail-links")}<div style={{ marginTop: "auto" }}>{me}</div></aside>
        <div className="split-wrap"><header className="split-h"><b>{cur.titre}</b><div className="row">{site}</div></header>{main("split-main")}</div>
      </>
    );
  } else if (A.frame === "studio") {
    body = <><header className="studio-h"><Logo size={26} /><b>{SAAS.nom}</b>{tabs("tabs-s")}<div className="row" style={{ marginLeft: "auto" }}>{site}{me}</div></header>{main("studio-main")}</>;
  } else {
    body = <><header className="store-h"><div className="row"><Logo size={28} /><b>{SAAS.nom}</b><span className="mut sm">Administration</span></div><div className="row">{site}{me}</div></header>{tabs("store-sub")}{main("store-main")}</>;
  }
  return (
    <div className={"mode-app frame-" + A.frame}>
      {body}
      <div className="badge-proto saved" title="Les données restent dans ce navigateur">● Données enregistrées dans ce navigateur</div>
    </div>
  );
}
`;

/** components/screens.tsx — les écrans de chaque architecture. */
export const SCREENS_TSX = String.raw`"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { A, Avatar, Badge, doneStatus, Drawer, E, Empty, FieldInputs, filterList, firstStatus, fmtDate, groupKey, groupsOf, isDone, money, nameOf, NoteArea, num, parseDate, R, Ring, screenHref, setUi, ST, today, useSelected, useUi, val, words } from "@/components/arch-kit";
import { GoalsView, KanbanView, SettingsView, TodoView, useEditor } from "@/components/views";
import { SAAS } from "@/lib/config";
import { actions, useStore } from "@/lib/store";
import type { Item } from "@/lib/types";

export function Screen({ view, titre }: { view: string; titre: string }) {
  switch (view) {
    case "ws-list": return <WsList titre={titre} />;
    case "ws-timeline": return <WsTimeline titre={titre} />;
    case "ws-board": case "crm-pipeline": return <KanbanView titre={titre} />;
    case "fi-overview": return <FiOverview />;
    case "fi-ledger": return <FiLedger titre={titre} />;
    case "fi-analysis": return <FiAnalysis titre={titre} />;
    case "fi-goals": return <GoalsView titre={titre} />;
    case "le-courses": return <LeCourses titre={titre} />;
    case "le-player": return <LePlayer />;
    case "le-cards": return <LeCards titre={titre} />;
    case "le-progress": return <LeProgress titre={titre} />;
    case "crm-split": return <CrmSplit />;
    case "crm-followup": return <TodoView titre={titre} />;
    case "st-library": return <StLibrary titre={titre} />;
    case "st-editor": return <StEditor />;
    case "co-products": return <CoProducts titre={titre} />;
    case "co-orders": return <CoOrders titre={titre} />;
    case "co-sales": return <CoSales titre={titre} />;
    default: return <Settings titre={titre} />;
  }
}

function Head({ titre, children }: { titre: string; children?: React.ReactNode }) {
  return <div className="ws-head"><h1>{titre}</h1>{children && <div className="row">{children}</div>}</div>;
}
const Bar = ({ pct }: { pct: number }) => <span className="pbar"><i style={{ width: pct + "%" }} /></span>;
const prog = (i: Item) => (typeof R.progression === "number" ? parseInt(i.values[R.progression] ?? "", 10) || 0 : null);
const pct = (a: number, b: number) => Math.round((a / Math.max(1, b)) * 100);

// ─── Espace de travail ───
function WsList({ titre }: { titre: string }) {
  const { items } = useStore();
  const ui = useUi();
  const ed = useEditor();
  const [q, setQ] = useState("");
  const [t, setT] = useState("");
  const gk = groupKey();
  const rows = filterList(items, ui.list).filter((i) => !q || i.values.join(" ").toLowerCase().includes(q.toLowerCase()));
  return (
    <>
      <Head titre={titre}>
        <label className="search"><input type="search" placeholder="Rechercher…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Rechercher" /></label>
        <button className="b primary" onClick={() => ed.open("new")}>+ {E.nom}</button>
      </Head>
      <form className="quick" onSubmit={(e) => { e.preventDefault(); if (!t.trim()) return; actions.add(E.champs.map((_, j) => (j === (R.titre ?? 0) ? t : j === ST ? firstStatus() : ""))); setT(""); }}>
        <input value={t} onChange={(e) => setT(e.target.value)} maxLength={500} placeholder={"+ Ajouter : " + E.nom.toLowerCase() + " (Entrée pour valider)"} aria-label="Ajout rapide" />
      </form>
      {rows.length ? (
        <div className="ws-rows">
          {rows.map((i) => {
            const p = prog(i);
            return (
              <div key={i.id} className={"ws-row" + (isDone(i) ? " done" : "") + (ui.drawer && ui.sel === i.id ? " on" : "")}>
                <input type="checkbox" checked={isDone(i)} onChange={(e) => actions.setStatus(i.id, e.target.checked ? doneStatus() : firstStatus())} aria-label={"Terminé : " + nameOf(i)} />
                <button className="ws-t" onClick={() => setUi({ sel: i.id, drawer: true })}>{nameOf(i)}</button>
                {p !== null && <Bar pct={p} />}
                {val(i, gk) && <span className="chip-s">{val(i, gk)}</span>}
                {val(i, "date") && <span className="mut sm">{val(i, "date")}</span>}
                <Badge s={i.values[ST] ?? ""} />
              </div>
            );
          })}
        </div>
      ) : <Empty t="Rien ici" sub="Change de liste ou ajoute un élément." />}
      {ed.modal}
    </>
  );
}

function WsTimeline({ titre }: { titre: string }) {
  const { items } = useStore();
  const ed = useEditor();
  const now = today().getTime();
  const rows = items.map((i) => ({ i, d: parseDate(val(i, "date")) })).sort((a, b) => (a.d ? a.d.getTime() : 9e15) - (b.d ? b.d.getTime() : 9e15));
  const bucket = (d: Date | null) => (!d ? "Sans date" : d.getTime() < now ? "En retard" : d.getTime() - now < 7 * 86400000 ? "Cette semaine" : "Plus tard");
  const groups = ["En retard", "Cette semaine", "Plus tard", "Sans date"].map((b) => ({ b, list: rows.filter((x) => bucket(x.d) === b) })).filter((g) => g.list.length);
  return (
    <>
      <Head titre={titre}><button className="b primary" onClick={() => ed.open("new")}>+ {E.nom}</button></Head>
      {groups.length ? groups.map((g) => (
        <section key={g.b} className="tl-group">
          <h3>{g.b} <span className="mut sm">{g.list.length}</span></h3>
          {g.list.map((x) => {
            const p = prog(x.i);
            return <button key={x.i.id} className="tl-item" onClick={() => setUi({ sel: x.i.id, drawer: true })}><span className="tl-date">{x.d ? fmtDate(x.d) : "—"}</span><b>{nameOf(x.i)}</b>{p !== null ? <Bar pct={p} /> : <span />}<Badge s={x.i.values[ST] ?? ""} /></button>;
          })}
        </section>
      )) : <Empty t="Rien de prévu" sub="Ajoute un élément avec une date." />}
      {ed.modal}
    </>
  );
}

// ─── Finance ───
type Tx = { i: Item; a: number; d: Date | null };
function useTx(): Tx[] {
  const { items } = useStore();
  const { period } = useUi();
  const all = items.map((i) => ({ i, a: num(val(i, "montant")), d: parseDate(val(i, "date")) }));
  if (period === "tout") return all;
  const max = Math.max(...all.map((x) => (x.d ? x.d.getTime() : 0)));
  const span = (period === "1m" ? 31 : 92) * 86400000;
  return all.filter((x) => x.d && max - x.d.getTime() <= span);
}
const time = (x: Tx) => (x.d ? x.d.getTime() : 0);
const catLabel = () => (E.champs[R.groupe ?? 0] ?? "catégorie").toLowerCase();

function LineChart({ points }: { points: number[] }) {
  const pts = points.length >= 2 ? points : [0, ...points, ...(points.length ? [] : [0])];
  const W = 640, H = 200, min = Math.min(0, ...pts), max = Math.max(1, ...pts);
  const x = (i: number) => (i * W) / (pts.length - 1);
  const y = (n: number) => H - 14 - ((n - min) / (max - min || 1)) * (H - 28);
  const d = pts.map((p, i) => (i ? "L" : "M") + x(i).toFixed(1) + "," + y(p).toFixed(1)).join(" ");
  return (
    <svg viewBox={"0 0 " + W + " " + H} className="chart" role="img" aria-label="Évolution du solde">
      <line x1="0" x2={W} y1={y(0)} y2={y(0)} className="axis" />
      <path className="area" d={d + " L" + W + "," + y(0) + " L0," + y(0) + " Z"} fill="color-mix(in srgb,var(--p) 14%,transparent)" />
      <path className="line" d={d} pathLength={1} />
      {pts.map((p, i) => <circle key={i} cx={x(i)} cy={y(p)} r="9" fill="transparent"><title>{money(p)}</title></circle>)}
    </svg>
  );
}

function FiOverview() {
  const t = useTx().slice().sort((a, b) => time(a) - time(b));
  const inc = t.filter((x) => x.a > 0).reduce((s, x) => s + x.a, 0);
  const exp = t.filter((x) => x.a < 0).reduce((s, x) => s + x.a, 0);
  let run = 0;
  const pts = t.map((x) => (run += x.a));
  const cats = groupsOf(t.map((x) => x.i), "groupe").map((g) => ({ g, n: t.filter((x) => val(x.i, "groupe") === g).reduce((s, x) => s + Math.abs(x.a), 0) })).filter((c) => c.n).sort((a, b) => b.n - a.n);
  const tot = Math.max(1, cats.reduce((s, c) => s + c.n, 0));
  return (
    <>
      <div className="fi-hero">
        <div><span className="mut sm">Solde de la période</span><div className="fi-big">{money(inc + exp)}</div></div>
        <div className="fi-pair">
          <div><span className="mut sm">Entrées</span><b className="pos">{money(inc)}</b></div>
          <div><span className="mut sm">Sorties</span><b className="neg">{money(Math.abs(exp))}</b></div>
          <div><span className="mut sm">{E.pluriel}</span><b>{t.length}</b></div>
        </div>
      </div>
      <div className="split">
        <div className="card"><b>Évolution du solde</b><LineChart points={pts} /></div>
        <div className="card">
          <b>Par {catLabel()}</b>
          <div className="cat-bars">
            {cats.length ? cats.map((c) => <div key={c.g} className="cat-b"><span>{c.g}</span><div className="gbar"><i style={{ width: (c.n / tot) * 100 + "%" }} /></div><b className="sm">{money(c.n)}</b></div>) : <p className="mut sm">Aucune donnée sur la période.</p>}
          </div>
        </div>
      </div>
    </>
  );
}

function FiLedger({ titre }: { titre: string }) {
  const t = useTx().slice().sort((a, b) => time(b) - time(a));
  const ui = useUi();
  const [form, setForm] = useState<string[]>(() => E.champs.map((_, j) => (j === R.date ? fmtDate(today()) : j === ST ? firstStatus() : "")));
  const set = (j: number, v: string) => setForm(form.map((x, k) => (k === j ? v : x)));
  const months: { k: string; list: Tx[] }[] = [];
  for (const x of t) {
    const k = x.d ? x.d.toLocaleDateString("fr-FR", { month: "long", year: "numeric" }) : "Sans date";
    let m = months.find((y) => y.k === k);
    if (!m) { m = { k, list: [] }; months.push(m); }
    m.list.push(x);
  }
  return (
    <>
      <Head titre={titre} />
      <form className="ledger-add card" onSubmit={(e) => { e.preventDefault(); if (!form[R.titre ?? 0]?.trim()) return; actions.add(form); setForm(form.map((x, j) => (j === R.date || j === ST ? x : ""))); }}>
        {E.champs.map((c, j) => j === ST
          ? <select key={c} aria-label={c} value={form[j]} onChange={(e) => set(j, e.target.value)}>{SAAS.statuts.map((s) => <option key={s}>{s}</option>)}</select>
          : <input key={c} aria-label={c} required={j === R.titre} maxLength={500} placeholder={c + (j === R.montant ? " (ex. −12 €)" : "")} value={form[j]} onChange={(e) => set(j, e.target.value)} />)}
        <button className="b primary">Ajouter</button>
      </form>
      {months.length ? months.map((m) => {
        const s = m.list.reduce((a, x) => a + x.a, 0);
        return (
          <section key={m.k} className="month">
            <div className="month-h"><b style={{ textTransform: "capitalize" }}>{m.k}</b><b className={s >= 0 ? "pos" : "neg"}>{money(s)}</b></div>
            {m.list.map((x) => <button key={x.i.id} className="tx-row" onClick={() => setUi({ sel: x.i.id, drawer: true })}><span className="mut sm">{val(x.i, "date")}</span><b>{val(x.i, "titre")}</b><span className="chip-s">{val(x.i, "groupe")}</span><b className={x.a >= 0 ? "pos" : "neg"}>{val(x.i, "montant")}</b></button>)}
          </section>
        );
      }) : <Empty t="Aucune transaction" sub="Ajoute ta première ligne ci-dessus." />}
      {ui.drawer && <div className="modal-inline"><Drawer /></div>}
    </>
  );
}

function FiAnalysis({ titre }: { titre: string }) {
  const t = useTx();
  const cats = groupsOf(t.map((x) => x.i), "groupe").map((g) => { const l = t.filter((x) => val(x.i, "groupe") === g); return { g, s: l.reduce((a, x) => a + x.a, 0) }; });
  const max = Math.max(1, ...cats.map((c) => Math.abs(c.s)));
  const top = t.slice().sort((a, b) => Math.abs(b.a) - Math.abs(a.a)).slice(0, 5);
  const avg = t.length ? t.reduce((s, x) => s + x.a, 0) / t.length : 0;
  return (
    <>
      <Head titre={titre}><span className="mut">Moyenne par ligne : <b>{money(avg)}</b></span></Head>
      <div className="split">
        <div className="card">
          <b>Total par {catLabel()}</b>
          <svg viewBox={"0 0 460 " + (cats.length * 36 + 6)} className="chart" role="img" aria-label={"Total par " + catLabel()}>
            {cats.map((c, i) => (
              <g key={c.g} transform={"translate(0," + (i * 36 + 4) + ")"}>
                <text x="0" y="17" fontSize="13" fill="currentColor">{c.g}</text>
                <rect x="130" y="4" width={Math.max(3, (Math.abs(c.s) / max) * 220)} height="20" rx="5" className="bar" style={{ fill: c.s >= 0 ? "#16a34a" : "#e11d48" }}><title>{money(c.s)}</title></rect>
                <text x={140 + (Math.abs(c.s) / max) * 220} y="18" fontSize="12.5" fill="currentColor">{money(c.s)}</text>
              </g>
            ))}
          </svg>
        </div>
        <div className="card">
          <b>Plus gros montants</b>
          <div className="mini-list">
            {top.map((x) => <Link key={x.i.id} className="mini" href={screenHref("fi-ledger")} onClick={() => setUi({ sel: x.i.id, drawer: true })}><span className="grow"><b>{val(x.i, "titre")}</b><span className="mut sm">{val(x.i, "groupe")} · {val(x.i, "date")}</span></span><b className={x.a >= 0 ? "pos" : "neg"}>{money(x.a)}</b></Link>)}
          </div>
        </div>
      </div>
    </>
  );
}

// ─── Formation ───
function useModules() {
  const { items } = useStore();
  return groupsOf(items, "groupe").map((g) => ({ g, list: items.filter((i) => val(i, "groupe") === g) }));
}

function LeCourses({ titre }: { titre: string }) {
  const { items } = useStore();
  const mods = useModules();
  return (
    <>
      <div className="course-hero"><h1>{titre}</h1><p className="mut">{items.filter(isDone).length} leçon(s) terminée(s) sur {items.length}</p></div>
      {mods.length ? (
        <div className="course-grid">
          {mods.map((m, k) => {
            const p = pct(m.list.filter(isDone).length, m.list.length);
            const next = m.list.find((i) => !isDone(i)) ?? m.list[0]!;
            return (
              <div key={m.g} className="course-card" style={{ "--h": (k * 67 + 200) % 360 } as React.CSSProperties}>
                <div className="course-cover"><span>{String(k + 1).padStart(2, "0")}</span></div>
                <div className="course-body">
                  <div className="row between"><b>{m.g}</b><Ring pct={p} size={56} /></div>
                  <p className="mut sm">{m.list.length} leçon(s) · {m.list.slice(0, 2).map((i) => nameOf(i)).join(", ")}</p>
                  <Link className="b primary sm" href={screenHref("le-player")} onClick={() => setUi({ sel: next.id })}>{p === 100 ? "Revoir" : p ? "Continuer" : "Commencer"} →</Link>
                </div>
              </div>
            );
          })}
        </div>
      ) : <Empty t="Aucun cours" sub="Ajoute des leçons depuis l'écran Leçon." />}
    </>
  );
}

function LePlayer() {
  const { items } = useStore();
  const mods = useModules();
  const r = useSelected(items);
  const ed = useEditor();
  if (!r) return <><Empty t="Aucune leçon" sub="Ajoute une leçon pour commencer." /><button className="b primary" onClick={() => ed.open("new")}>+ {E.nom}</button>{ed.modal}</>;
  const idx = items.indexOf(r);
  return (
    <div className="player-wrap">
      <aside className="syllabus">
        {mods.map((m) => (
          <div key={m.g} style={{ display: "contents" }}>
            <b className="mut xs up">{m.g}</b>
            {m.list.map((x) => <button key={x.id} className={"syl" + (x.id === r.id ? " on" : "")} onClick={() => setUi({ sel: x.id })}><span className={"syl-c" + (isDone(x) ? " ok" : "")}>{isDone(x) ? "✓" : ""}</span>{nameOf(x)}<span className="mut xs">{val(x, "duree")}</span></button>)}
          </div>
        ))}
        <button className="b sm" onClick={() => ed.open("new")}>+ {E.nom}</button>
      </aside>
      <article className="lesson-a">
        <span className="tag">{val(r, "groupe")} · {val(r, "duree")}</span>
        <h1>{nameOf(r)}</h1>
        <div className="lesson-video">Emplacement de la vidéo (à ajouter)</div>
        <label className="kv"><span className="mut sm">Contenu de la leçon</span><NoteArea id={r.id} rows={8} placeholder="Écris ici le contenu de la leçon…" /></label>
        <div className="row between">
          <button className="b" disabled={idx <= 0} onClick={() => setUi({ sel: items[idx - 1]!.id })}>← Précédente</button>
          <button className="b primary" onClick={() => actions.setStatus(r.id, isDone(r) ? firstStatus() : doneStatus())}>{isDone(r) ? "Marquer à refaire" : "Marquer comme terminée ✓"}</button>
          <button className="b" disabled={idx >= items.length - 1} onClick={() => setUi({ sel: items[idx + 1]!.id })}>Suivante →</button>
        </div>
      </article>
      {ed.modal}
    </div>
  );
}

function LeCards({ titre }: { titre: string }) {
  const { items, notes } = useStore();
  const ui = useUi();
  const n = items.length;
  const r = n ? items[ui.card % n] : null;
  if (!r) return <Empty t="Aucune fiche" sub="Ajoute des leçons pour créer des fiches." />;
  return (
    <div className="cards-wrap">
      <h1>{titre}</h1>
      <p className="mut">Clique sur la carte pour la retourner. {(ui.card % n) + 1} / {n}</p>
      <button className={"flash" + (ui.flip ? " flip" : "")} onClick={() => setUi({ flip: !ui.flip })}>
        <span className="face front"><span className="mut xs up">{val(r, "groupe")}</span><b>{nameOf(r)}</b></span>
        <span className="face back">{notes[r.id] || [val(r, "groupe"), val(r, "duree"), r.values[ST] ?? ""].filter(Boolean).join(" · ")}</span>
      </button>
      <div className="row center">
        <button className="b" onClick={() => setUi({ flip: false, card: (ui.card - 1 + n) % n })}>← Précédente</button>
        <button className="b primary" onClick={() => setUi({ flip: false, card: (ui.card + 1) % n })}>Suivante →</button>
      </div>
    </div>
  );
}

function LeProgress({ titre }: { titre: string }) {
  const { items } = useStore();
  const mods = useModules();
  const done = items.filter(isDone).length;
  const minutes = items.reduce((s, i) => s + (parseInt(val(i, "duree"), 10) || 0), 0);
  return (
    <>
      <Head titre={titre} />
      <div className="prog-hero card"><Ring pct={pct(done, items.length)} size={120} /><div><b style={{ fontSize: 22 }}>{done} / {items.length} leçons</b><p className="mut">{minutes} min de contenu au total</p></div></div>
      <div className="card" style={{ marginTop: 14 }}>
        {mods.map((m) => { const d = m.list.filter(isDone).length; return <div key={m.g} className="cat-b"><span>{m.g}</span><div className="gbar"><i style={{ width: pct(d, m.list.length) + "%" }} /></div><b className="sm">{d}/{m.list.length}</b></div>; })}
      </div>
    </>
  );
}

// ─── Relation client ───
function CrmSplit() {
  const { items, log } = useStore();
  const ed = useEditor();
  const r = useSelected(items);
  const [q, setQ] = useState("");
  const [confirm, setConfirm] = useState(false);
  const rows = items.filter((i) => !q || i.values.join(" ").toLowerCase().includes(q.toLowerCase()));
  const hist = r ? log.filter((l) => l.text.includes(nameOf(r))).slice(0, 6) : [];
  return (
    <div className="crm">
      <div className="crm-list">
        <div className="row"><label className="search" style={{ flex: 1 }}><input type="search" placeholder="Rechercher…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Rechercher" /></label><button className="ib" onClick={() => ed.open("new")} aria-label="Ajouter">+</button></div>
        {rows.map((x) => <button key={x.id} className={"crm-item" + (r && x.id === r.id ? " on" : "")} onClick={() => { setUi({ sel: x.id }); setConfirm(false); }}><Avatar n={nameOf(x)} size={34} /><span className="grow"><b>{nameOf(x)}</b><span className="mut sm">{val(x, "personne")}</span></span><Badge s={x.values[ST] ?? ""} /></button>)}
        {!rows.length && <p className="mut sm">Aucun résultat.</p>}
      </div>
      {r ? (
        <div className="crm-sheet">
          <div className="crm-sheet-h">
            <Avatar n={nameOf(r)} size={56} />
            <div><h1>{nameOf(r)}</h1><p className="mut">{val(r, "personne")}</p></div>
            <div className="row r">{SAAS.statuts.map((s) => <button key={s} className={"chip" + (r.values[ST] === s ? " on" : "")} onClick={() => actions.setStatus(r.id, s)}>{s}</button>)}</div>
          </div>
          <div className="crm-cols">
            <FieldInputs item={r} />
            <div>
              <label className="kv"><span className="mut sm">Notes</span><NoteArea id={r.id} rows={6} placeholder="Compte rendu d'appel, besoin, budget…" /></label>
              <b className="sm">Historique</b>
              <div className="timeline">{hist.length ? hist.map((l, k) => <div key={k} className="tl"><i /><span>{l.text}</span><span className="mut xs">{new Date(l.at).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" })}</span></div>) : <p className="mut sm">Aucune action pour l&apos;instant.</p>}</div>
            </div>
          </div>
          <div className="row">{confirm ? <button className="b danger" onClick={() => { actions.remove(r.id); setConfirm(false); }}>Confirmer la suppression</button> : <button className="b danger" onClick={() => setConfirm(true)}>Supprimer</button>}</div>
        </div>
      ) : <div className="crm-sheet"><Empty t="Aucune fiche" sub="Ajoute un premier élément." /></div>}
      {ed.modal}
    </div>
  );
}

// ─── Création ───
function StLibrary({ titre }: { titre: string }) {
  const { items, notes } = useStore();
  const ui = useUi();
  const router = useRouter();
  const ed = useEditor();
  const gs = groupsOf(items, "groupe");
  const rows = items.filter((i) => !ui.chip || val(i, "groupe") === ui.chip);
  const filter = (g: string) => (e: React.MouseEvent) => { e.preventDefault(); setUi({ chip: g }); };
  return (
    <div className="studio-lib">
      <aside className="lib-side">
        <b className="mut xs up">{E.champs[R.groupe ?? 0]}</b>
        <a href="#" className={ui.chip ? "" : "on"} onClick={filter("")}>Tout <em>{items.length}</em></a>
        {gs.map((g) => <a key={g} href="#" className={ui.chip === g ? "on" : ""} onClick={filter(g)}>{g} <em>{items.filter((i) => val(i, "groupe") === g).length}</em></a>)}
      </aside>
      <div>
        <Head titre={titre}><button className="b primary" onClick={() => ed.open("new")}>+ Nouveau {E.nom.toLowerCase()}</button></Head>
        {rows.length ? (
          <div className="doc-grid">
            {rows.map((i) => (
              <button key={i.id} className="doc" onClick={() => { setUi({ sel: i.id }); router.push(screenHref("st-editor")); }}>
                <span className="doc-page"><b>{nameOf(i)}</b><span>{(notes[i.id] ?? "").slice(0, 120) || "Document vide — clique pour écrire."}</span></span>
                <span className="row between"><span className="mut xs">{val(i, "groupe")} · {words(notes[i.id] ?? "")} mots</span><Badge s={i.values[ST] ?? ""} /></span>
              </button>
            ))}
          </div>
        ) : <Empty t="Aucun document" sub="Crée ton premier document." />}
      </div>
      {ed.modal}
    </div>
  );
}

function StEditor() {
  const { items, notes } = useStore();
  const r = useSelected(items);
  const ed = useEditor();
  const [confirm, setConfirm] = useState(false);
  if (!r) return <div className="editor"><Empty t="Aucun document" sub="Crée un document pour commencer." /><button className="b primary" onClick={() => ed.open("new")}>+ Nouveau</button>{ed.modal}</div>;
  const ti = R.titre ?? 0;
  return (
    <div className="studio3">
      <aside className="lib-side">
        {items.map((x) => <a key={x.id} href="#" className={x.id === r.id ? "on" : ""} onClick={(e) => { e.preventDefault(); setUi({ sel: x.id }); setConfirm(false); }}>{nameOf(x)}</a>)}
        <button className="b sm" onClick={() => ed.open("new")}>+ Nouveau</button>
      </aside>
      <div className="editor">
        <input key={r.id} className="ed-title" defaultValue={nameOf(r)} maxLength={500} aria-label="Titre" onBlur={(e) => { const v = e.target.value.trim(); if (v && v !== nameOf(r)) actions.update(r.id, r.values.map((x, k) => (k === ti ? v : x))); }} />
        <NoteArea id={r.id} className="ed-body" placeholder="Commence à écrire…" />
        <div className="row between mut xs"><span>{words(notes[r.id] ?? "")} mots</span><span>Enregistré automatiquement dans ce navigateur</span></div>
      </div>
      <aside className="props">
        <b className="sm">Propriétés</b>
        <FieldInputs item={r} />
        {confirm ? <button className="b danger sm" onClick={() => { actions.remove(r.id); setConfirm(false); }}>Confirmer la suppression</button> : <button className="b danger sm" onClick={() => setConfirm(true)}>Supprimer</button>}
      </aside>
      {ed.modal}
    </div>
  );
}

// ─── E-commerce ───
const stockOf = (i: Item) => { const n = parseInt(val(i, "stock"), 10); return Number.isFinite(n) ? n : null; };
const initials = (s: string) => s.split(/\s+/).map((w) => w[0] ?? "").slice(0, 2).join("").toUpperCase() || "?";
const ORDER_STATUTS = ["À préparer", "Expédiée", "Livrée", "Annulée"];

function CoProducts({ titre }: { titre: string }) {
  const { items } = useStore();
  const ed = useEditor();
  const [msg, setMsg] = useState("");
  return (
    <>
      <Head titre={titre}><button className="b primary" onClick={() => ed.open("new")}>+ {E.nom}</button></Head>
      {msg && <p className="mut sm" role="status" style={{ marginBottom: 12 }}>{msg}</p>}
      {items.length ? (
        <div className="prod-grid">
          {items.map((i, k) => {
            const s = stockOf(i);
            return (
              <div key={i.id} className="prod">
                <div className="prod-img" style={{ "--h": (k * 53 + 20) % 360 } as React.CSSProperties}><span>{initials(nameOf(i))}</span></div>
                <b>{nameOf(i)}</b>
                <div className="row between"><span className="price-s">{val(i, "prix")}</span><span className={"sm " + (s !== null && s <= 3 ? "neg" : "mut")}>{s === null ? val(i, "stock") : s + " en stock"}</span></div>
                <div className="row between"><Badge s={i.values[ST] ?? ""} /><div className="row"><button className="b sm" onClick={() => ed.open(i)}>Modifier</button><button className="b sm primary" disabled={s === 0} onClick={() => setMsg(actions.order(i.id, 1, "Vente directe"))}>Vendre</button></div></div>
              </div>
            );
          })}
        </div>
      ) : <Empty t="Aucun produit" sub="Ajoute ton premier produit." />}
      {ed.modal}
    </>
  );
}

function CoOrders({ titre }: { titre: string }) {
  const { items, orders } = useStore();
  const [p, setP] = useState("");
  const [q, setQ] = useState("1");
  const [c, setC] = useState("");
  const [msg, setMsg] = useState("");
  return (
    <>
      <Head titre={titre} />
      <form className="card ledger-add" onSubmit={(e) => { e.preventDefault(); const id = p || items[0]?.id; if (!id) return; setMsg(actions.order(id, Math.max(1, Number(q) || 1), c.trim() || "Client")); setC(""); }}>
        <select aria-label="Produit" value={p || items[0]?.id || ""} onChange={(e) => setP(e.target.value)}>{items.map((i) => <option key={i.id} value={i.id}>{nameOf(i)} — {val(i, "prix")}</option>)}</select>
        <input type="number" min={1} value={q} onChange={(e) => setQ(e.target.value)} aria-label="Quantité" />
        <input required maxLength={120} placeholder="Client" value={c} onChange={(e) => setC(e.target.value)} aria-label="Client" />
        <button className="b primary">Créer la commande</button>
      </form>
      {msg && <p className="mut sm" role="status" style={{ margin: "10px 0" }}>{msg}</p>}
      {orders.length ? (
        <div className="card flush" style={{ overflowX: "auto" }}>
          <table>
            <thead><tr><th>N°</th><th>Client</th><th>Produit</th><th>Qté</th><th>Total</th><th>Statut</th></tr></thead>
            <tbody>
              {orders.map((o) => (
                <tr key={o.id}>
                  <td>#{o.id}</td><td>{o.client}</td><td>{o.nom}</td><td>{o.qte}</td><td><b>{money(o.total)}</b></td>
                  <td><select value={o.statut} onChange={(e) => actions.setOrderStatus(o.id, e.target.value)} aria-label={"Statut de la commande " + o.id}>{ORDER_STATUTS.map((s) => <option key={s}>{s}</option>)}</select></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : <Empty t="Aucune commande" sub="Crée une commande ci-dessus ou clique sur « Vendre » dans les produits." />}
      <p className="mut xs" style={{ marginTop: 10 }}>Aucun paiement n&apos;est encaissé : une commande décompte seulement le stock du produit.</p>
    </>
  );
}

function CoSales({ titre }: { titre: string }) {
  const { items, orders } = useStore();
  const ok = orders.filter((o) => o.statut !== "Annulée");
  const total = ok.reduce((s, o) => s + o.total, 0);
  const by = items.map((i) => ({ i, n: ok.filter((o) => o.pid === i.id).reduce((s, o) => s + o.total, 0) })).filter((x) => x.n).sort((a, b) => b.n - a.n);
  const max = Math.max(1, ...by.map((x) => x.n));
  return (
    <>
      <Head titre={titre} />
      <div className="kpis">
        <div className="card kpi"><span className="mut sm">Chiffre d&apos;affaires</span><div className="big">{money(total)}</div></div>
        <div className="card kpi"><span className="mut sm">Commandes</span><div className="big">{ok.length}</div></div>
        <div className="card kpi"><span className="mut sm">Panier moyen</span><div className="big">{money(ok.length ? total / ok.length : 0)}</div></div>
      </div>
      <div className="card">
        <b>Meilleurs produits</b>
        {by.length ? by.map((x) => <div key={x.i.id} className="cat-b"><span>{nameOf(x.i)}</span><div className="gbar"><i style={{ width: (x.n / max) * 100 + "%" }} /></div><b className="sm">{money(x.n)}</b></div>) : <p className="mut sm">Pas encore de vente : crée une commande pour voir apparaître les chiffres.</p>}
      </div>
    </>
  );
}

// ─── Paramètres ───
function Settings({ titre }: { titre: string }) {
  const { compte, orders } = useStore();
  const router = useRouter();
  return (
    <>
      <SettingsView titre={titre} />
      {orders.length > 0 && <p className="mut sm" style={{ marginTop: 10 }}>{orders.length} commande(s) enregistrée(s) dans ce navigateur.</p>}
      {A.accounts && (
        <div className="card form" style={{ marginTop: 14 }}>
          <b>Compte local</b>
          <p className="mut sm">{compte ? compte.nom + " · " + compte.email : "Aucun compte"} — enregistré seulement dans ce navigateur, sans mot de passe.</p>
          <div className="row"><button className="b" onClick={() => { actions.logout(); router.push("/"); }}>Se déconnecter</button></div>
        </div>
      )}
    </>
  );
}
`;

/** CSS propre aux composants React des architectures (en plus de ARCH_CSS). */
export const ARCH_REACT_CSS = `body.arch{display:block;min-height:100vh}
.mode-app.frame-split{display:flex;min-height:100vh}
.boot{padding:40px}
.lists a,.lib-side a,.mini{text-decoration:none}
.lesson-video{color:rgba(255,255,255,.75);font-size:14px}
.ws-head .search input{min-width:200px}
@media(max-width:860px){.mode-app.frame-split{flex-direction:column}.ws-head .search input{min-width:0}}`;
