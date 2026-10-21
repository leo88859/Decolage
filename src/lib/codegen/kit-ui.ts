// Kit du générateur : composants React copiés tels quels dans chaque projet généré.
// Mêmes règles que kit-data.ts : pas d'accent grave ni de « ${ » dans ces textes.

/** components/Shell.tsx — menu, barre du haut, mode sombre. */
export const SHELL_TSX = String.raw`"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { SAAS } from "@/lib/config";
import { storageError, useStore } from "@/lib/store";
import type { PageKind } from "@/lib/types";

const ICONS: Record<PageKind, string> = {
  accueil: "M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z",
  dashboard: "M4 4h7v7H4zM13 4h7v4h-7zM13 10h7v10h-7zM4 13h7v7H4z",
  table: "M4 5h16v14H4zM4 10h16M10 10v9",
  cards: "M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01",
  grid: "M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z",
  kanban: "M4 4h4v16H4zM10 4h4v10h-4zM16 4h4v13h-4z",
  agenda: "M5 6h14v14H5zM5 10h14M9 3v4M15 3v4",
  form: "M12 5v14M5 12h14",
  todo: "M4 12a8 8 0 0 1 14-5.3M20 4v4h-4M20 12a8 8 0 0 1-14 5.3M4 20v-4h4",
  goals: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8z",
  settings: "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM4 12h2M18 12h2M12 4v2M12 18v2",
  pricing: "M4 7h16v10H4zM4 11h16M8 15h3",
  login: "M10 17l5-5-5-5M15 12H3M14 4h5v16h-5",
  activity: "M12 7v5l3 2M4 12a8 8 0 1 0 2.3-5.6M4 4v4h4",
};

export function Shell({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const state = useStore();
  const [dark, setDark] = useState(false);
  useEffect(() => { document.documentElement.classList.toggle("dark", dark); }, [dark]);
  const nav = SAAS.pages.filter((p) => p.nav);
  const err = storageError();
  return (
    <>
      <aside className="side">
        <div className="brand"><span className="mark" style={{ width: 32, height: 32 }}>{SAAS.initiales}</span><b>{SAAS.nom}</b></div>
        <nav aria-label="Navigation principale">
          {nav.map((p) => (
            <Link key={p.id} href={p.href} data-t={p.titre} className={(p.href === "/" ? path === "/" : path.startsWith(p.href)) ? "on" : ""}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={ICONS[p.kind]} /></svg>
              <span>{p.titre}</span>
            </Link>
          ))}
        </nav>
        <div className="side-f"><span className="mut xs">{state.items.length} {SAAS.entite.pluriel.toLowerCase()}</span></div>
      </aside>
      <div className="wrap">
        <header className="top">
          <span className="mut sm">{SAAS.cible}</span>
          <div className="row">
            <button className="ib" onClick={() => setDark(!dark)} aria-label="Mode sombre" title="Mode sombre">◐</button>
          </div>
        </header>
        <main>
          {err && <div className="card" role="alert" style={{ marginBottom: 14, borderColor: "#e11d48" }}>{err}</div>}
          <div className="enter">{children}</div>
        </main>
      </div>
      <div className="badge-proto saved" title="Les données restent dans ce navigateur">● Données enregistrées dans ce navigateur</div>
    </>
  );
}
`;

