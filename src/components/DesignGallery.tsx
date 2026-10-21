"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { designDoc, DesignThumb, type IdeeInput, type PreviewView } from "@/components/DesignThumb";
import { Modal } from "@/components/ui";
import { AMBIANCES, ANIM_LABEL, DASH_LABEL, DESIGN_BY_ID, DESIGNS, SHELL_LABEL, type DesignDef } from "@/data/designs";
import { EXEMPLES } from "@/data/exemples";
import { POLICES, STYLE_PRESETS } from "@/lib/config";
import { toggleDesignFav, useData } from "@/lib/store";

const VIEWS: [PreviewView, string][] = [["dashboard", "Tableau de bord"], ["accueil", "Accueil"], ["liste", "Liste"], ["landing", "Page de vente"]];
const MAX_CMP = 3;

const specs = (d: DesignDef): [string, string][] => [
  ["Menu", SHELL_LABEL[d.shell]],
  ["Tableau de bord", DASH_LABEL[d.dash]],
  ["Animations", ANIM_LABEL[d.anim]],
  ["Style", STYLE_PRESETS[d.style].nom],
  ["Police", POLICES[d.police].nom],
  ["Page de vente", d.layout === "split" ? "Deux colonnes" : d.layout === "editorial" ? "Éditoriale" : "Centrée"],
];

export function FavDesign({ id, nom }: { id: string; nom: string }) {
  const { designFavs = [] } = useData();
  const on = designFavs.includes(id);
  return (
    <button className={`dg-fav ${on ? "on" : ""}`} aria-pressed={on} aria-label={on ? `Retirer ${nom} des favoris` : `Ajouter ${nom} aux favoris`} title={on ? "Retirer des favoris" : "Ajouter aux favoris"} onClick={() => toggleDesignFav(id)}>
      {on ? "♥" : "♡"}
    </button>
  );
}

