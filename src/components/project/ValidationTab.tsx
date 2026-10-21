"use client";

import Link from "next/link";
import { useMemo } from "react";
import type { TabId } from "@/components/project/tabs";
import { Meter, Ring, toast } from "@/components/ui";
import { updateProject } from "@/lib/store";
import type { Project } from "@/lib/types";
import { buildReport, isAnswered, QUESTIONS } from "@/lib/validation";

export function ValidationTab({ project: p, go }: { project: Project; go: (t: TabId) => void }) {
  const a = p.validation;
  const report = useMemo(() => buildReport(a), [a]);
  const answer = (id: string, v: string) => {
    const wasComplete = report.complet;
    updateProject(p.id, (x) => ({ ...x, validation: { ...x.validation, [id]: v } }), "Validation : réponses mises à jour");
    if (!wasComplete && buildReport({ ...a, [id]: v }).complet) toast("Questionnaire complété : ton rapport est prêt");
  };
  const toggleCheck = (id: string) => answer(`check.${id}`, a[`check.${id}`] ? "" : "1");
  const checksDone = report.checklist.filter((c) => a[`check.${c.id}`]).length;

  const firstMissing = QUESTIONS.find((q) => !isAnswered(a, q.id));
  const nextAction: Record<string, React.ReactNode> = {
    completer: firstMissing ? <button className="btn btn-coral" onClick={() => document.getElementById(`q-${firstMissing.id}`)?.scrollIntoView({ behavior: "smooth", block: "center" })}>Aller à la question suivante</button> : null,
    entretiens: <button className="btn btn-coral" onClick={() => go("feuille")}>Voir les tâches d&apos;entretien</button>,
    modele: <button className="btn btn-coral" onClick={() => go("prix")}>Ouvrir le labo des prix</button>,
    canal: <button className="btn btn-coral" onClick={() => go("lancement")}>Préparer le plan de lancement</button>,
    landing: <button className="btn btn-coral" onClick={() => go("landing")}>Préparer la landing</button>,
    constructeur: <Link className="btn btn-coral" href={`/projets/${p.id}/constructeur`}>Ouvrir le constructeur</Link>,
  };

  return (
    <div className="val">
      <div className="stack" style={{ gap: 14 }}>
        <div className="alert alert-info">Évaluation structurée à partir de <b>tes</b> réponses, avec des règles fixes. Aucune analyse de marché n&apos;est réalisée en direct.</div>
        <div className="row between"><span className="label">{report.repondu} / {QUESTIONS.length} réponses</span></div>
        <Meter value={(report.repondu / QUESTIONS.length) * 100} label="Questionnaire rempli" />
        {QUESTIONS.map((q, i) => (
          <fieldset key={q.id} id={`q-${q.id}`} className={`panel val-q ${isAnswered(a, q.id) ? "ok" : ""}`}>
            <legend className="sr-only">{q.label}</legend>
            <div className="row" style={{ flexWrap: "nowrap", alignItems: "flex-start" }}>
              <span className="val-n">{isAnswered(a, q.id) ? "✓" : i + 1}</span>
              <div style={{ flex: 1 }}>
                <p style={{ fontWeight: 600 }}>{q.label}</p>
                <p className="hint">{q.aide}</p>
                {q.type === "texte" ? (
                  <textarea className="input" style={{ marginTop: 10, minHeight: 70 }} value={a[q.id] ?? ""} placeholder={q.placeholder} onChange={(e) => answer(q.id, e.target.value)} aria-label={q.label} />
                ) : (
                  <div className="val-opts" role="radiogroup" aria-label={q.label}>
                    {q.options.map((o) => (
                      <button key={o.v} role="radio" aria-checked={a[q.id] === o.v} className="val-opt" onClick={() => answer(q.id, o.v)}>{o.label}</button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </fieldset>
        ))}
      </div>

      <aside className="stack val-report" style={{ gap: 14 }} aria-live="polite">
        <div className="panel row" style={{ flexWrap: "nowrap", gap: 18 }}>
          <Ring value={report.solidite} label="Solidité des réponses" />
          <div>
            <span className="eyebrow">Rapport</span>
            <p style={{ fontWeight: 600, marginTop: 6 }}>Solidité des réponses</p>
            <p className="tiny mut">Mesure ce que tes réponses démontrent déjà, pas le potentiel du marché.</p>
          </div>
        </div>
        {!report.complet && <div className="alert alert-warn">Réponds à toutes les questions pour un rapport complet.</div>}
        <div className="panel val-reco">
          <span className="eyebrow">Prochaine étape recommandée</span>
          <h3 style={{ fontSize: 22, margin: "8px 0 6px" }}>{report.recommandation.titre}</h3>
          <p className="mut small" style={{ marginBottom: 14 }}>{report.recommandation.texte}</p>
          {nextAction[report.recommandation.action]}
        </div>
        <Block title="Points forts" items={report.forces} cls="ok" empty="Aucun point fort démontré pour l'instant." />
        <Block title="Hypothèses à vérifier" items={report.hypotheses} cls="blue" empty="Rien de particulier." />
        <Block title="Risques" items={report.risques} cls="bad" empty="Aucun risque majeur signalé par tes réponses." />
        <Block title="Expériences à réaliser" items={report.experiences} cls="" />
        <div className="panel">
          <div className="row between"><h3 style={{ fontSize: 18 }}>Checklist de validation</h3><b className="small">{checksDone}/{report.checklist.length}</b></div>
          <div className="stack" style={{ gap: 6, marginTop: 12 }}>
            {report.checklist.map((c) => (
              <label key={c.id} className="row small" style={{ flexWrap: "nowrap", gap: 10, cursor: "pointer" }}>
                <input type="checkbox" className="check" checked={!!a[`check.${c.id}`]} onChange={() => toggleCheck(c.id)} />
                <span style={{ textDecoration: a[`check.${c.id}`] ? "line-through" : undefined, color: a[`check.${c.id}`] ? "var(--mut)" : undefined }}>{c.label}</span>
              </label>
            ))}
          </div>
        </div>
      </aside>

      <style>{`
        .val{display:grid;grid-template-columns:1fr 400px;gap:24px;align-items:start}
        .val-report{position:sticky;top:84px}
        .val-q{margin:0;border:1px solid var(--line);transition:border-color .2s}
        .val-q.ok{border-color:rgba(19,138,90,.35)}
        .val-n{width:30px;height:30px;border-radius:10px;display:grid;place-items:center;background:var(--cream-2);font-weight:700;font-size:13px;flex-shrink:0;transition:all .3s var(--ease)}
        .val-q.ok .val-n{background:var(--ok);color:#fff}
        .val-opts{display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:8px;margin-top:12px}
        .val-opt{text-align:left;padding:11px 13px;border-radius:12px;border:1.5px solid var(--line-2);background:#fff;font-size:14px;font-weight:500;cursor:pointer;transition:all .18s var(--ease)}
        .val-opt:hover{border-color:var(--ink-2)}
        .val-opt[aria-checked="true"]{background:var(--navy);border-color:var(--navy);color:#fff;transform:scale(1.01)}
        .val-reco{background:var(--navy);color:#fff;border:0}
        .val-reco .mut{color:rgba(255,255,255,.7)}
        @media(max-width:1000px){.val{grid-template-columns:1fr}.val-report{position:static}}
      `}</style>
    </div>
  );
}

function Block({ title, items, cls, empty }: { title: string; items: string[]; cls: string; empty?: string }) {
  return (
    <div className="panel">
      <h3 style={{ fontSize: 18, marginBottom: 10 }}>{title}</h3>
      {items.length ? <ul className={`list ${cls}`}>{items.map((x) => <li key={x} className="small">{x}</li>)}</ul> : <p className="mut small">{empty}</p>}
    </div>
  );
}
