"use client";

import { useState } from "react";
import { toast } from "@/components/ui";
import { updateProject } from "@/lib/store";
import type { Metric, Project } from "@/lib/types";

const FIELDS = [
  { k: "visiteurs", label: "Visiteurs" },
  { k: "inscrits", label: "Inscrits" },
  { k: "actifs", label: "Utilisateurs actifs" },
  { k: "payants", label: "Clients payants" },
] as const;
type K = (typeof FIELDS)[number]["k"];
const pct = (a: number, b: number) => (b > 0 ? `${Math.round((a / b) * 100)} %` : "—");

export function MetricsTab({ project: p }: { project: Project }) {
  const today = new Date().toISOString().slice(0, 10);
  const [form, setForm] = useState<Record<K | "date", string>>({ date: today, visiteurs: "", inscrits: "", actifs: "", payants: "" });
  const [k, setK] = useState<K>("inscrits");
  const [hover, setHover] = useState<number | null>(null);
  const data = [...p.metrics].sort((a, b) => a.date.localeCompare(b.date));
  const last = data.at(-1);

  function add(e: React.FormEvent) {
    e.preventDefault();
    const m: Metric = { date: form.date, visiteurs: +form.visiteurs || 0, inscrits: +form.inscrits || 0, actifs: +form.actifs || 0, payants: +form.payants || 0 };
    updateProject(p.id, (x) => ({ ...x, metrics: [...x.metrics.filter((y) => y.date !== m.date), m] }), "Indicateurs : relevé ajouté");
    setForm({ ...form, visiteurs: "", inscrits: "", actifs: "", payants: "" });
    toast("Relevé enregistré");
  }

  // Graphique : une seule série à la fois (pas de double axe).
  const W = 640, H = 220, L = 44, R = 16, T = 16, B = 30;
  const max = Math.max(1, ...data.map((d) => d[k]));
  const x = (i: number) => L + (data.length <= 1 ? (W - L - R) / 2 : (i * (W - L - R)) / (data.length - 1));
  const y = (v: number) => T + (H - T - B) * (1 - v / max);

  return (
    <div className="stack" style={{ gap: 20 }}>
      <div className="alert alert-info">Ces chiffres viennent uniquement de tes relevés : Décollage ne collecte aucune statistique de ton produit.</div>
      <form onSubmit={add} className="panel">
        <h2 className="h-sec" style={{ marginBottom: 14 }}>Nouveau relevé</h2>
        <div className="mt-form">
          <div className="field"><label htmlFor="m-date">Date</label><input id="m-date" className="input" type="date" required value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} /></div>
          {FIELDS.map((f) => (
            <div key={f.k} className="field"><label htmlFor={`m-${f.k}`}>{f.label}</label><input id={`m-${f.k}`} className="input" type="number" min={0} value={form[f.k]} onChange={(e) => setForm({ ...form, [f.k]: e.target.value })} /></div>
          ))}
          <button className="btn" style={{ alignSelf: "end" }}>Ajouter</button>
        </div>
        <p className="hint" style={{ marginTop: 8 }}>Totaux à date. Un relevé par date : saisir la même date remplace l&apos;ancien.</p>
      </form>

      {!last ? (
        <div className="empty"><h2 className="h-sec">Aucun relevé pour l&apos;instant</h2><p className="mut" style={{ marginTop: 8 }}>Ajoute ton premier relevé, même à zéro, pour suivre ton évolution.</p></div>
      ) : (
        <>
          <div className="mt-funnel">
            {FIELDS.map((f, i) => (
              <div key={f.k} className="panel">
                <span className="mut small">{f.label}</span>
                <div style={{ font: "600 34px var(--display)" }}>{last[f.k]}</div>
                {i > 0 && <span className="tiny mut">{pct(last[f.k], last[FIELDS[i - 1]!.k])} de « {FIELDS[i - 1]!.label.toLowerCase()} »</span>}
              </div>
            ))}
          </div>
          <div className="panel">
            <div className="row between" style={{ marginBottom: 10 }}>
              <h3 style={{ fontSize: 18 }}>{FIELDS.find((f) => f.k === k)!.label}</h3>
              <div className="seg" role="group" aria-label="Indicateur affiché">
                {FIELDS.map((f) => <button key={f.k} aria-pressed={k === f.k} onClick={() => setK(f.k)}>{f.label}</button>)}
              </div>
            </div>
            <div style={{ position: "relative" }}>
              <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: "auto" }} role="img" aria-label={`Évolution : ${FIELDS.find((f) => f.k === k)!.label}`} onMouseLeave={() => setHover(null)}>
                {[0, 0.5, 1].map((t) => (
                  <g key={t}>
                    <line x1={L} x2={W - R} y1={y(max * t)} y2={y(max * t)} stroke="var(--line)" />
                    <text x={L - 8} y={y(max * t) + 4} textAnchor="end" fontSize="11" fill="var(--mut)">{Math.round(max * t)}</text>
                  </g>
                ))}
                {data.map((d, i) => (i === 0 || i === data.length - 1 || data.length <= 6) && <text key={d.date} x={x(i)} y={H - 8} textAnchor="middle" fontSize="11" fill="var(--mut)">{d.date.slice(5).split("-").reverse().join("/")}</text>)}
                {hover !== null && <line x1={x(hover)} x2={x(hover)} y1={T} y2={H - B} stroke="var(--line-2)" />}
                <path d={data.map((d, i) => `${i ? "L" : "M"}${x(i)},${y(d[k])}`).join(" ")} fill="none" stroke="var(--blue)" strokeWidth={2} strokeLinejoin="round" />
                {data.map((d, i) => (
                  <g key={d.date}>
                    <circle cx={x(i)} cy={y(d[k])} r={hover === i ? 6 : 4.5} fill="var(--blue)" stroke="var(--paper)" strokeWidth={2} />
                    <rect x={x(i) - 22} y={T} width={44} height={H - T - B} fill="transparent" onMouseEnter={() => setHover(i)} />
                  </g>
                ))}
              </svg>
              {hover !== null && data[hover] && (
                <div className="panel" style={{ position: "absolute", top: 0, left: `${(x(hover) / W) * 100}%`, transform: "translateX(-50%)", padding: "6px 10px", fontSize: 13, pointerEvents: "none", whiteSpace: "nowrap" }}>
                  <span className="mut">{data[hover].date}</span> · <b>{data[hover][k]}</b>
                </div>
              )}
            </div>
          </div>
          <div className="panel scroll-x">
            <table className="table">
              <thead><tr><th>Date</th>{FIELDS.map((f) => <th key={f.k}>{f.label}</th>)}<th>Inscription</th><th>Activation</th><th /></tr></thead>
              <tbody>
                {[...data].reverse().map((d) => (
                  <tr key={d.date}>
                    <td>{d.date}</td>{FIELDS.map((f) => <td key={f.k}>{d[f.k]}</td>)}
                    <td>{pct(d.inscrits, d.visiteurs)}</td><td>{pct(d.actifs, d.inscrits)}</td>
                    <td><button className="btn btn-danger btn-sm" onClick={() => updateProject(p.id, (x) => ({ ...x, metrics: x.metrics.filter((m) => m.date !== d.date) }), "Indicateurs : relevé supprimé")} aria-label={`Supprimer le relevé du ${d.date}`}>✕</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
      <style>{`
        .mt-form{display:grid;grid-template-columns:160px repeat(4,1fr) auto;gap:10px}
        .mt-funnel{display:grid;grid-template-columns:repeat(4,1fr);gap:12px}
        @media(max-width:900px){.mt-form{grid-template-columns:1fr 1fr}.mt-funnel{grid-template-columns:1fr 1fr}}
      `}</style>
    </div>
  );
}
