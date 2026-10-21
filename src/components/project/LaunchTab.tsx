"use client";

import { Meter, toast } from "@/components/ui";
import { TEMPLATE_BY_ID } from "@/data/templates";
import { addDays, launchActionsFor } from "@/lib/plan-builder";
import { updateProject } from "@/lib/store";
import type { LaunchItem, Project, TaskStatus } from "@/lib/types";

const PRIO = { haute: "Haute", moyenne: "Moyenne", basse: "Basse" } as const;
const STATUS: Record<TaskStatus, string> = { "a-faire": "À faire", "en-cours": "En cours", termine: "Terminé" };
const fmt = (iso: string) => (iso ? new Date(`${iso}T12:00`).toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "short" }) : "—");

export function LaunchTab({ project: p }: { project: Project }) {
  const actions = launchActionsFor(p.config);
  const t = TEMPLATE_BY_ID[p.config.templateId];
  const start = p.launch.date ? addDays(p.launch.date, -28) : "";
  const item = (id: string, semaine: number, priorite: LaunchItem["priorite"]): LaunchItem =>
    p.launch.items[id] ?? { date: start ? addDays(start, (semaine - 1) * 7) : "", priorite, status: "a-faire", notes: "" };
  const done = actions.filter((a) => item(a.id, a.semaine, a.priorite).status === "termine").length;

  function patch(id: string, base: LaunchItem, next: Partial<LaunchItem>, label: string) {
    updateProject(p.id, (x) => ({ ...x, launch: { ...x.launch, items: { ...x.launch.items, [id]: { ...base, ...next } } } }), label);
    if (next.status === "termine") toast("Action terminée");
  }

  function setDate(date: string) {
    // Les dates des actions non modifiées suivent la nouvelle date de lancement.
    updateProject(p.id, (x) => ({ ...x, launch: { date, items: Object.fromEntries(Object.entries(x.launch.items).map(([k, v]) => [k, { ...v, date: "" }])) } }), "Lancement : date choisie");
    toast("Calendrier recalculé");
  }

  const weeks = [1, 2, 3, 4];
  return (
    <div className="stack" style={{ gap: 20 }}>
      <section className="panel row between">
        <div>
          <h2 className="h-sec">Date de lancement prévue</h2>
          <p className="mut small" style={{ marginTop: 4 }}>{actions.length} actions sélectionnées pour un projet « {t.nom} » ({t.tagsLancement.join(", ")}).</p>
        </div>
        <input className="input" type="date" style={{ width: "auto" }} value={p.launch.date} onChange={(e) => setDate(e.target.value)} aria-label="Date de lancement" />
      </section>
      <div className="panel">
        <div className="row between"><b>{done} / {actions.length} actions terminées</b><span className="mut small">{p.launch.date ? `Début du plan : ${fmt(start)}` : "Choisis une date pour dater les actions"}</span></div>
        <div style={{ marginTop: 10 }}><Meter value={actions.length ? (done / actions.length) * 100 : 0} coral label="Avancement du lancement" /></div>
      </div>

      {weeks.map((w) => {
        const list = actions.filter((a) => a.semaine === w);
        return (
          <section key={w} className="lc-week">
            <div className="lc-week-head">
              <span className="lc-w">S{w}</span>
              <div>
                <h3 style={{ fontSize: 18 }}>Semaine {w}{w === 4 ? " · lancement" : ""}</h3>
                {start && <span className="tiny mut">{fmt(addDays(start, (w - 1) * 7))} → {fmt(addDays(start, w * 7 - 1))}</span>}
              </div>
            </div>
            <div className="stack" style={{ gap: 8 }}>
              {list.map((a) => {
                const it = item(a.id, a.semaine, a.priorite);
                return (
                  <div key={a.id} className={`panel lc-item ${it.status === "termine" ? "done" : ""}`}>
                    <div className="row" style={{ flexWrap: "nowrap", alignItems: "flex-start" }}>
                      <input type="checkbox" className="check" style={{ marginTop: 3 }} checked={it.status === "termine"} onChange={() => patch(a.id, it, { status: it.status === "termine" ? "a-faire" : "termine" }, `Lancement : « ${a.titre} »`)} aria-label={`Terminer : ${a.titre}`} />
                      <div style={{ flex: 1 }}>
                        <div className="row between">
                          <b className="lc-title">{a.titre}</b>
                          <span className={`badge ${it.priorite === "haute" ? "badge-coral" : it.priorite === "moyenne" ? "" : "badge-line"}`}>{PRIO[it.priorite]}</span>
                        </div>
                        <p className="small mut">{a.description}</p>
                        <div className="lc-controls">
                          <input className="input" type="date" value={it.date} onChange={(e) => patch(a.id, it, { date: e.target.value }, "Lancement : date d'action modifiée")} aria-label="Date" />
                          <select className="input" value={it.priorite} onChange={(e) => patch(a.id, it, { priorite: e.target.value as LaunchItem["priorite"] }, "Lancement : priorité modifiée")} aria-label="Priorité">
                            {Object.entries(PRIO).map(([k, v]) => <option key={k} value={k}>Priorité {v.toLowerCase()}</option>)}
                          </select>
                          <select className="input" value={it.status} onChange={(e) => patch(a.id, it, { status: e.target.value as TaskStatus }, "Lancement : statut modifié")} aria-label="Statut">
                            {Object.entries(STATUS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                          </select>
                        </div>
                        <textarea className="input" style={{ minHeight: 44, marginTop: 8 }} value={it.notes} maxLength={1000} placeholder="Notes" onChange={(e) => patch(a.id, it, { notes: e.target.value }, "Lancement : note ajoutée")} aria-label="Notes" />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        );
      })}

      <style>{`
        .lc-week{display:grid;grid-template-columns:200px 1fr;gap:20px;align-items:start}
        .lc-week-head{display:flex;gap:12px;align-items:center;position:sticky;top:84px}
        .lc-w{width:46px;height:46px;border-radius:14px;background:var(--navy);color:#fff;display:grid;place-items:center;font:600 16px var(--display)}
        .lc-week:last-of-type .lc-w{background:var(--coral);color:var(--navy)}
        .lc-item{padding:14px 16px;transition:opacity .2s}
        .lc-item.done{opacity:.6}
        .lc-item.done .lc-title{text-decoration:line-through}
        .lc-controls{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-top:10px}
        .lc-controls .input{padding:8px 10px;font-size:14px}
        @media(max-width:860px){.lc-week{grid-template-columns:1fr}.lc-week-head{position:static}.lc-controls{grid-template-columns:1fr}}
      `}</style>
    </div>
  );
}
