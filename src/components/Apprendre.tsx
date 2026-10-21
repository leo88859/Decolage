"use client";

import Link from "next/link";
import { useState } from "react";
import { allKeys, checkKey, PARCOURS, type Parcours } from "@/data/parcours";
import { setParcours, useData, useHydrated } from "@/lib/store";

/**
 * Parcours « Apprendre » : conseils et checklists. La progression est enregistrée dans ce navigateur,
 * ou dans un projet choisi (elle suit alors le projet, y compris sur un compte en ligne).
 */
export function Apprendre() {
  const { projects, parcours = {} } = useData();
  const hydrated = useHydrated();
  const [pid, setPid] = useState("");
  const project = projects.find((p) => p.id === pid);
  const store: Record<string, boolean> = project ? project.guide ?? {} : parcours;
  const done = (k: string) => !!store[k];
  const pct = (p: Parcours) => { const ks = allKeys(p); return ks.length ? Math.round((ks.filter(done).length / ks.length) * 100) : 0; };

  return (
    <div className="ap">
      <div className="ap-bar">
        <label className="row" style={{ gap: 10 }}>
          <span className="small" style={{ fontWeight: 600 }}>Ma progression est enregistrée pour</span>
          <select className="input" style={{ width: "auto", padding: "8px 34px 8px 12px" }} value={pid} onChange={(e) => setPid(e.target.value)} disabled={!hydrated}>
            <option value="">Ce navigateur</option>
            {projects.map((p) => <option key={p.id} value={p.id}>Le projet « {p.config.nom} »</option>)}
          </select>
        </label>
        <div className="ap-overview" aria-label="Progression des parcours">
          {PARCOURS.map((p) => <a key={p.id} href={`#${p.id}`} style={{ "--c": p.couleur, "--v": hydrated ? pct(p) : 0 } as React.CSSProperties} title={`${p.titre} : ${hydrated ? pct(p) : 0} %`}><i /><span>{p.titre}</span><b>{hydrated ? pct(p) : 0} %</b></a>)}
        </div>
      </div>

      {PARCOURS.map((p, n) => (
        <section key={p.id} id={p.id} className="ap-track" style={{ "--c": p.couleur } as React.CSSProperties}>
          <header className="ap-head">
            <span className="ap-n">{String(n + 1).padStart(2, "0")}</span>
            <div>
              <h2>{p.titre}</h2>
              <p className="mut">{p.accroche} · <span className="tiny">{p.duree}</span></p>
            </div>
            <div className="ap-ring" style={{ "--v": hydrated ? pct(p) : 0 } as React.CSSProperties} role="img" aria-label={`${p.titre} : ${hydrated ? pct(p) : 0} % fait`}><span>{hydrated ? pct(p) : 0}%</span></div>
          </header>
          <ol className="ap-steps">
            {p.etapes.map((e, i) => {
              const keys = e.checks.map(([c]) => checkKey(p.id, e.id, c));
              const all = keys.every(done);
              return (
                <li key={e.id} className={all ? "done" : ""}>
                  <details open={i === 0 && !all}>
                    <summary>
                      <span className="ap-dot">{all ? "✓" : i + 1}</span>
                      <span><b>{e.titre}</b><span className="tiny mut">{e.pourquoi}</span></span>
                      <span className="tiny mut ap-count">{keys.filter(done).length}/{keys.length}</span>
                    </summary>
                    <div className="ap-body">
                      <ul className="list">{e.conseils.map((c) => <li key={c}>{c}</li>)}</ul>
                      <div className="ap-checks">
                        {e.checks.map(([c, label]) => {
                          const k = checkKey(p.id, e.id, c);
                          return (
                            <label key={c} className={done(k) ? "on" : ""}>
                              <input type="checkbox" className="check" checked={done(k)} disabled={!hydrated} onChange={(ev) => setParcours(k, ev.target.checked, project?.id)} />
                              <span>{label}</span>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  </details>
                </li>
              );
            })}
          </ol>
          {p.outil && (
            <p className="small ap-tool">
              Outil associé : {project ? <Link href={`/projets/${project.id}?onglet=${p.outil.onglet}`} style={{ textDecoration: "underline", fontWeight: 600 }}>{p.outil.label} →</Link> : <><b>{p.outil.label}</b> (choisis un projet en haut de page pour l&apos;ouvrir directement)</>}
            </p>
          )}
        </section>
      ))}
    </div>
  );
}
