"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useMemo, useState } from "react";
import { HeroFacts, PageHero } from "@/components/PageHero";
import { Dots, Modal, toast } from "@/components/ui";
import { CATEGORIES, IDEA_BY_ID, IDEAS } from "@/data/ideas";
import { TEMPLATE_BY_ID, TEMPLATES } from "@/data/templates";
import { CAT_COLORS } from "@/lib/a11y/accents";
import { filterIdeas, NO_FILTERS, type IdeaFilters } from "@/lib/filters";
import { AUDIENCE_LABEL, BUDGET_LABEL, DIFFICULTY_LABEL, DURATION_LABEL, LEVEL_LABEL } from "@/lib/labels";
import { REVENUE_LABEL } from "@/lib/modules";
import { toggleFavorite, useData } from "@/lib/store";
import type { CategoryId, Idea } from "@/lib/types";

const CAT_NAME = Object.fromEntries(CATEGORIES.map((c) => [c.id, c.nom])) as Record<CategoryId, string>;
/** Une couleur par univers, déclinée de la palette Décollage (teintes foncées : lisibles en texte, voir lib/a11y/accents.ts). */
const CAT_COLOR = Object.fromEntries(CATEGORIES.map((c, i) => [c.id, CAT_COLORS[i % CAT_COLORS.length]])) as Record<CategoryId, string>;
const MAX_COMPARE = 3;

export default function Page() {
  return (
    <Suspense fallback={<main className="page" />}>
      <Catalogue />
    </Suspense>
  );
}