/** Galerie des 10 designs : vrais prototypes, filtres, favoris, comparaison et aperçu détaillé. */
export function DesignGallery() {
  const { designFavs = [] } = useData();
  const [amb, setAmb] = useState("tous");
  const [ex, setEx] = useState(0);
  const [view, setView] = useState<PreviewView>("dashboard");
  const [cmp, setCmp] = useState<string[]>([]);
  const [detail, setDetail] = useState<string | null>(null);
  const [comparing, setComparing] = useState(false);

  const list = DESIGNS.filter((d) => amb === "tous" || (amb === "favoris" ? designFavs.includes(d.id) : AMBIANCES.find((a) => a.id === amb)?.ids.includes(d.id)));
  const input = (id: string): IdeeInput => ({ ...EXEMPLES[ex]!, design: id });
  const toggleCmp = (id: string) => setCmp((c) => (c.includes(id) ? c.filter((x) => x !== id) : c.length >= MAX_CMP ? c : [...c, id]));

  return (
    <div className="dg">
      <div className="dg-bar">
        <div className="dg-filters" role="group" aria-label="Filtrer les designs">
          {[{ id: "tous", label: "Tous" }, ...AMBIANCES, { id: "favoris", label: `♥ Favoris${designFavs.length ? ` · ${designFavs.length}` : ""}` }].map((f) => (
            <button key={f.id} className="chip" aria-pressed={amb === f.id} onClick={() => setAmb(f.id)}>{f.label}</button>
          ))}
        </div>
        <div className="dg-opts">
          <label className="dg-sel">
            <span className="tiny mut">Avec l&apos;exemple</span>
            <select className="input" value={ex} onChange={(e) => setEx(Number(e.target.value))}>
              {EXEMPLES.map((x, i) => <option key={x.nom} value={i}>{x.nom} · {x.idee.length > 38 ? `${x.idee.slice(0, 38)}…` : x.idee}</option>)}
            </select>
          </label>
          <div className="seg" role="group" aria-label="Page montrée">
            {VIEWS.map(([v, l]) => <button key={v} aria-pressed={view === v} onClick={() => setView(v)}>{l}</button>)}
          </div>
        </div>
      </div>

      {list.length === 0 ? (
        <div className="empty fade">
          <h2 className="h-sec">Aucun design en favori</h2>
          <p className="mut" style={{ margin: "8px 0 18px" }}>Clique sur ♡ sur un design pour le retrouver ici.</p>
          <button className="btn btn-ghost" onClick={() => setAmb("tous")}>Voir tous les designs</button>
        </div>
      ) : (
        <div className="dg-grid">
          {list.map((d, i) => (
            <article key={d.id} className={`dg-card ${i % 5 === 0 ? "wide" : ""} ${cmp.includes(d.id) ? "cmp" : ""}`} style={{ "--i": i, "--p": d.couleurs.primaire, "--a": d.couleurs.accent } as React.CSSProperties}>
              <button className="dg-shot" onClick={() => setDetail(d.id)} aria-label={`Voir ${d.nom} en grand`}>
                <DesignThumb input={input(d.id)} view={view} width={i % 5 === 0 ? 1180 : 1040} />
                <span className="dg-zoom">Ouvrir l&apos;aperçu interactif ↗</span>
              </button>
              <div className="dg-info">
                <div className="row between" style={{ flexWrap: "nowrap", alignItems: "flex-start" }}>
                  <div>
                    <span className="dg-num">{String(DESIGNS.indexOf(d) + 1).padStart(2, "0")}</span>
                    <h3>{d.nom}</h3>
                  </div>
                  <FavDesign id={d.id} nom={d.nom} />
                </div>
                <p className="mut small">{d.description}</p>
                <dl className="dg-specs">{specs(d).slice(0, i % 5 === 0 ? 6 : 3).map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}</dl>
                <div className="dg-actions">
                  <label className="dg-cmp"><input type="checkbox" className="check" checked={cmp.includes(d.id)} disabled={!cmp.includes(d.id) && cmp.length >= MAX_CMP} onChange={() => toggleCmp(d.id)} /> Comparer</label>
                  <Link href={`/creer?design=${d.id}`} className="btn btn-sm">Choisir <span className="arrow">→</span></Link>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}

      {cmp.length > 0 && (
        <div className="dg-tray" role="region" aria-label="Comparaison">
          <div className="row" style={{ gap: 8 }}>
            {cmp.map((id) => <span key={id} className="dg-pill" style={{ "--p": DESIGN_BY_ID[id]!.couleurs.primaire } as React.CSSProperties}>{DESIGN_BY_ID[id]!.nom}<button onClick={() => toggleCmp(id)} aria-label={`Retirer ${DESIGN_BY_ID[id]!.nom}`}>✕</button></span>)}
            <span className="tiny" style={{ opacity: 0.7 }}>{cmp.length < 2 ? "Choisis au moins 2 designs" : `${cmp.length}/${MAX_CMP}`}</span>
          </div>
          <button className="btn btn-coral btn-sm" disabled={cmp.length < 2} onClick={() => setComparing(true)}>Comparer côte à côte</button>
        </div>
      )}

      <DesignDetail id={detail} input={detail ? input(detail) : null} onClose={() => setDetail(null)} />
      <Modal open={comparing} onClose={() => setComparing(false)} title="Comparaison des designs" wide>
        <div className="dg-compare" style={{ gridTemplateColumns: `repeat(${cmp.length}, minmax(0, 1fr))` }}>
          {cmp.map((id) => {
            const d = DESIGN_BY_ID[id]!;
            return (
              <div key={id} className="stack" style={{ gap: 10 }}>
                <div className="row between"><b style={{ fontSize: 17 }}>{d.nom}</b><FavDesign id={d.id} nom={d.nom} /></div>
                <div className="dg-frame"><DesignThumb input={input(id)} view={view} width={1100} interactive /></div>
                <dl className="dg-specs full">{specs(d).map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}</dl>
                <Link href={`/creer?design=${d.id}`} className="btn btn-sm">Choisir {d.nom} <span className="arrow">→</span></Link>
              </div>
            );
          })}
        </div>
      </Modal>
    </div>
  );
}

/** Aperçu détaillé : le prototype en grand, interactif, sur ordinateur ou mobile, page par page. */
function DesignDetail({ id, input, onClose }: { id: string | null; input: IdeeInput | null; onClose: () => void }) {
  const d = id ? DESIGN_BY_ID[id] : undefined;
  const [view, setView] = useState<PreviewView>("dashboard");
  const [device, setDevice] = useState<"desktop" | "mobile">("desktop");
  const key = input ? JSON.stringify(input) : "";
  const mobileDoc = useMemo(() => (key && device === "mobile" ? designDoc(JSON.parse(key) as IdeeInput, view).html : ""), [key, device, view]);
  return (
    <Modal open={!!d} onClose={onClose} title={d ? `Design ${d.nom}` : ""} wide>
      {d && input && (
        <div className="dg-detail">
          <div className="row between" style={{ marginBottom: 14 }}>
            <div className="seg" role="group" aria-label="Page">{VIEWS.map(([v, l]) => <button key={v} aria-pressed={view === v} onClick={() => setView(v)}>{l}</button>)}</div>
            <div className="seg" role="group" aria-label="Appareil">
              <button aria-pressed={device === "desktop"} onClick={() => setDevice("desktop")}>Ordinateur</button>
              <button aria-pressed={device === "mobile"} onClick={() => setDevice("mobile")}>Mobile</button>
            </div>
          </div>
          <div className="dg-detail-grid">
            {device === "desktop" ? (
              <div className="dg-frame big"><DesignThumb input={input} view={view} width={1280} interactive /></div>
            ) : (
              <div className="device mobile fade" style={{ height: 620 }}><iframe key={`${view}-m`} title={`${d.nom} sur mobile`} srcDoc={mobileDoc} sandbox="allow-scripts allow-forms" /></div>
            )}
            <aside className="stack" style={{ gap: 14 }}>
              <p className="mut small">{d.description}</p>
              <dl className="dg-specs full">{specs(d).map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}</dl>
              <p className="tiny mut">Aperçu cliquable : navigue dans le menu, ajoute un élément, ouvre une fiche. Les données sont des exemples.</p>
              <div className="row"><FavDesign id={d.id} nom={d.nom} /><Link href={`/creer?design=${d.id}`} className="btn btn-coral" style={{ flex: 1 }}>Choisir {d.nom} <span className="arrow">→</span></Link></div>
            </aside>
          </div>
        </div>
      )}
    </Modal>
  );
}