/** components/views.tsx — toutes les pages fonctionnelles. */
export const VIEWS_TSX = String.raw`"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { SAAS } from "@/lib/config";
import { actions, amount, tone, useStore } from "@/lib/store";
import type { Item } from "@/lib/types";

const E = SAAS.entite;
const POS = /confirm|valid|gagn|pay|résolu|livr|termin|fait|actif/i;

function Badge({ s }: { s: string }) {
  return <span className={"bdg " + tone(s)}>{s}</span>;
}

function Head({ title, sub, children }: { title: string; sub?: string; children?: React.ReactNode }) {
  return (
    <div className="ph">
      <div><h1>{title}</h1>{sub && <p className="mut">{sub}</p>}</div>
      <div className="row">{children}</div>
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return <div className="empty"><b>{text}</b><p className="mut">Ajoute un premier élément avec le bouton « + ».</p></div>;
}

/** Fenêtre d'ajout et de modification. */
function ItemModal({ item, onClose }: { item: Item | "new"; onClose: () => void }) {
  const isNew = item === "new";
  const [values, setValues] = useState<string[]>(isNew ? E.champs.map((_, i) => (i === SAAS.statut ? SAAS.statuts[0] ?? "" : "")) : item.values.slice());
  const [confirm, setConfirm] = useState(false);
  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!values[0]?.trim()) return;
    if (isNew) actions.add(values); else actions.update(item.id, values);
    onClose();
  }
  return (
    <div className="modal-bg" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <form className="modal" onSubmit={submit} aria-label={isNew ? "Ajouter" : "Modifier"}>
        <div className="row between"><h2>{isNew ? "Ajouter : " + E.nom.toLowerCase() : values[0] || E.nom}</h2><button type="button" className="ib" onClick={onClose} aria-label="Fermer">✕</button></div>
        <div className="form">
          {E.champs.map((c, i) => (
            <label key={c}>{c}
              {i === SAAS.statut ? (
                <select value={values[i]} onChange={(e) => setValues(values.map((v, j) => (j === i ? e.target.value : v)))}>
                  {SAAS.statuts.map((s) => <option key={s}>{s}</option>)}
                </select>
              ) : (
                <input value={values[i]} required={i === 0} maxLength={500} autoFocus={i === 0} onChange={(e) => setValues(values.map((v, j) => (j === i ? e.target.value : v)))} />
              )}
            </label>
          ))}
        </div>
        <div className="row between">
          {!isNew ? (confirm
            ? <button type="button" className="b danger" onClick={() => { actions.remove(item.id); onClose(); }}>Confirmer la suppression</button>
            : <button type="button" className="b danger" onClick={() => setConfirm(true)}>Supprimer</button>) : <span />}
          <div className="row"><button type="button" className="b" onClick={onClose}>Annuler</button><button className="b primary">{isNew ? "Ajouter" : "Enregistrer"}</button></div>
        </div>
      </form>
    </div>
  );
}

/** Ouverture de la fenêtre d'édition, partagée par les vues. */
export function useEditor() {
  const [edit, setEdit] = useState<Item | "new" | null>(null);
  const modal = edit ? <ItemModal item={edit} onClose={() => setEdit(null)} /> : null;
  return { open: setEdit, modal };
}

function useFiltered(items: Item[]) {
  const [q, setQ] = useState("");
  const [statut, setStatut] = useState("");
  const list = items.filter((i) => (!q || i.values.join(" ").toLowerCase().includes(q.toLowerCase())) && (!statut || i.values[SAAS.statut] === statut));
  const controls = (
    <div className="row" style={{ marginBottom: 14 }}>
      <input type="search" placeholder="Rechercher…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Rechercher" style={{ maxWidth: 280 }} />
      <div className="chips" style={{ margin: 0 }}>
        {["", ...SAAS.statuts].map((s) => <button key={s || "tous"} type="button" className={"chip" + (statut === s ? " on" : "")} onClick={() => setStatut(s)}>{s || "Tous"}</button>)}
      </div>
    </div>
  );
  return { list, controls };
}

export function Home() {
  const first = SAAS.pages.find((p) => p.nav && p.kind !== "accueil");
  return (
    <>
      <section className="hero">
        <div className="blob b1" /><div className="blob b2" />
        <span className="tag">{SAAS.cible}</span>
        <h1 className="hero-t">{SAAS.nom}</h1>
        <p className="mut hero-s">{SAAS.description}</p>
        {first && <div className="row center"><Link className="b primary lg" href={first.href}>Commencer →</Link></div>}
      </section>
      <div className="feats">
        {SAAS.fonctionnalites.map(([t, d], i) => <div key={t} className="card feat" style={{ "--i": i } as React.CSSProperties}><b>{t}</b><p className="mut sm">{d}</p></div>)}
      </div>
    </>
  );
}

export function Dashboard({ titre }: { titre: string }) {
  const { items } = useStore();
  const ed = useEditor();
  const counts = SAAS.statuts.map((s) => ({ s, n: items.filter((i) => i.values[SAAS.statut] === s).length }));
  const max = Math.max(1, ...counts.map((c) => c.n));
  // Colonne de montants : celle dont la plupart des valeurs sont des nombres.
  const col = useMemo(() => E.champs.findIndex((_, j) => j !== SAAS.statut && items.length > 0 && items.filter((i) => amount(i.values[j] ?? "") !== null).length >= Math.ceil(items.length / 2)), [items]);
  const total = col >= 0 ? items.reduce((s, i) => s + (amount(i.values[col] ?? "") ?? 0), 0) : null;
  const done = items.filter((i) => POS.test(i.values[SAAS.statut] ?? "")).length;
  // Quand la colonne sert de catégorie (aucun statut « terminé »), on montre la plus fréquente.
  const hasDone = SAAS.statuts.some((s) => POS.test(s));
  const top = counts.slice().sort((a, b) => b.n - a.n)[0];
  const week = items.filter((i) => Date.now() - new Date(i.createdAt).getTime() < 7 * 86400000).length;
  return (
    <>
      <Head title={titre} sub="Chiffres calculés à partir de tes données."><button className="b primary" onClick={() => ed.open("new")}>+ {E.nom}</button></Head>
      <div className="kpis">
        <div className="card kpi"><span className="mut sm">{E.pluriel}</span><div className="big">{items.length}</div><span className="mut xs">{week} ajouté(s) cette semaine</span></div>
        {hasDone
          ? <div className="card kpi"><span className="mut sm">Terminés ou gagnés</span><div className="big">{done}</div><span className="mut xs">{items.length ? Math.round((done / items.length) * 100) : 0} % du total</span></div>
          : <div className="card kpi"><span className="mut sm">{E.champs[SAAS.statut]} la plus fréquente</span><div className="big" style={{ fontSize: 24 }}>{top && top.n ? top.s : "—"}</div><span className="mut xs">{top ? top.n : 0} élément(s) sur {items.length}</span></div>}
        <div className="card kpi"><span className="mut sm">{total !== null ? "Total " + E.champs[col]!.toLowerCase() : "Favoris"}</span><div className="big">{total !== null ? total.toLocaleString("fr-FR", { maximumFractionDigits: 2 }) + " €" : items.filter((i) => i.fav).length}</div><span className="mut xs">{total !== null ? "somme de la colonne" : "éléments marqués"}</span></div>
      </div>
      <div className="split">
        <div className="card">
          <b>Répartition par {E.champs[SAAS.statut]!.toLowerCase()}</b>
          <svg viewBox={"0 0 400 " + (counts.length * 34 + 8)} className="chart" role="img" aria-label="Répartition par statut">
            {counts.map((c, i) => (
              <g key={c.s} transform={"translate(0," + (i * 34 + 4) + ")"}>
                <text x="0" y="17" fontSize="13" fill="currentColor">{c.s}</text>
                <rect x="130" y="4" width={Math.max(2, (c.n / max) * 230)} height="18" rx="5" className="bar" style={{ "--i": i } as React.CSSProperties} />
                <text x={136 + (c.n / max) * 230} y="17" fontSize="13" fill="currentColor">{c.n}</text>
              </g>
            ))}
          </svg>
        </div>
        <div className="card">
          <b>Derniers ajouts</b>
          <div className="mini-list">
            {items.slice(0, 5).map((i) => (
              <button key={i.id} className="mini" onClick={() => ed.open(i)}><span className="grow"><b>{i.values[0]}</b><span className="mut sm">{i.values[1]}</span></span><Badge s={i.values[SAAS.statut] ?? ""} /></button>
            ))}
            {!items.length && <p className="mut sm">Aucune donnée pour l'instant.</p>}
          </div>
        </div>
      </div>
      {ed.modal}
    </>
  );
}

export function TableView({ titre }: { titre: string }) {
  const { items } = useStore();
  const ed = useEditor();
  const { list, controls } = useFiltered(items);
  const [sort, setSort] = useState<{ col: number; dir: number } | null>(null);
  const rows = sort ? list.slice().sort((a, b) => a.values[sort.col]!.localeCompare(b.values[sort.col]!, "fr", { numeric: true }) * sort.dir) : list;
  return (
    <>
      <Head title={titre} sub={items.length + " " + E.pluriel.toLowerCase()}><button className="b primary" onClick={() => ed.open("new")}>+ {E.nom}</button></Head>
      {controls}
      {rows.length === 0 ? <Empty text="Aucun résultat" /> : (
        <div className="card flush" style={{ overflowX: "auto" }}>
          <table>
            <thead><tr>{E.champs.map((c, j) => <th key={c}><button onClick={() => setSort({ col: j, dir: sort?.col === j ? -sort.dir : 1 })}>{c} {sort?.col === j ? (sort.dir > 0 ? "↑" : "↓") : ""}</button></th>)}<th /></tr></thead>
            <tbody>
              {rows.map((i) => (
                <tr key={i.id} onClick={() => ed.open(i)}>
                  {i.values.map((v, j) => <td key={j}>{j === SAAS.statut ? <Badge s={v} /> : j === 0 ? <b>{v}</b> : v}</td>)}
                  <td className="r"><button className={"ib fav" + (i.fav ? " on" : "")} aria-label="Favori" onClick={(e) => { e.stopPropagation(); actions.toggleFav(i.id); }}>{i.fav ? "♥" : "♡"}</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {ed.modal}
    </>
  );
}

export function CardsView({ titre, grid }: { titre: string; grid?: boolean }) {
  const { items } = useStore();
  const ed = useEditor();
  const { list, controls } = useFiltered(items);
  return (
    <>
      <Head title={titre} sub={list.length + " " + E.pluriel.toLowerCase()}><button className="b primary" onClick={() => ed.open("new")}>+ {E.nom}</button></Head>
      {controls}
      {list.length === 0 ? <Empty text="Aucun résultat" /> : (
        <div className={grid ? "gridc" : "stack"}>
          {list.map((i, k) => (
            <button key={i.id} className={"card " + (grid ? "tile" : "li")} onClick={() => ed.open(i)} style={{ "--i": k, textAlign: "left" } as React.CSSProperties}>
              <span className="grow"><b>{i.values[0]}</b><span className="mut sm">{i.values.slice(1).filter((v, j) => j + 1 !== SAAS.statut && v.trim()).join(" · ")}</span></span>
              <Badge s={i.values[SAAS.statut] ?? ""} />
            </button>
          ))}
        </div>
      )}
      {ed.modal}
    </>
  );
}

export function KanbanView({ titre }: { titre: string }) {
  const { items } = useStore();
  const ed = useEditor();
  const [over, setOver] = useState("");
  return (
    <>
      <Head title={titre} sub="Glisse une carte vers une autre colonne, ou change son statut dans la carte."><button className="b primary" onClick={() => ed.open("new")}>+ {E.nom}</button></Head>
      <div className="kanban">
        {SAAS.statuts.map((s) => {
          const col = items.filter((i) => i.values[SAAS.statut] === s);
          return (
            <div key={s} className={"col" + (over === s ? " over" : "")} onDragOver={(e) => { e.preventDefault(); setOver(s); }} onDragLeave={() => setOver("")} onDrop={(e) => { e.preventDefault(); setOver(""); const id = e.dataTransfer.getData("text/plain"); if (id) actions.setStatus(id, s); }}>
              <div className="col-h"><Badge s={s} /><span className="mut sm">{col.length}</span></div>
              {col.map((i) => (
                <div key={i.id} className="card kc" draggable onDragStart={(e) => e.dataTransfer.setData("text/plain", i.id)}>
                  <button className="kc-open" onClick={() => ed.open(i)}><b>{i.values[0]}</b><span className="mut sm">{i.values[1]}</span></button>
                  <select aria-label={"Statut de " + i.values[0]} value={s} onChange={(e) => actions.setStatus(i.id, e.target.value)}>
                    {SAAS.statuts.map((x) => <option key={x}>{x}</option>)}
                  </select>
                </div>
              ))}
            </div>
          );
        })}
      </div>
      {ed.modal}
    </>
  );
}

/** Agenda : éléments regroupés par la valeur de la 2e colonne (jour, échéance, créneau…). */
export function AgendaView({ titre }: { titre: string }) {
  const { items } = useStore();
  const ed = useEditor();
  const groups = new Map<string, Item[]>();
  for (const i of items) { const k = i.values[1] || "Sans date"; groups.set(k, [...(groups.get(k) ?? []), i]); }
  return (
    <>
      <Head title={titre} sub={"Regroupé par « " + (E.champs[1] ?? "") + " »"}><button className="b primary" onClick={() => ed.open("new")}>+ {E.nom}</button></Head>
      {items.length === 0 ? <Empty text="Rien de prévu" /> : (
        <div className="gridc">
          {[...groups.entries()].map(([k, list]) => (
            <div key={k} className="card"><b>{k}</b><div className="mini-list">{list.map((i) => <button key={i.id} className="mini" onClick={() => ed.open(i)}><span className="grow"><b>{i.values[0]}</b></span><Badge s={i.values[SAAS.statut] ?? ""} /></button>)}</div></div>
          ))}
        </div>
      )}
      {ed.modal}
    </>
  );
}

export function FormView({ titre }: { titre: string }) {
  const [values, setValues] = useState<string[]>(E.champs.map((_, i) => (i === SAAS.statut ? SAAS.statuts[0] ?? "" : "")));
  const [ok, setOk] = useState("");
  return (
    <>
      <Head title={titre} sub={"Ajouter : " + E.nom.toLowerCase()} />
      <form className="card form" onSubmit={(e) => { e.preventDefault(); if (!values[0]?.trim()) return; const it = actions.add(values); setOk(it.values[0] ?? ""); setValues(values.map((_, i) => (i === SAAS.statut ? SAAS.statuts[0] ?? "" : ""))); }}>
        {E.champs.map((c, i) => (
          <label key={c}>{c}
            {i === SAAS.statut
              ? <select value={values[i]} onChange={(e) => setValues(values.map((v, j) => (j === i ? e.target.value : v)))}>{SAAS.statuts.map((s) => <option key={s}>{s}</option>)}</select>
              : <input value={values[i]} required={i === 0} maxLength={500} onChange={(e) => setValues(values.map((v, j) => (j === i ? e.target.value : v)))} />}
          </label>
        ))}
        <div className="row"><button className="b primary">Enregistrer</button></div>
        {ok && <p className="mut sm" role="status">✓ « {ok} » enregistré.</p>}
      </form>
    </>
  );
}

/** À faire : les éléments dont le statut n'est pas terminé, avec un bouton pour les clore. */
export function TodoView({ titre }: { titre: string }) {
  const { items } = useStore();
  const ed = useEditor();
  const doneStatus = SAAS.statuts.find((s) => POS.test(s)) ?? SAAS.statuts[SAAS.statuts.length - 1] ?? "";
  const todo = items.filter((i) => !POS.test(i.values[SAAS.statut] ?? ""));
  return (
    <>
      <Head title={titre} sub={todo.length + " à traiter"} />
      {todo.length === 0 ? <Empty text="Tout est à jour" /> : (
        <div className="stack">
          {todo.map((i) => (
            <div key={i.id} className="card li" style={{ cursor: "default" }}>
              <span className="grow"><b>{i.values[0]}</b><span className="mut sm">{i.values.slice(1).join(" · ")}</span></span>
              <button className="b sm" onClick={() => ed.open(i)}>Modifier</button>
              <button className="b sm primary" onClick={() => actions.setStatus(i.id, doneStatus)}>Marquer « {doneStatus} »</button>
            </div>
          ))}
        </div>
      )}
      {ed.modal}
    </>
  );
}

export function GoalsView({ titre }: { titre: string }) {
  const { goals } = useStore();
  const [nom, setNom] = useState("");
  const [cible, setCible] = useState("500");
  return (
    <>
      <Head title={titre} sub="Fixe un montant, ajoute au fil de l'eau." />
      <form className="card row" style={{ marginBottom: 14 }} onSubmit={(e) => { e.preventDefault(); if (!nom.trim()) return; actions.addGoal(nom, Number(cible) || 1); setNom(""); }}>
        <input value={nom} onChange={(e) => setNom(e.target.value)} placeholder="Nom de l'objectif" required aria-label="Nom de l'objectif" style={{ flex: 1 }} />
        <input type="number" min={1} value={cible} onChange={(e) => setCible(e.target.value)} aria-label="Montant visé" style={{ width: 120 }} />
        <button className="b primary">Créer</button>
      </form>
      {goals.length === 0 ? <Empty text="Aucun objectif" /> : (
        <div className="gridc">
          {goals.map((g) => {
            const pct = Math.min(100, Math.round((g.actuel / g.cible) * 100));
            return (
              <div key={g.id} className={"card goal" + (pct >= 100 ? " reached" : "")}>
                <div className="row between"><b>{g.nom}</b><span className="mut sm">{pct} %</span></div>
                <div className="big">{g.actuel.toLocaleString("fr-FR")} €<span className="mut sm"> / {g.cible.toLocaleString("fr-FR")} €</span></div>
                <div className="gbar"><i style={{ width: pct + "%" }} /></div>
                <div className="row">
                  <button className="b sm" onClick={() => actions.addToGoal(g.id, 10)}>+ 10 €</button>
                  <button className="b sm" onClick={() => actions.addToGoal(g.id, 50)}>+ 50 €</button>
                  <button className="b sm danger" onClick={() => actions.removeGoal(g.id)}>Supprimer</button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}

export function SettingsView({ titre }: { titre: string }) {
  const state = useStore();
  const [msg, setMsg] = useState("");
  const [nom, setNom] = useState(state.profil.nom);
  function download() {
    const url = URL.createObjectURL(new Blob([actions.exportCsv()], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url; a.download = E.pluriel.toLowerCase().replace(/[^a-z0-9]+/g, "-") + ".csv"; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    if (f.size > 5_000_000) { setMsg("Fichier trop lourd (5 Mo maximum)."); return; }
    f.text().then((t) => { const n = actions.importCsv(t); setMsg(n ? n + " ligne(s) importée(s)." : "Aucune ligne reconnue : vérifie les colonnes."); }, () => setMsg("Fichier illisible."));
  }
  return (
    <>
      <Head title={titre} />
      <form className="card form" onSubmit={(e) => { e.preventDefault(); actions.setProfil(nom); setMsg("Profil enregistré."); }}>
        <b>Profil</b>
        <label>Ton nom<input value={nom} onChange={(e) => setNom(e.target.value)} maxLength={80} /></label>
        <div className="row"><button className="b primary">Enregistrer</button></div>
      </form>
      <div className="card form" style={{ marginTop: 14 }}>
        <b>Données</b>
        <p className="mut sm">{state.items.length} {E.pluriel.toLowerCase()} enregistré(s) dans ce navigateur. Colonnes CSV : {E.champs.join(", ")}.</p>
        <div className="row">
          <button className="b" type="button" onClick={download}>Exporter en CSV</button>
          <label className="b" style={{ cursor: "pointer" }}>Importer un CSV<input type="file" accept=".csv,text/csv" onChange={onFile} style={{ display: "none" }} /></label>
          <button className="b" type="button" onClick={() => { actions.reset(); setMsg("Données d'exemple restaurées."); }}>Données d'exemple</button>
          <button className="b danger" type="button" onClick={() => { if (window.confirm("Tout effacer ? C'est définitif.")) { actions.clearAll(); setMsg("Données effacées."); } }}>Tout effacer</button>
        </div>
        {msg && <p className="mut sm" role="status">{msg}</p>}
      </div>
    </>
  );
}

export function PricingView({ titre }: { titre: string }) {
  return (
    <>
      <Head title={titre} sub="Paiement en ligne non configuré : ces offres sont affichées à titre indicatif." />
      <div className="plans">
        {SAAS.offres.map((o, i) => (
          <div key={o.nom} className={"card plan" + (i === 1 ? " hl" : "")}>
            <b>{o.nom}</b>
            <div className="price">{o.prix === 0 ? "Gratuit" : o.prix + " €"}<span className="mut sm">{o.prix === 0 ? "" : " / " + o.periode}</span></div>
            <ul>{o.points.map((p) => <li key={p}>{p}</li>)}</ul>
          </div>
        ))}
      </div>
      <p className="mut sm" style={{ marginTop: 14 }}>Pour encaisser de vrais paiements, il faut brancher un prestataire (par exemple Stripe) : voir le README.</p>
    </>
  );
}

export function LoginView({ titre }: { titre: string }) {
  return (
    <div className="auth">
      <div className="card auth-c">
        <h1>{titre}</h1>
        <p className="mut">Les comptes utilisateurs ne sont pas configurés dans cette version : l'application fonctionne sans connexion, avec des données gardées dans ce navigateur.</p>
        <p className="mut sm">Pour de vrais comptes, il faut un service d'authentification (par exemple Supabase) : voir le README.</p>
        <Link className="b primary" href="/">Retour à l'accueil</Link>
      </div>
    </div>
  );
}

export function ActivityView({ titre }: { titre: string }) {
  const { log } = useStore();
  return (
    <>
      <Head title={titre} sub="Les dernières actions faites dans ce navigateur." />
      {log.length === 0 ? <Empty text="Aucune activité pour l'instant" /> : (
        <div className="card timeline">
          {log.map((l, i) => <div key={i} className="tl"><i /><span>{l.text}</span><span className="mut xs">{new Date(l.at).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" })}</span></div>)}
        </div>
      )}
    </>
  );
}
`;

/** CSS propre aux composants React, en plus de la feuille des prototypes. */
export const REACT_CSS = `a{color:inherit;text-decoration:none}.side a{text-decoration:none}main{flex:1}
.kc{gap:8px}.kc-open{all:unset;cursor:pointer;display:grid;gap:4px}.kc select{padding:6px 8px;font-size:12.5px}
.li{border:var(--bd);font:inherit;color:inherit}.tile{font:inherit;color:inherit;border:var(--bd)}
.chart text{font-family:inherit}.chart .bar{animation:none;transform:none}
@media(max-width:680px){.badge-proto{display:none}}`;