function Catalogue() {
  const params = useSearchParams();
  const initialCat = params.get("categorie") as CategoryId | null;
  const [f, setF] = useState<IdeaFilters>({ ...NO_FILTERS, categorie: initialCat && CAT_NAME[initialCat] ? initialCat : "" });
  const [compare, setCompare] = useState<string[]>([]);
  const [showCompare, setShowCompare] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const { favorites } = useData();

  const list = useMemo(() => filterIdeas(IDEAS, f, favorites), [f, favorites]);
  const active = Object.entries(f).filter(([k, v]) => k !== "q" && k !== "categorie" && v !== "" && v !== false).length;
  const set = <K extends keyof IdeaFilters>(k: K, v: IdeaFilters[K]) => setF((x) => ({ ...x, [k]: v }));

  function toggleCompare(id: string) {
    setCompare((c) => {
      if (c.includes(id)) return c.filter((x) => x !== id);
      if (c.length >= MAX_COMPARE) {
        toast(`${MAX_COMPARE} idées maximum dans la comparaison`, "error");
        return c;
      }
      return [...c, id];
    });
  }

  const select = (label: string, k: keyof IdeaFilters, options: [string, string][], num = false) => (
    <div className="field">
      <label htmlFor={`f-${k}`}>{label}</label>
      <select id={`f-${k}`} className="input" value={String(f[k])} onChange={(e) => set(k, (e.target.value === "" ? "" : num ? Number(e.target.value) : e.target.value) as never)}>
        <option value="">Tous</option>
        {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
      </select>
    </div>
  );

  return (
    <main className="page">
      <PageHero
        tone="navy"
        eyebrow="Découvrir · Catalogue"
        title={<>{IDEAS.length} idées de micro-SaaS, <span className="serif">prêtes à valider</span>.</>}
        lead="Rédigées à la main, avec des estimations indicatives. Aucune n'est garantie rentable : chaque fiche se termine par une action de validation."
        aside={<HeroFacts facts={[[IDEAS.length, "idées"], [CATEGORIES.length, "univers"], [favorites.length, "dans tes favoris"], [TEMPLATES.length, "types de SaaS"]]} />}
      >
        <label className="id-search">
          <span aria-hidden="true">⌕</span>
          <input type="search" placeholder="Rechercher : rendez-vous, étudiants, budget…" value={f.q} onChange={(e) => set("q", e.target.value)} aria-label="Rechercher une idée" />
          {f.q && <b className="tiny">{list.length} résultat{list.length > 1 ? "s" : ""}</b>}
        </label>
      </PageHero>
      <div className="container">
        <div className="id-cats" id="categories" role="group" aria-label="Catégories">
          <button className="id-cat all" aria-pressed={!f.categorie} onClick={() => set("categorie", "")}><b>Toutes</b><span>{IDEAS.length}</span></button>
          {CATEGORIES.map((c, i) => (
            <button key={c.id} className="id-cat" style={{ "--c": CAT_COLORS[i % CAT_COLORS.length] } as React.CSSProperties} aria-pressed={f.categorie === c.id} onClick={() => set("categorie", f.categorie === c.id ? "" : c.id)}>
              <b>{c.nom}</b><span>{IDEAS.filter((x) => x.categorie === c.id).length}</span>
            </button>
          ))}
        </div>

        <div className="ideas-layout">
          <aside className={`panel ideas-filters ${showFilters ? "open" : ""}`} aria-label="Filtres">
            <div className="field">
              <label htmlFor="f-q">Recherche</label>
              <input id="f-q" className="input" type="search" placeholder="Ex. : rendez-vous, étudiants…" value={f.q} onChange={(e) => set("q", e.target.value)} />
            </div>
            {select("Budget", "budget", Object.entries(BUDGET_LABEL), true)}
            {select("Difficulté", "difficulte", Object.entries(DIFFICULTY_LABEL), true)}
            {select("Durée de construction", "duree", Object.entries(DURATION_LABEL))}
            {select("Public cible", "public", Object.entries(AUDIENCE_LABEL))}
            {select("Type de produit", "type", TEMPLATES.map((t) => [t.id, t.nom]))}
            {select("Modèle économique", "modele", Object.entries(REVENUE_LABEL))}
            {select("Niveau technique", "niveau", Object.entries(LEVEL_LABEL))}
            <label className="row" style={{ gap: 10, cursor: "pointer" }}>
              <input type="checkbox" className="switch" checked={f.favoris} onChange={(e) => set("favoris", e.target.checked)} />
              <span className="small" style={{ fontWeight: 600 }}>Favoris uniquement ({favorites.length})</span>
            </label>
            <button className="btn btn-ghost btn-sm" onClick={() => setF(NO_FILTERS)} disabled={JSON.stringify(f) === JSON.stringify(NO_FILTERS)}>Réinitialiser</button>
          </aside>

          <div className="stack">
            <div className="row between">
              <span className="mut" aria-live="polite"><b style={{ color: "var(--ink)" }}>{list.length}</b> idée{list.length > 1 ? "s" : ""}{f.categorie ? ` · ${CAT_NAME[f.categorie]}` : ""}</span>
              <button className="btn btn-ghost btn-sm filters-toggle" onClick={() => setShowFilters(!showFilters)} aria-expanded={showFilters}>Filtres{active ? ` (${active})` : ""}</button>
            </div>
            {list.length === 0 ? (
              <div className="empty">
                <h2 className="h-sec">Aucune idée ne correspond</h2>
                <p className="mut" style={{ margin: "8px 0 18px" }}>Élargis un filtre ou modifie ta recherche.</p>
                <button className="btn btn-ghost" onClick={() => setF(NO_FILTERS)}>Tout afficher</button>
              </div>
            ) : (
              <div className="grid">
                {list.map((i) => <IdeaCard key={i.id} idea={i} fav={favorites.includes(i.id)} comparing={compare.includes(i.id)} onCompare={() => toggleCompare(i.id)} />)}
              </div>
            )}
          </div>
        </div>
      </div>

      {compare.length > 0 && (
        <div className="compare-tray fade" role="region" aria-label="Comparaison">
          <span className="small"><b>{compare.length}</b> / {MAX_COMPARE} à comparer</span>
          <div className="row" style={{ gap: 6 }}>{compare.map((id) => <span key={id} className="badge" style={{ background: "rgba(255,255,255,.12)", color: "#fff" }}>{IDEA_BY_ID[id]!.nom}</span>)}</div>
          <div className="row" style={{ gap: 8 }}>
            <button className="btn btn-sm btn-ghost" style={{ color: "#fff", borderColor: "rgba(255,255,255,.3)" }} onClick={() => setCompare([])}>Vider</button>
            <button className="btn btn-sm btn-coral" disabled={compare.length < 2} onClick={() => setShowCompare(true)}>Comparer</button>
          </div>
        </div>
      )}

      <Modal open={showCompare} onClose={() => setShowCompare(false)} title="Comparaison d'idées" wide>
        <CompareTable ideas={compare.map((id) => IDEA_BY_ID[id]!)} />
      </Modal>

      <style>{`
        .id-search{display:flex;align-items:center;gap:10px;width:min(620px,100%);padding:4px 16px;border-radius:16px;background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.2);transition:border-color .2s,background .2s}
        .id-search:focus-within{border-color:var(--coral);background:rgba(255,255,255,.12)}
        .id-search span{font-size:20px;opacity:.7}
        .id-search input{flex:1;border:0;outline:0;background:none;color:#fff;font:500 17px var(--body);padding:12px 0}
        .id-search input::placeholder{color:rgba(255,255,255,.5)}
        .id-search b{color:var(--coral);white-space:nowrap}
        .id-cats{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:8px;margin-bottom:28px;scroll-margin-top:90px}
        .id-cat{--c:var(--navy);position:relative;overflow:hidden;display:flex;flex-direction:column;align-items:flex-start;gap:2px;text-align:left;padding:12px 14px;border-radius:14px;border:1.5px solid var(--line);background:var(--paper);cursor:pointer;transition:transform .2s var(--ease),border-color .2s,background .2s,color .2s}
        .id-cat::before{content:"";position:absolute;left:0;top:0;bottom:0;width:4px;background:var(--c);transition:width .3s var(--ease)}
        .id-cat:hover{transform:translateY(-2px);border-color:var(--c)}
        .id-cat b{font-size:14px;line-height:1.25}
        .id-cat span{font:600 22px var(--display);color:var(--c);letter-spacing:-.03em}
        .id-cat[aria-pressed="true"]{color:#fff;border-color:var(--c)}
        .id-cat[aria-pressed="true"]::before{width:100%}
        .id-cat[aria-pressed="true"] *{position:relative;color:#fff}
        .id-card{--c:var(--navy);position:relative;display:flex;flex-direction:column;gap:12px;padding:20px 20px 18px;border-radius:var(--r-lg);background:var(--paper);border:1px solid var(--line);box-shadow:inset 0 4px 0 var(--c);transition:transform .25s var(--ease),box-shadow .25s,border-color .2s}
        .id-card:hover{transform:translateY(-3px);box-shadow:inset 0 4px 0 var(--c),var(--shadow-lg)}
        .id-card.cmp{border-color:var(--blue);box-shadow:inset 0 4px 0 var(--c),0 0 0 3px rgba(47,91,255,.18)}
        .id-tag{font-size:12px;font-weight:700;letter-spacing:.04em;color:var(--c);text-transform:uppercase}
        .id-card .dg-fav{width:34px;height:34px;font-size:15px}
        .ideas-layout{display:grid;grid-template-columns:260px 1fr;gap:24px;align-items:start}
        .ideas-filters{position:sticky;top:84px;display:grid;gap:14px}
        .filters-toggle{display:none}
        .compare-tray{position:fixed;bottom:16px;left:50%;transform:translateX(-50%);z-index:40;background:var(--navy);color:#fff;border-radius:16px;padding:10px 12px 10px 18px;display:flex;gap:16px;align-items:center;box-shadow:var(--shadow-lg);max-width:calc(100vw - 24px);flex-wrap:wrap}
        @media(max-width:900px){.ideas-layout{grid-template-columns:1fr}.ideas-filters{position:static;display:none}.ideas-filters.open{display:grid}.filters-toggle{display:inline-flex}}
      `}</style>
    </main>
  );
}

function IdeaCard({ idea: i, fav, comparing, onCompare }: { idea: Idea; fav: boolean; comparing: boolean; onCompare: () => void }) {
  return (
    <article className={`id-card ${comparing ? "cmp" : ""}`} style={{ "--c": CAT_COLOR[i.categorie] } as React.CSSProperties}>
      <div className="row between" style={{ flexWrap: "nowrap" }}>
        <span className="id-tag">{CAT_NAME[i.categorie]}</span>
        <button className={`dg-fav ${fav ? "on" : ""}`} aria-pressed={fav} aria-label={fav ? `Retirer ${i.nom} des favoris` : `Ajouter ${i.nom} aux favoris`} onClick={() => { toggleFavorite(i.id); toast(fav ? "Retiré des favoris" : "Ajouté aux favoris"); }}>
          {fav ? "♥" : "♡"}
        </button>
      </div>
      <div>
        <h2 style={{ fontSize: 20, marginBottom: 6 }}><Link href={`/idees/${i.id}`} className="idea-link">{i.nom}</Link></h2>
        <p className="mut small">{i.description}</p>
      </div>
      <div className="stack" style={{ gap: 6, marginTop: "auto" }}>
        <div className="kv" style={{ padding: "4px 0" }}><span className="mut small">Difficulté</span><Dots value={i.difficulte} label="Difficulté" /></div>
        <div className="kv" style={{ padding: "4px 0" }}><span className="mut small">Durée indicative</span><span className="small">{i.semaines} sem.</span></div>
        <div className="kv" style={{ padding: "4px 0" }}><span className="mut small">Budget</span><span className="small">{BUDGET_LABEL[i.budget]}</span></div>
      </div>
      <div className="row between">
        <label className="row small" style={{ gap: 8, cursor: "pointer", fontWeight: 600 }}>
          <input type="checkbox" className="check" checked={comparing} onChange={onCompare} /> Comparer
        </label>
        <div className="row" style={{ gap: 6 }}>
          <Link href={`/idees/${i.id}`} className="btn btn-ghost btn-sm">Fiche</Link>
          <Link href={`/creer?q=${encodeURIComponent(i.description)}`} className="btn btn-sm" title="Créer un SaaS à partir de cette idée">Créer <span className="arrow">→</span></Link>
        </div>
      </div>
    </article>
  );
}

function CompareTable({ ideas }: { ideas: Idea[] }) {
  const rows: [string, (i: Idea) => React.ReactNode][] = [
    ["Catégorie", (i) => CAT_NAME[i.categorie]],
    ["Problème", (i) => i.probleme],
    ["Public", (i) => AUDIENCE_LABEL[i.public]],
    ["Modèle économique", (i) => REVENUE_LABEL[i.modele]],
    ["Type de produit", (i) => TEMPLATE_BY_ID[i.template].nom],
    ["Difficulté", (i) => DIFFICULTY_LABEL[i.difficulte]],
    ["Durée indicative", (i) => `${i.semaines} semaines`],
    ["Budget indicatif", (i) => BUDGET_LABEL[i.budget]],
    ["Niveau technique", (i) => LEVEL_LABEL[i.niveau]],
    ["MVP", (i) => i.mvp.join(" · ")],
    ["Risques", (i) => i.risques.join(" · ")],
    ["Première validation", (i) => i.validation],
  ];
  return (
    <div className="scroll-x">
      <table className="table" style={{ minWidth: 640 }}>
        <thead><tr><th style={{ width: 150 }} />{ideas.map((i) => <th key={i.id} style={{ fontSize: 15, textTransform: "none", letterSpacing: 0, color: "var(--ink)" }}>{i.nom}</th>)}</tr></thead>
        <tbody>{rows.map(([label, fn]) => <tr key={label}><td className="mut small" style={{ fontWeight: 600 }}>{label}</td>{ideas.map((i) => <td key={i.id} className="small">{fn(i)}</td>)}</tr>)}</tbody>
      </table>
      <div className="row" style={{ marginTop: 16 }}>{ideas.map((i) => <Link key={i.id} href={`/nouveau?idee=${i.id}`} className="btn btn-sm">Démarrer « {i.nom} »</Link>)}</div>
    </div>
  );
}
