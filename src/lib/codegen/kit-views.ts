// Kit du générateur : components/views.tsx, les pages fonctionnelles communes du projet généré.
// Toute écriture passe par lib/store.ts (validation de lib/rules.ts) : aucun faux succès.
// Mêmes règles que kit-data.ts : pas d'accent grave ni de « ${ » dans ce texte.

export const VIEWS_TSX = String.raw`"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, useSyncExternalStore } from "react";
import { SAAS } from "@/lib/config";
import { daySlots, fmt, inputType, sortKey, type Errors, type FieldType } from "@/lib/rules";
import { actions, SCHEMA, tone, useStore, type Result } from "@/lib/store";
import type { Item, Offre } from "@/lib/types";

const E = SAAS.entite;
const ST = SAAS.statut;
const T = (j: number): FieldType => SAAS.types[j] ?? "text";
const POS = /confirm|valid|gagn|pay|résolu|livr|termin|fait|actif/i;
/** Page de détail d'une fiche (projets sans architecture dédiée). */
const FICHE = SAAS.arch ? "" : "/fiche";
const pad = (n: number) => String(n).padStart(2, "0");
const isoDay = (d: Date) => d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate());
const nowMinute = () => { const d = new Date(); return isoDay(d) + "T" + pad(d.getHours()) + ":" + pad(d.getMinutes()); };
const blank = () => E.champs.map((_, j) => (j === ST ? SAAS.statuts[0] ?? "" : ""));
const none = () => () => {};
/** Vrai une fois dans le navigateur (les données et la date du jour n'existent pas au rendu serveur). */
export const useMounted = () => useSyncExternalStore(none, () => true, () => false);

// ─── Messages de confirmation et d'erreur ───
type Toast = { id: number; text: string; kind: "ok" | "bad" };
let toasts: Toast[] = [];
let nextToast = 0;
const toastSubs = new Set<() => void>();
const emit = () => toastSubs.forEach((f) => f());
export function notify(text: string, kind: "ok" | "bad" = "ok") {
  const t = { id: ++nextToast, text, kind };
  toasts = [...toasts, t].slice(-4);
  emit();
  setTimeout(() => { toasts = toasts.filter((x) => x.id !== t.id); emit(); }, kind === "bad" ? 6000 : 3500);
}
const toastSub = (f: () => void) => { toastSubs.add(f); return () => { toastSubs.delete(f); }; };
export function Toasts() {
  const list = useSyncExternalStore(toastSub, () => toasts, () => toasts);
  return <div className="toasts" role="status" aria-live="polite">{list.map((t) => <div key={t.id} className={"toast " + t.kind}>{t.kind === "ok" ? "✓ " : "⚠ "}{t.text}</div>)}</div>;
}
/** Affiche le résultat d'une écriture ; renvoie vrai si elle a vraiment été enregistrée. */
export function report(r: Result, ok: string) {
  if (r.ok) notify(ok);
  else notify(r.error, "bad");
  return r.ok;
}

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
function Empty({ text, sub = "Ajoute un premier élément avec le bouton « + »." }: { text: string; sub?: string }) {
  return <div className="empty"><b>{text}</b><p className="mut">{sub}</p></div>;
}
const show = (i: Item, j: number) => (j === ST ? <Badge s={i.values[j] ?? ""} /> : fmt(i.values[j] ?? "", T(j)));
const required = (j: number) => j === 0 || SCHEMA.booking?.date === j || SCHEMA.unique === j;

/** Champ de saisie adapté au type de la colonne, avec son message d'erreur. */
function Field({ j, value, onChange, error, autoFocus }: { j: number; value: string; onChange: (v: string) => void; error?: string; autoFocus?: boolean }) {
  const t = T(j);
  const id = "champ-" + j;
  return (
    <label htmlFor={id}>{E.champs[j]}{required(j) && <span aria-hidden="true"> *</span>}
      {t === "status" ? (
        <select id={id} value={value} onChange={(e) => onChange(e.target.value)}>
          {SAAS.statuts.map((s) => <option key={s}>{s}</option>)}
        </select>
      ) : (
        <input id={id} type={inputType(t)} inputMode={t === "money" || t === "number" ? "decimal" : undefined} value={value} maxLength={500} autoFocus={autoFocus}
          placeholder={t === "money" ? "ex. 12,50" : t === "email" ? "nom@exemple.fr" : undefined}
          aria-invalid={error ? true : undefined} aria-describedby={error ? id + "-err" : undefined} onChange={(e) => onChange(e.target.value)} />
      )}
      {error && <span id={id + "-err"} className="err" role="alert">{error}</span>}
    </label>
  );
}

/** Fenêtre d'ajout et de modification. Rien n'est enregistré si la saisie est refusée. */
function ItemModal({ item, init, onClose }: { item: Item | "new"; init?: string[]; onClose: () => void }) {
  const isNew = item === "new";
  const [values, setValues] = useState<string[]>(isNew ? init ?? blank() : item.values.slice());
  const [errors, setErrors] = useState<Errors>({});
  const [confirm, setConfirm] = useState<"" | "suppr" | "annul">("");
  const annule = SCHEMA.booking?.annule[0];
  const set = (j: number, v: string) => { setValues(values.map((x, k) => (k === j ? v : x))); if (errors[j]) setErrors({ ...errors, [j]: "" }); };
  function submit(e: React.FormEvent) {
    e.preventDefault();
    const r = isNew ? actions.add(values) : actions.update(item.id, values);
    if (r.ok) { notify(isNew ? "C'est enregistré : « " + (values[0] || E.nom) + " »." : "Modifications enregistrées."); onClose(); return; }
    setErrors(r.fields);
    if (!Object.keys(r.fields).length) notify(r.error, "bad");
  }
  return (
    <div className="modal-bg" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }} onKeyDown={(e) => { if (e.key === "Escape") onClose(); }}>
      <form className="modal" onSubmit={submit} role="dialog" aria-modal="true" aria-label={isNew ? "Ajouter" : "Modifier"} noValidate>
        <div className="row between"><h2>{isNew ? "Ajouter : " + E.nom.toLowerCase() : values[0] || E.nom}</h2><button type="button" className="ib" onClick={onClose} aria-label="Fermer">✕</button></div>
        <div className="form">
          {E.champs.map((c, j) => <Field key={c} j={j} value={values[j] ?? ""} onChange={(v) => set(j, v)} error={errors[j]} autoFocus={j === 0} />)}
        </div>
        <div className="row between">
          <div className="row">
            {!isNew && (confirm === "suppr"
              ? <button type="button" className="b danger" onClick={() => { actions.remove(item.id); notify("Suppression effectuée."); onClose(); }}>Confirmer la suppression</button>
              : <button type="button" className="b danger" onClick={() => setConfirm("suppr")}>Supprimer</button>)}
            {!isNew && annule && item.values[ST] !== annule && (confirm === "annul"
              ? <button type="button" className="b" onClick={() => { if (report(actions.setStatus(item.id, annule), "Réservation annulée : le créneau est libéré.")) onClose(); }}>Confirmer l&apos;annulation</button>
              : <button type="button" className="b" onClick={() => setConfirm("annul")}>Annuler la réservation</button>)}
            {!isNew && FICHE && <Link className="b" href={FICHE + "?id=" + item.id}>Voir la fiche</Link>}
          </div>
          <div className="row"><button type="button" className="b" onClick={onClose}>Fermer</button><button className="b primary">{isNew ? "Ajouter" : "Enregistrer"}</button></div>
        </div>
      </form>
    </div>
  );
}

/** Ouverture de la fenêtre d'édition, partagée par les vues. */
export function useEditor() {
  const [edit, setEdit] = useState<{ item: Item | "new"; init?: string[] } | null>(null);
  const modal = edit ? <ItemModal item={edit.item} init={edit.init} onClose={() => setEdit(null)} /> : null;
  return { open: (item: Item | "new", init?: string[]) => setEdit({ item, init }), modal };
}

/** Recherche, filtre par statut et tri par colonne (dates et nombres comparés pour de vrai). */
function useFiltered(items: Item[]) {
  const [q, setQ] = useState("");
  const [statut, setStatut] = useState("");
  const [sort, setSort] = useState<{ col: number; dir: number } | null>(null);
  const filtered = items.filter((i) => (!q || i.values.join(" ").toLowerCase().includes(q.toLowerCase())) && (!statut || i.values[ST] === statut));
  const list = sort ? filtered.slice().sort((a, b) => {
    const x = sortKey(a.values[sort.col] ?? "", T(sort.col)), y = sortKey(b.values[sort.col] ?? "", T(sort.col));
    return (x < y ? -1 : x > y ? 1 : 0) * sort.dir;
  }) : filtered;
  const controls = (
    <div className="row" style={{ marginBottom: 14 }}>
      <input type="search" placeholder="Rechercher…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Rechercher" style={{ maxWidth: 280 }} />
      <div className="chips" style={{ margin: 0 }}>
        {["", ...SAAS.statuts].map((s) => <button key={s || "tous"} type="button" className={"chip" + (statut === s ? " on" : "")} aria-pressed={statut === s} onClick={() => setStatut(s)}>{s || "Tous"}</button>)}
      </div>
      <select aria-label="Trier par" value={sort ? sort.col + ":" + sort.dir : ""} onChange={(e) => { const [c, d] = e.target.value.split(":"); setSort(e.target.value ? { col: Number(c), dir: Number(d) } : null); }} style={{ maxWidth: 220 }}>
        <option value="">Trier : plus récents</option>
        {E.champs.map((c, j) => [<option key={j + "a"} value={j + ":1"}>{c} ↑</option>, <option key={j + "d"} value={j + ":-1"}>{c} ↓</option>])}
      </select>
    </div>
  );
  return { list, controls, sort, setSort };
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
  const counts = SAAS.statuts.map((s) => ({ s, n: items.filter((i) => i.values[ST] === s).length }));
  const max = Math.max(1, ...counts.map((c) => c.n));
  const col = SAAS.types.indexOf("money");
  const total = col >= 0 ? items.reduce((s, i) => s + (Number(i.values[col]) || 0), 0) : null;
  const done = items.filter((i) => POS.test(i.values[ST] ?? "")).length;
  const hasDone = SAAS.statuts.some((s) => POS.test(s));
  const top = counts.slice().sort((a, b) => b.n - a.n)[0];
  const mounted = useMounted();
  const week = mounted ? items.filter((i) => Date.now() - new Date(i.createdAt).getTime() < 7 * 86400000).length : 0;
  return (
    <>
      <Head title={titre} sub="Chiffres calculés à partir de tes données."><button className="b primary" onClick={() => ed.open("new")}>+ {E.nom}</button></Head>
      <div className="kpis">
        <div className="card kpi"><span className="mut sm">{E.pluriel}</span><div className="big">{items.length}</div><span className="mut xs">{week} ajouté(s) cette semaine</span></div>
        {hasDone
          ? <div className="card kpi"><span className="mut sm">Terminés ou validés</span><div className="big">{done}</div><span className="mut xs">{items.length ? Math.round((done / items.length) * 100) : 0} % du total</span></div>
          : <div className="card kpi"><span className="mut sm">{E.champs[ST]} la plus fréquente</span><div className="big" style={{ fontSize: 24 }}>{top && top.n ? top.s : "—"}</div><span className="mut xs">{top ? top.n : 0} élément(s) sur {items.length}</span></div>}
        <div className="card kpi"><span className="mut sm">{total !== null ? "Total " + E.champs[col]!.toLowerCase() : "Favoris"}</span><div className="big">{total !== null ? fmt(String(total), "money") : items.filter((i) => i.fav).length}</div><span className="mut xs">{total !== null ? "somme de la colonne" : "éléments marqués"}</span></div>
      </div>
      <div className="split">
        <div className="card">
          <b>Répartition par {E.champs[ST]!.toLowerCase()}</b>
          <svg viewBox={"0 0 400 " + (counts.length * 34 + 8)} className="chart" role="img" aria-label={"Répartition par " + E.champs[ST]}>
            {counts.map((c, i) => (
              <g key={c.s} transform={"translate(0," + (i * 34 + 4) + ")"}>
                <text x="0" y="17" fontSize="13" fill="currentColor">{c.s}</text>
                <rect x="130" y="4" width={Math.max(2, (c.n / max) * 230)} height="18" rx="5" className="bar"><title>{c.s + " : " + c.n}</title></rect>
                <text x={136 + (c.n / max) * 230} y="17" fontSize="13" fill="currentColor">{c.n}</text>
              </g>
            ))}
          </svg>
        </div>
        <div className="card">
          <b>Derniers ajouts</b>
          <div className="mini-list">
            {items.slice(0, 5).map((i) => (
              <button key={i.id} className="mini" onClick={() => ed.open(i)}><span className="grow"><b>{i.values[0]}</b><span className="mut sm">{fmt(i.values[1] ?? "", T(1))}</span></span><Badge s={i.values[ST] ?? ""} /></button>
            ))}
            {!items.length && <p className="mut sm">Aucune donnée pour l&apos;instant.</p>}
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
  const { list, controls, sort, setSort } = useFiltered(items);
  return (
    <>
      <Head title={titre} sub={items.length + " " + E.pluriel.toLowerCase()}><button className="b primary" onClick={() => ed.open("new")}>+ {E.nom}</button></Head>
      {controls}
      {list.length === 0 ? <Empty text={items.length ? "Aucun résultat pour ces filtres" : "Aucune donnée pour l'instant"} /> : (
        <div className="card flush" style={{ overflowX: "auto" }}>
          <table>
            <thead><tr>{E.champs.map((c, j) => <th key={c} aria-sort={sort?.col === j ? (sort.dir > 0 ? "ascending" : "descending") : undefined}><button onClick={() => setSort({ col: j, dir: sort?.col === j ? -sort.dir : 1 })}>{c} {sort?.col === j ? (sort.dir > 0 ? "↑" : "↓") : ""}</button></th>)}<th /></tr></thead>
            <tbody>
              {list.map((i) => (
                <tr key={i.id} onClick={() => ed.open(i)} tabIndex={0} onKeyDown={(e) => { if (e.key === "Enter") ed.open(i); }}>
                  {i.values.map((_, j) => <td key={j}>{j === 0 ? <b>{i.values[0]}</b> : show(i, j)}</td>)}
                  <td className="r"><button className={"ib fav" + (i.fav ? " on" : "")} aria-label="Favori" aria-pressed={i.fav} onClick={(e) => { e.stopPropagation(); actions.toggleFav(i.id); }}>{i.fav ? "♥" : "♡"}</button></td>
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
  const router = useRouter();
  const { list, controls } = useFiltered(items);
  const open = (i: Item) => (FICHE ? router.push(FICHE + "?id=" + i.id) : ed.open(i));
  return (
    <>
      <Head title={titre} sub={list.length + " " + E.pluriel.toLowerCase()}><button className="b primary" onClick={() => ed.open("new")}>+ {E.nom}</button></Head>
      {controls}
      {list.length === 0 ? <Empty text={items.length ? "Aucun résultat pour ces filtres" : "Aucune fiche pour l'instant"} /> : (
        <div className={grid ? "gridc" : "stack"}>
          {list.map((i, k) => (
            <button key={i.id} className={"card " + (grid ? "tile" : "li")} onClick={() => open(i)} style={{ "--i": k, textAlign: "left" } as React.CSSProperties}>
              <span className="grow"><b>{i.values[0]}</b><span className="mut sm">{i.values.slice(1).map((v, j) => (j + 1 !== ST && v ? fmt(v, T(j + 1)) : "")).filter(Boolean).join(" · ")}</span></span>
              <Badge s={i.values[ST] ?? ""} />
            </button>
          ))}
        </div>
      )}
      {ed.modal}
    </>
  );
}

/** Page de détail d'une fiche : /fiche?id=… */
export function DetailView() {
  const params = useSearchParams();
  const router = useRouter();
  const { items } = useStore();
  const ed = useEditor();
  const mounted = useMounted();
  const [confirm, setConfirm] = useState(false);
  if (!mounted) return <p className="mut">Chargement…</p>;
  const it = items.find((i) => i.id === params.get("id"));
  if (!it) return <Empty text="Fiche introuvable" sub="Elle a peut-être été supprimée." />;
  return (
    <>
      <Head title={it.values[0] || E.nom} sub={E.nom}>
        <button className="b" onClick={() => router.back()}>← Retour</button>
        <button className="b primary" onClick={() => ed.open(it)}>Modifier</button>
      </Head>
      <div className="card">
        <dl className="fiche">
          {E.champs.map((c, j) => <div key={c}><dt className="mut sm">{c}</dt><dd>{show(it, j)}</dd></div>)}
        </dl>
        <p className="mut xs">Ajouté le {new Date(it.createdAt).toLocaleDateString("fr-FR")} · modifié le {new Date(it.updatedAt).toLocaleDateString("fr-FR")}</p>
        <div className="row">
          {confirm
            ? <button className="b danger" onClick={() => { actions.remove(it.id); notify("Suppression effectuée."); router.back(); }}>Confirmer la suppression</button>
            : <button className="b danger" onClick={() => setConfirm(true)}>Supprimer</button>}
          <button className={"b" + (it.fav ? " primary" : "")} aria-pressed={it.fav} onClick={() => actions.toggleFav(it.id)}>{it.fav ? "♥ Favori" : "♡ Ajouter aux favoris"}</button>
        </div>
      </div>
      {ed.modal}
    </>
  );
}

export function KanbanView({ titre }: { titre: string }) {
  const { items } = useStore();
  const ed = useEditor();
  const [over, setOver] = useState("");
  const move = (id: string, s: string) => { const r = actions.setStatus(id, s); if (!r.ok) notify(r.error, "bad"); };
  return (
    <>
      <Head title={titre} sub="Glisse une carte vers une autre colonne, ou change son statut dans la carte."><button className="b primary" onClick={() => ed.open("new")}>+ {E.nom}</button></Head>
      <div className="kanban">
        {SAAS.statuts.map((s) => {
          const col = items.filter((i) => i.values[ST] === s);
          return (
            <div key={s} className={"col" + (over === s ? " over" : "")} onDragOver={(e) => { e.preventDefault(); setOver(s); }} onDragLeave={() => setOver("")} onDrop={(e) => { e.preventDefault(); setOver(""); const id = e.dataTransfer.getData("text/plain"); if (id) move(id, s); }}>
              <div className="col-h"><Badge s={s} /><span className="mut sm">{col.length}</span></div>
              {col.map((i) => (
                <div key={i.id} className="card kc" draggable onDragStart={(e) => e.dataTransfer.setData("text/plain", i.id)}>
                  <button className="kc-open" onClick={() => ed.open(i)}><b>{i.values[0]}</b><span className="mut sm">{fmt(i.values[1] ?? "", T(1))}</span></button>
                  <select aria-label={"Statut de " + i.values[0]} value={s} onChange={(e) => move(i.id, e.target.value)}>
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

/** Agenda : créneaux réservables (modèles de réservation), sinon éléments regroupés par date. */
export function AgendaView({ titre }: { titre: string }) {
  return SCHEMA.booking ? <BookingView titre={titre} /> : <DatesView titre={titre} />;
}

function DatesView({ titre }: { titre: string }) {
  const { items } = useStore();
  const ed = useEditor();
  const dc = SAAS.types.findIndex((t) => t === "date" || t === "datetime");
  const col = dc >= 0 ? dc : 1;
  const sorted = items.slice().sort((a, b) => (a.values[col] ?? "").localeCompare(b.values[col] ?? ""));
  const groups = new Map<string, Item[]>();
  for (const i of sorted) { const v = i.values[col] ?? ""; const k = dc >= 0 && v ? fmt(v.slice(0, 10), "date") : v || "Sans date"; groups.set(k, [...(groups.get(k) ?? []), i]); }
  return (
    <>
      <Head title={titre} sub={"Regroupé par « " + (E.champs[col] ?? "") + " »"}><button className="b primary" onClick={() => ed.open("new")}>+ {E.nom}</button></Head>
      {items.length === 0 ? <Empty text="Rien de prévu" /> : (
        <div className="gridc">
          {[...groups.entries()].map(([k, list]) => (
            <div key={k} className="card"><b>{k}</b><div className="mini-list">{list.map((i) => <button key={i.id} className="mini" onClick={() => ed.open(i)}><span className="grow"><b>{i.values[0]}</b></span><Badge s={i.values[ST] ?? ""} /></button>)}</div></div>
          ))}
        </div>
      )}
      {ed.modal}
    </>
  );
}

const JOURS = ["dimanche", "lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi"];
function BookingView({ titre }: { titre: string }) {
  const b = SCHEMA.booking!;
  const { items } = useStore();
  const ed = useEditor();
  const mounted = useMounted();
  const [day, setDay] = useState("");
  const ressources = b.ressource === undefined ? [] : [...new Set(items.map((i) => i.values[b.ressource!] ?? "").filter(Boolean))];
  const [ressource, setRessource] = useState("");
  if (!mounted) return <p className="mut">Chargement de l&apos;agenda…</p>;
  const d = day || isoDay(new Date());
  const r = b.ressource === undefined ? "" : ressource || ressources[0] || "";
  const pool = b.ressource === undefined ? items : items.filter((i) => (i.values[b.ressource!] ?? "").toLowerCase() === r.toLowerCase());
  const slots = daySlots(d, pool, SCHEMA);
  const now = nowMinute();
  const shift = (n: number) => { const x = new Date(d + "T00:00"); x.setDate(x.getDate() + n); setDay(isoDay(x)); };
  const book = (at: string) => { const v = blank(); v[b.date] = at; if (b.ressource !== undefined) v[b.ressource] = r; ed.open("new", v); };
  const upcoming = items.filter((i) => (i.values[b.date] ?? "") >= now && !b.annule.includes(i.values[ST] ?? "")).sort((x, y) => (x.values[b.date] ?? "").localeCompare(y.values[b.date] ?? "")).slice(0, 8);
  const libres = slots.filter((s) => s.open && !s.taken && s.at >= now).length;
  return (
    <>
      <Head title={titre} sub={"Ouvert le " + b.jours.map((j) => JOURS[j]).join(", ") + " · " + b.debut + "–" + b.fin + " · créneaux de " + b.duree + " min"}>
        <button className="b primary" onClick={() => ed.open("new")}>+ {E.nom}</button>
      </Head>
      <div className="row" style={{ marginBottom: 14 }}>
        <button className="b" onClick={() => shift(-1)} aria-label="Jour précédent">←</button>
        <input type="date" value={d} onChange={(e) => setDay(e.target.value)} aria-label="Jour affiché" style={{ maxWidth: 180 }} />
        <button className="b" onClick={() => shift(1)} aria-label="Jour suivant">→</button>
        <button className="b" onClick={() => setDay("")}>Aujourd&apos;hui</button>
        {ressources.length > 0 && (
          <select aria-label={E.champs[b.ressource!]} value={r} onChange={(e) => setRessource(e.target.value)} style={{ maxWidth: 220 }}>
            {ressources.map((x) => <option key={x}>{x}</option>)}
          </select>
        )}
        <span className="mut sm">{slots.length && slots[0]!.open ? libres + " créneau(x) libre(s)" : ""}</span>
      </div>
      {!slots.length || !slots[0]!.open ? <Empty text="Fermé ce jour-là" sub="Choisis un autre jour. Les jours et horaires d'ouverture se règlent dans lib/config.ts (booking)." /> : (
        <div className="slots">
          {slots.map((s) => s.taken ? (
            <button key={s.at} className="slot taken" onClick={() => ed.open(s.taken as Item)}><b>{s.time}</b><span>{s.taken.values[0]}</span><Badge s={s.taken.values[ST] ?? ""} /></button>
          ) : s.at < now ? (
            <span key={s.at} className="slot past"><b>{s.time}</b><span>Passé</span></span>
          ) : (
            <button key={s.at} className="slot free" onClick={() => book(s.at)}><b>{s.time}</b><span>Libre — réserver</span></button>
          ))}
        </div>
      )}
      <div className="card" style={{ marginTop: 16 }}>
        <b>Prochaines réservations</b>
        <div className="mini-list">
          {upcoming.map((i) => <button key={i.id} className="mini" onClick={() => ed.open(i)}><span className="grow"><b>{i.values[0]}</b><span className="mut sm">{fmt(i.values[b.date] ?? "", "datetime")}{b.ressource !== undefined && b.ressource !== 0 ? " · " + i.values[b.ressource] : ""}</span></span><Badge s={i.values[ST] ?? ""} /></button>)}
          {!upcoming.length && <p className="mut sm">Aucune réservation à venir.</p>}
        </div>
      </div>
      {ed.modal}
    </>
  );
}

export function FormView({ titre }: { titre: string }) {
  const [values, setValues] = useState<string[]>(blank());
  const [errors, setErrors] = useState<Errors>({});
  const [ok, setOk] = useState("");
  function submit(e: React.FormEvent) {
    e.preventDefault();
    const r = actions.add(values);
    if (!r.ok) { setErrors(r.fields); setOk(""); if (!Object.keys(r.fields).length) notify(r.error, "bad"); return; }
    setOk(values[0] ?? "");
    setErrors({});
    setValues(blank());
    notify("C'est enregistré.");
  }
  return (
    <>
      <Head title={titre} sub={"Ajouter : " + E.nom.toLowerCase()} />
      <form className="card form" onSubmit={submit} noValidate>
        {E.champs.map((c, j) => <Field key={c} j={j} value={values[j] ?? ""} onChange={(v) => { setValues(values.map((x, k) => (k === j ? v : x))); setOk(""); }} error={errors[j]} />)}
        <div className="row"><button className="b primary">Enregistrer</button></div>
        {ok && <p className="ok-msg" role="status">✓ « {ok} » est enregistré.</p>}
      </form>
    </>
  );
}

/** Inscription publique à la liste d'attente : e-mail vérifié, doublons refusés. */
export function WaitlistView({ titre }: { titre: string }) {
  const u = SCHEMA.unique ?? 0;
  const [email, setEmail] = useState("");
  const [source, setSource] = useState(SAAS.statuts[0] ?? "");
  const [error, setError] = useState("");
  const [done, setDone] = useState("");
  function submit(e: React.FormEvent) {
    e.preventDefault();
    const values = E.champs.map((_, j) => (j === u ? email : j === ST ? source : T(j) === "date" ? isoDay(new Date()) : T(j) === "number" ? "0" : ""));
    const r = actions.add(values);
    if (!r.ok) { setError(r.error); return; }
    setError("");
    setDone(email.trim().toLowerCase());
    setEmail("");
  }
  return (
    <div className="auth">
      <div className="card auth-c">
        <h1>{titre}</h1>
        <p className="mut">{SAAS.description}</p>
        {done ? (
          <div role="status"><p className="ok-msg">✓ C&apos;est noté : <b>{done}</b> est inscrit sur la liste.</p><button className="b" onClick={() => setDone("")}>Inscrire une autre adresse</button></div>
        ) : (
          <form className="form" onSubmit={submit} noValidate>
            <label htmlFor="wl-email">{E.champs[u]}<input id="wl-email" type="email" autoComplete="email" value={email} onChange={(e) => { setEmail(e.target.value); setError(""); }} placeholder="nom@exemple.fr" aria-invalid={error ? true : undefined} aria-describedby={error ? "wl-err" : undefined} /></label>
            {SAAS.statuts.length > 0 && <label htmlFor="wl-src">{E.champs[ST]}<select id="wl-src" value={source} onChange={(e) => setSource(e.target.value)}>{SAAS.statuts.map((s) => <option key={s}>{s}</option>)}</select></label>}
            {error && <p id="wl-err" className="err" role="alert">{error}</p>}
            <button className="b primary lg">Je m&apos;inscris</button>
          </form>
        )}
        <p className="mut xs">Ton adresse sert uniquement à te prévenir du lancement. Mode local : les inscriptions sont enregistrées dans ce navigateur. Pour recevoir celles de tes visiteurs, il faut brancher une base de données (voir le README).</p>
      </div>
    </div>
  );
}

/** À faire : les éléments dont le statut n'est pas terminé, avec un bouton pour les clore. */
export function TodoView({ titre }: { titre: string }) {
  const { items } = useStore();
  const ed = useEditor();
  const doneStatus = SAAS.statuts.find((s) => POS.test(s)) ?? SAAS.statuts[SAAS.statuts.length - 1] ?? "";
  const todo = items.filter((i) => !POS.test(i.values[ST] ?? ""));
  return (
    <>
      <Head title={titre} sub={todo.length + " à traiter"} />
      {todo.length === 0 ? <Empty text="Tout est à jour" sub="Rien à traiter pour l'instant." /> : (
        <div className="stack">
          {todo.map((i) => (
            <div key={i.id} className="card li" style={{ cursor: "default" }}>
              <span className="grow"><b>{i.values[0]}</b><span className="mut sm">{i.values.slice(1).map((v, j) => (v ? fmt(v, T(j + 1)) : "")).filter(Boolean).join(" · ")}</span></span>
              <button className="b sm" onClick={() => ed.open(i)}>Modifier</button>
              <button className="b sm primary" onClick={() => report(actions.setStatus(i.id, doneStatus), "Marqué « " + doneStatus + " ».")}>Marquer « {doneStatus} »</button>
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
  const [error, setError] = useState("");
  return (
    <>
      <Head title={titre} sub="Fixe un montant, ajoute au fil de l'eau." />
      <form className="card row" style={{ marginBottom: 14 }} noValidate onSubmit={(e) => {
        e.preventDefault();
        const c = Number(cible.replace(",", "."));
        if (!nom.trim()) { setError("Donne un nom à l'objectif."); return; }
        if (!Number.isFinite(c) || c <= 0) { setError("Le montant visé doit être un nombre positif."); return; }
        actions.addGoal(nom, c); setNom(""); setError(""); notify("Objectif créé.");
      }}>
        <input value={nom} onChange={(e) => setNom(e.target.value)} placeholder="Nom de l'objectif" aria-label="Nom de l'objectif" style={{ flex: 1 }} />
        <input inputMode="decimal" value={cible} onChange={(e) => setCible(e.target.value)} aria-label="Montant visé" style={{ width: 120 }} />
        <button className="b primary">Créer</button>
        {error && <span className="err" role="alert">{error}</span>}
      </form>
      {goals.length === 0 ? <Empty text="Aucun objectif" sub="Crée un premier objectif ci-dessus." /> : (
        <div className="gridc">
          {goals.map((g) => {
            const pct = Math.min(100, Math.round((g.actuel / g.cible) * 100));
            return (
              <div key={g.id} className={"card goal" + (pct >= 100 ? " reached" : "")}>
                <div className="row between"><b>{g.nom}</b><span className="mut sm">{pct} %</span></div>
                <div className="big">{fmt(String(g.actuel), "money")}<span className="mut sm"> / {fmt(String(g.cible), "money")}</span></div>
                <div className="gbar"><i style={{ width: pct + "%" }} /></div>
                <div className="row">
                  <button className="b sm" onClick={() => actions.addToGoal(g.id, 10)}>+ 10 €</button>
                  <button className="b sm" onClick={() => actions.addToGoal(g.id, 50)}>+ 50 €</button>
                  <button className="b sm danger" onClick={() => { actions.removeGoal(g.id); notify("Objectif supprimé."); }}>Supprimer</button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}

/** Édition des offres (nom, prix, caractéristiques) affichées sur la page Tarifs. */
function OffresEditor() {
  const { offres } = useStore();
  const [draft, setDraft] = useState<Offre[] | null>(null);
  const [error, setError] = useState("");
  const list = draft ?? offres;
  const set = (k: number, o: Partial<Offre>) => setDraft(list.map((x, i) => (i === k ? { ...x, ...o } : x)));
  return (
    <div className="card form" style={{ marginTop: 14 }}>
      <b>Offres</b>
      <p className="mut sm">Les offres affichées sur la page Tarifs. Aucun paiement n&apos;est branché : elles sont indicatives.</p>
      {list.map((o, k) => (
        <div key={k} className="offre-edit">
          <input aria-label={"Nom de l'offre " + (k + 1)} value={o.nom} onChange={(e) => set(k, { nom: e.target.value })} />
          <input aria-label={"Prix de l'offre " + (k + 1)} inputMode="decimal" value={String(o.prix)} onChange={(e) => set(k, { prix: e.target.value as unknown as number })} style={{ width: 90 }} />
          <input aria-label={"Période de l'offre " + (k + 1)} value={o.periode} onChange={(e) => set(k, { periode: e.target.value })} style={{ width: 110 }} />
          <textarea aria-label={"Caractéristiques de l'offre " + (k + 1)} rows={2} value={o.points.join("\n")} onChange={(e) => set(k, { points: e.target.value.split("\n") })} />
          <button type="button" className="b sm danger" onClick={() => setDraft(list.filter((_, i) => i !== k))}>Retirer</button>
        </div>
      ))}
      <div className="row">
        <button type="button" className="b" onClick={() => setDraft([...list, { nom: "Nouvelle offre", prix: 0, periode: "mois", points: [] }])}>+ Ajouter une offre</button>
        {draft && <button type="button" className="b primary" onClick={() => { const r = actions.setOffres(draft); if (r.ok) { setDraft(null); setError(""); notify("Offres enregistrées."); } else setError(r.error); }}>Enregistrer les offres</button>}
        {draft && <button type="button" className="b" onClick={() => { setDraft(null); setError(""); }}>Annuler</button>}
      </div>
      {error && <p className="err" role="alert">{error}</p>}
    </div>
  );
}

export function SettingsView({ titre }: { titre: string }) {
  const state = useStore();
  const [msg, setMsg] = useState("");
  const [nom, setNom] = useState(state.profil.nom);
  const [confirm, setConfirm] = useState(false);
  function download() {
    const url = URL.createObjectURL(new Blob([actions.exportCsv()], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url; a.download = E.pluriel.toLowerCase().replace(/[^a-z0-9]+/g, "-") + ".csv"; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    notify("Export CSV téléchargé.");
  }
  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    if (f.size > 5_000_000) { setMsg("Fichier trop lourd (5 Mo maximum)."); return; }
    setMsg("Import en cours…");
    f.text().then((t) => {
      const r = actions.importCsv(t);
      setMsg(r.ajoutees ? r.ajoutees + " ligne(s) importée(s)" + (r.rejetees ? ", " + r.rejetees + " écartée(s) car invalides." : ".") : r.rejetees ? "Aucune ligne importée : " + r.rejetees + " ligne(s) invalide(s). Vérifie les colonnes et les formats (dates, nombres)." : "Aucune ligne reconnue : vérifie les colonnes.");
    }, () => setMsg("Fichier illisible."));
  }
  return (
    <>
      <Head title={titre} />
      <form className="card form" onSubmit={(e) => { e.preventDefault(); actions.setProfil(nom); notify("Profil enregistré."); }}>
        <b>Profil</b>
        <label htmlFor="profil-nom">Ton nom<input id="profil-nom" value={nom} onChange={(e) => setNom(e.target.value)} maxLength={80} /></label>
        <div className="row"><button className="b primary">Enregistrer</button></div>
      </form>
      {SAAS.revenu !== "gratuit" && <OffresEditor />}
      <div className="card form" style={{ marginTop: 14 }}>
        <b>Données</b>
        <p className="mut sm">{state.items.length} {E.pluriel.toLowerCase()} enregistré(s) dans ce navigateur. Colonnes CSV : {E.champs.join(", ")}.</p>
        <div className="row">
          <button className="b" type="button" onClick={download}>Exporter en CSV</button>
          <label className="b" style={{ cursor: "pointer" }}>Importer un CSV<input type="file" accept=".csv,text/csv" onChange={onFile} style={{ display: "none" }} /></label>
          <button className="b" type="button" onClick={() => { actions.reset(); notify("Données d'exemple restaurées."); }}>Données d&apos;exemple</button>
          {confirm
            ? <button className="b danger" type="button" onClick={() => { actions.clearAll(); setConfirm(false); notify("Données effacées."); }}>Confirmer : tout effacer</button>
            : <button className="b danger" type="button" onClick={() => setConfirm(true)}>Tout effacer</button>}
        </div>
        {msg && <p className="mut sm" role="status">{msg}</p>}
      </div>
    </>
  );
}

export function PricingView({ titre }: { titre: string }) {
  const { offres } = useStore();
  const [choix, setChoix] = useState("");
  return (
    <>
      <Head title={titre} sub="Paiement en ligne non configuré : ces offres sont affichées à titre indicatif." />
      {offres.length === 0 ? <Empty text="Aucune offre" sub="Ajoute tes offres dans Paramètres." /> : (
        <div className="plans">
          {offres.map((o, i) => (
            <div key={o.nom + i} className={"card plan" + (i === 1 ? " hl" : "")}>
              <b>{o.nom}</b>
              <div className="price">{o.prix === 0 ? "Gratuit" : fmt(String(o.prix), "money")}<span className="mut sm">{o.prix === 0 ? "" : " / " + o.periode}</span></div>
              <ul>{o.points.filter(Boolean).map((p) => <li key={p}>{p}</li>)}</ul>
              <button className="b" onClick={() => setChoix(o.nom)}>Choisir {o.nom}</button>
            </div>
          ))}
        </div>
      )}
      {choix && <div className="card" role="status" style={{ marginTop: 14 }}><b>Aucun abonnement n&apos;a été créé.</b><p className="mut sm">Tu as choisi « {choix} », mais le paiement n&apos;est pas branché : aucune carte n&apos;est débitée et aucun accès n&apos;est activé. Pour encaisser, il faut un prestataire de paiement (par exemple Stripe) et un serveur : voir le README.</p></div>}
    </>
  );
}

export function LoginView({ titre }: { titre: string }) {
  return (
    <div className="auth">
      <div className="card auth-c">
        <h1>{titre}</h1>
        <p className="mut">Les comptes utilisateurs ne sont pas configurés dans cette version : l&apos;application fonctionne sans connexion, avec des données gardées dans ce navigateur.</p>
        <p className="mut sm">Pour de vrais comptes, il faut un service d&apos;authentification (par exemple Supabase) : voir le README.</p>
        <Link className="b primary" href="/">Retour à l&apos;accueil</Link>
      </div>
    </div>
  );
}

export function ActivityView({ titre }: { titre: string }) {
  const { log } = useStore();
  const mounted = useMounted();
  return (
    <>
      <Head title={titre} sub="Les dernières actions faites dans ce navigateur." />
      {!mounted ? <p className="mut">Chargement…</p> : log.length === 0 ? <Empty text="Aucune activité pour l'instant" sub="Les ajouts, modifications et suppressions apparaîtront ici." /> : (
        <div className="card timeline">
          {log.map((l, i) => <div key={i} className="tl"><i /><span>{l.text}</span><span className="mut xs">{new Date(l.at).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" })}</span></div>)}
        </div>
      )}
    </>
  );
}
`;
