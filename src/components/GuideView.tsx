"use client";

import { CopyButton, Meter } from "@/components/ui";
import { buildGuide } from "@/lib/guide";
import type { Config, Pricing } from "@/lib/types";

/** Guide de mise en production. Avec `checks`, les étapes sont cochables et l'avancement s'affiche. */
export function GuideView({ cfg, pricing, checks, onToggle }: { cfg: Config; pricing: Pricing | null; checks?: Record<string, boolean>; onToggle?: (id: string) => void }) {
  const steps = buildGuide(cfg, pricing);
  const done = checks ? steps.filter((s) => checks[s.id]).length : 0;

  return (
    <div className="stack" style={{ gap: 18 }}>
      {checks && (
        <div className="panel">
          <div className="row between"><b>{done} / {steps.length} étapes faites</b><span className="mut small">De ton prototype à un SaaS qui encaisse</span></div>
          <div style={{ marginTop: 10 }}><Meter value={(done / steps.length) * 100} label="Avancement de la mise en production" /></div>
        </div>
      )}
      <ol className="gd">
        {steps.map((s, i) => {
          const ok = !!checks?.[s.id];
          return (
            <li key={s.id} className={`gd-step ${ok ? "done" : ""}`}>
              <span className="gd-n">{ok ? "✓" : i + 1}</span>
              <details className="panel gd-card" open={!checks ? i < 2 : !ok && i === steps.findIndex((x) => !checks[x.id])}>
                <summary>
                  <span style={{ flex: 1 }}>
                    <b style={{ fontSize: 17 }}>{s.titre}</b>
                    <span className="tiny mut" style={{ display: "block" }}>{s.duree} · {s.pourquoi}</span>
                  </span>
                </summary>
                <div className="stack" style={{ gap: 14, marginTop: 14 }}>
                  <ol className="gd-actions">{s.actions.map((a) => <li key={a}>{a}</li>)}</ol>
                  {s.code?.map((c) => (
                    <div key={c.label} className="gd-code">
                      <div className="row between"><span className="tiny" style={{ fontWeight: 700 }}>{c.label}</span><CopyButton text={c.content} /></div>
                      <pre>{c.content}</pre>
                    </div>
                  ))}
                  {s.liens && <div className="row" style={{ gap: 8 }}>{s.liens.map((l) => <a key={l.url} className="btn btn-ghost btn-sm" href={l.url} target="_blank" rel="noreferrer">{l.label} ↗</a>)}</div>}
                  {s.attention && <div className="alert alert-warn">{s.attention}</div>}
                  {onToggle && <label className="row" style={{ gap: 10, cursor: "pointer", fontWeight: 600 }}><input type="checkbox" className="check" checked={ok} onChange={() => onToggle(s.id)} /> J&apos;ai terminé cette étape</label>}
                </div>
              </details>
            </li>
          );
        })}
      </ol>
      <style>{`
        .gd{list-style:none;padding:0;margin:0;display:grid;gap:14px}
        .gd-step{display:grid;grid-template-columns:44px minmax(0,1fr);gap:14px;position:relative}
        .gd-step:not(:last-child)::before{content:"";position:absolute;left:21px;top:46px;bottom:-14px;width:2px;background:var(--line)}
        .gd-step.done::before{background:var(--ok)}
        .gd-n{width:44px;height:44px;border-radius:14px;display:grid;place-items:center;background:var(--paper);border:1.5px solid var(--line-2);font:600 17px var(--display);z-index:1}
        .done .gd-n{background:var(--ok);border-color:var(--ok);color:#fff}
        .gd-card{padding:16px 18px}
        .gd-card summary{list-style:none;cursor:pointer;display:flex;gap:12px}
        .gd-card summary::-webkit-details-marker{display:none}
        .gd-actions{margin:0;padding-left:20px;display:grid;gap:8px}
        .gd-code{border-radius:12px;background:var(--navy);color:#e2e8f0;padding:12px 14px}
        .gd-code .btn-ghost{--fg:#fff;border-color:rgba(255,255,255,.25)}
        .gd-code pre{margin:10px 0 0;overflow-x:auto;font:12.5px/1.6 ui-monospace,Consolas,monospace;white-space:pre}
        @media(max-width:600px){.gd-step{grid-template-columns:minmax(0,1fr)}.gd-step::before{display:none}}
      `}</style>
    </div>
  );
}
