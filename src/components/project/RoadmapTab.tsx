"use client";

import Link from "next/link";
import { useState } from "react";
import { Meter, toast } from "@/components/ui";
import { can } from "@/lib/plans";
import { roadmapFor, type RoadmapStep } from "@/lib/plan-builder";
import { updateProject, useData } from "@/lib/store";
import type { Project, TaskStatus } from "@/lib/types";

const STATUS: { v: TaskStatus; label: string }[] = [
  { v: "a-faire", label: "À faire" },
  { v: "en-cours", label: "En cours" },
  { v: "termine", label: "Terminé" },
];

export function RoadmapTab({ project: p }: { project: Project }) {
  const { plan } = useData();
  const detaille = can(plan, "plansDetailles");
  const steps = roadmapFor(p.config, detaille);
  const [filter, setFilter] = useState<"tout" | "restant">("tout");
  const all = steps.flatMap((s) => s.tasks);
  const done = all.filter((t) => p.roadmap[t.id]?.status === "termine").length;
  const state = (id: string) => p.roadmap[id] ?? { status: "a-faire" as TaskStatus, notes: "", checks: [] };

  function patch(step: RoadmapStep, id: string, next: Partial<{ status: TaskStatus; notes: string; checks: boolean[] }>, label?: string) {
    updateProject(p.id, (x) => ({ ...x, roadmap: { ...x.roadmap, [id]: { ...state(id), ...next } } }), label);
    if (next.status === "termine") {
      const rest = step.tasks.filter((t) => t.id !== id && p.roadmap[t.id]?.status !== "termine");
      toast(rest.length ? "Tâche terminée" : `Étape « ${step.titre} » terminée 🎉`);
    }
  }

  return (
    <div className="stack" style={{ gap: 20 }}>
      <div className="panel row between">
        <div style={{ flex: 1, minWidth: 240 }}>
          <div className="row between"><b>{done} / {all.length} tâches terminées</b><span className="mut small">{all.length ? Math.round((done / all.length) * 100) : 0}%</span></div>
          <div style={{ marginTop: 10 }}><Meter value={all.length ? (done / all.length) * 100 : 0} label="Avancement" /></div>
        </div>
        <div className="seg" role="group" aria-label="Filtre">
          <button aria-pressed={filter === "tout"} onClick={() => setFilter("tout")}>Toutes</button>
          <button aria-pressed={filter === "restant"} onClick={() => setFilter("restant")}>Restantes</button>
        </div>
      </div>
      {!detaille && <div className="alert alert-info">Les tâches propres à chaque brique (sécurité des comptes, cycle d&apos;abonnement…) sont incluses dans la feuille de route détaillée. <Link href="/parametres" style={{ textDecoration: "underline" }}>Voir les offres</Link></div>}

      <ol className="rm">
        {steps.map((s, si) => {
          const tasks = filter === "restant" ? s.tasks.filter((t) => state(t.id).status !== "termine") : s.tasks;
          const stepDone = s.tasks.every((t) => state(t.id).status === "termine");
          if (!tasks.length && filter === "restant") return null;
          return (
            <li key={s.id} className={`rm-step ${stepDone ? "done" : ""}`}>
              <div className="rm-head">
                <span className="rm-n">{stepDone ? "✓" : si + 1}</span>
                <h2 style={{ fontSize: 20 }}>{s.titre}</h2>
                <span className="tiny mut">{s.tasks.filter((t) => state(t.id).status === "termine").length}/{s.tasks.length}</span>
              </div>
              <div className="stack" style={{ gap: 10 }}>
                {tasks.map((t) => {
                  const st = state(t.id);
                  return (
                    <details key={t.id} className={`panel rm-task st-${st.status}`}>
                      <summary>
                        <span className="rm-dot" aria-hidden="true" />
                        <span style={{ flex: 1 }}>
                          <b>{t.titre}</b>
                          {t.origine !== "base" && <span className={`badge ${t.origine === "modele" ? "badge-coral" : ""}`} style={{ marginLeft: 8 }}>{t.origine === "modele" ? "Propre au modèle" : "Brique"}</span>}
                          <span className="tiny mut" style={{ display: "block" }}>{STATUS.find((x) => x.v === st.status)!.label} · {t.duree} (indicatif)</span>
                        </span>
                      </summary>
                      <div className="stack fade" style={{ gap: 14, marginTop: 14 }}>
                        <p className="mut">{t.description}</p>
                        <div className="seg" role="group" aria-label="Statut">
                          {STATUS.map((x) => <button key={x.v} aria-pressed={st.status === x.v} onClick={() => patch(s, t.id, { status: x.v }, `Feuille de route : « ${t.titre} » ${x.label.toLowerCase()}`)}>{x.label}</button>)}
                        </div>
                        <div className="stack" style={{ gap: 6 }}>
                          <span className="label">Checklist</span>
                          {t.checklist.map((c, ci) => (
                            <label key={c} className="row small" style={{ flexWrap: "nowrap", gap: 10, cursor: "pointer" }}>
                              <input type="checkbox" className="check" checked={!!st.checks[ci]} onChange={() => {
                                const checks = t.checklist.map((_, k) => (k === ci ? !st.checks[k] : !!st.checks[k]));
                                const status: TaskStatus = checks.every(Boolean) ? "termine" : checks.some(Boolean) ? "en-cours" : st.status === "termine" ? "en-cours" : st.status;
                                patch(s, t.id, status !== st.status ? { checks, status } : { checks }, "Feuille de route : checklist mise à jour");
                              }} />
                              <span>{c}</span>
                            </label>
                          ))}
                        </div>
                        {t.ressources.length > 0 && (
                          <div className="tile small"><span className="label">Ressources</span><ul className="list" style={{ marginTop: 6 }}>{t.ressources.map((r) => <li key={r}>{r}</li>)}</ul></div>
                        )}
                        <div className="field">
                          <label htmlFor={`n-${t.id}`}>Notes</label>
                          <textarea id={`n-${t.id}`} className="input" value={st.notes} maxLength={2000} onChange={(e) => patch(s, t.id, { notes: e.target.value }, "Feuille de route : note ajoutée")} placeholder="Tes notes, liens, contacts…" />
                        </div>
                      </div>
                    </details>
                  );
                })}
              </div>
            </li>
          );
        })}
      </ol>

      <style>{`
        .rm{list-style:none;padding:0;margin:0;display:grid;gap:28px}
        .rm-step{display:grid;grid-template-columns:44px 1fr;column-gap:16px;position:relative}
        .rm-step:not(:last-child)::before{content:"";position:absolute;left:21px;top:46px;bottom:-24px;width:2px;background:var(--line)}
        .rm-step.done::before{background:var(--ok)}
        .rm-head{grid-column:1/3;display:grid;grid-template-columns:44px 1fr auto;gap:16px;align-items:center;margin-bottom:12px}
        .rm-step .stack{grid-column:2}
        .rm-n{width:44px;height:44px;border-radius:14px;display:grid;place-items:center;background:var(--paper);border:1.5px solid var(--line-2);font:600 17px var(--display);position:relative;z-index:1}
        .rm-step.done .rm-n{background:var(--ok);border-color:var(--ok);color:#fff}
        .rm-task{padding:14px 16px}
        .rm-task summary{list-style:none;display:flex;gap:12px;align-items:flex-start;cursor:pointer}
        .rm-task summary::-webkit-details-marker{display:none}
        .rm-dot{width:14px;height:14px;border-radius:50%;border:2px solid var(--line-2);margin-top:4px;flex-shrink:0;transition:all .25s}
        .st-en-cours .rm-dot{border-color:var(--blue);background:radial-gradient(var(--blue) 40%,transparent 45%)}
        .st-termine .rm-dot{border-color:var(--ok);background:var(--ok)}
        .st-termine summary b{text-decoration:line-through;color:var(--mut)}
        @media(max-width:600px){.rm-step{grid-template-columns:1fr}.rm-step::before{display:none}.rm-head{grid-template-columns:44px 1fr auto}.rm-step .stack{grid-column:1}}
      `}</style>
    </div>
  );
}
