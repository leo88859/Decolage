"use client";

import { useState } from "react";
import { toast } from "@/components/ui";
import { REVENUE_LABEL } from "@/lib/modules";
import { averagePaid, breakEven, defaultPricing, offerId, scenario } from "@/lib/pricing";
import { updateProject } from "@/lib/store";
import type { Offer, Pricing, Project, Revenue } from "@/lib/types";

const eur = (n: number) => n.toLocaleString("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: n % 1 ? 2 : 0 });
const SCENARIOS = [10, 50, 100, 500];

export function PricingTab({ project: p }: { project: Project }) {
  const pr = p.pricing;
  const [hover, setHover] = useState<number | null>(null);
  const save = (next: Pricing, label = "Prix : offres modifiées") => updateProject(p.id, (x) => ({ ...x, pricing: next }), label);
  const setOffer = (id: string, patch: Partial<Offer>) => save({ ...pr, offres: pr.offres.map((o) => (o.id === id ? { ...o, ...patch } : o)) });
  const setCalc = (k: keyof Pricing["calc"], v: number) => save({ ...pr, calc: { ...pr.calc, [k]: Number.isFinite(v) ? Math.max(0, v) : 0 } }, "Prix : scénario modifié");

  const avg = averagePaid(pr.offres);
  const s = scenario(pr.calc.clients, avg, pr.calc);
  const be = breakEven(avg, pr.calc);
  const features = [...new Set(pr.offres.flatMap((o) => o.features).map((f) => f.trim()).filter(Boolean))];
  const rows = SCENARIOS.map((n) => ({ n, ...scenario(n, avg, pr.calc) }));
  const max = Math.max(1, ...rows.map((r) => Math.abs(r.resultat)));
  const mismatch = pr.modele !== p.config.revenu;

  return (
    <div className="stack" style={{ gap: 20 }}>
      <div className="alert alert-info">Toutes les projections ci-dessous sont des <b>scénarios</b> calculés à partir de tes hypothèses, pas des prédictions.</div>

      <section className="panel stack" style={{ gap: 14 }}>
        <div className="row between">
          <h2 className="h-sec">Modèle économique</h2>
          <select className="input" style={{ width: "auto" }} value={pr.modele} onChange={(e) => save({ ...pr, modele: e.target.value as Revenue }, "Prix : modèle changé")} aria-label="Modèle économique">
            {(Object.keys(REVENUE_LABEL) as Revenue[]).map((r) => <option key={r} value={r}>{REVENUE_LABEL[r]}</option>)}
          </select>
        </div>
        {mismatch && (
          <div className="alert alert-warn row between">
            <span>Le constructeur utilise le modèle « {REVENUE_LABEL[p.config.revenu]} ».</span>
            <button className="btn btn-sm btn-ghost" onClick={() => { save({ ...defaultPricing(p.config), calc: pr.calc }, "Prix : offres réalignées"); toast("Offres réalignées sur le constructeur"); }}>Réaligner les offres</button>
          </div>
        )}
      </section>

      <section className="pr-offers">
        {pr.offres.map((o) => (
          <div key={o.id} className="panel stack" style={{ gap: 10 }}>
            <input className="input" style={{ fontWeight: 700 }} value={o.nom} maxLength={30} onChange={(e) => setOffer(o.id, { nom: e.target.value })} aria-label="Nom de l'offre" />
            <div className="row" style={{ flexWrap: "nowrap", gap: 8 }}>
              <input className="input" type="number" min={0} step="0.5" value={o.prix} onChange={(e) => setOffer(o.id, { prix: Math.max(0, Number(e.target.value) || 0) })} aria-label="Prix" />
              <select className="input" style={{ width: 130 }} value={o.periode} onChange={(e) => setOffer(o.id, { periode: e.target.value as Offer["periode"] })} aria-label="Période">
                <option value="mois">/ mois</option>
                <option value="an">/ an</option>
                <option value="unique">une fois</option>
              </select>
            </div>
            <textarea className="input" value={o.features.join("\n")} onChange={(e) => setOffer(o.id, { features: e.target.value.split("\n").map((x) => x.trimStart()).filter((x, i, a) => x || i === a.length - 1) })} aria-label="Fonctionnalités incluses, une par ligne" placeholder="Une fonctionnalité par ligne" />
            <button className="btn btn-danger btn-sm" style={{ alignSelf: "flex-start" }} disabled={pr.offres.length <= 1} onClick={() => save({ ...pr, offres: pr.offres.filter((x) => x.id !== o.id) })}>Supprimer l&apos;offre</button>
          </div>
        ))}
        {pr.offres.length < 4 && (
          <button className="ticket pr-add" onClick={() => save({ ...pr, offres: [...pr.offres, { id: offerId(), nom: "Nouvelle offre", prix: 9, periode: "mois", features: ["Fonctionnalité"] }] })}>+ Ajouter une offre</button>
        )}
      </section>

      <section className="panel">
        <h2 className="h-sec" style={{ marginBottom: 14 }}>Comparaison des offres</h2>
        <div className="scroll-x">
          <table className="table">
            <thead><tr><th>Fonctionnalité</th>{pr.offres.map((o) => <th key={o.id}>{o.nom}</th>)}</tr></thead>
            <tbody>
              <tr><td className="mut">Prix</td>{pr.offres.map((o) => <td key={o.id}><b>{o.prix === 0 ? "Gratuit" : `${eur(o.prix)} ${o.periode === "unique" ? "une fois" : `/ ${o.periode}`}`}</b></td>)}</tr>
              {features.map((f) => <tr key={f}><td>{f}</td>{pr.offres.map((o) => <td key={o.id}>{o.features.some((x) => x.trim() === f) ? <span style={{ color: "var(--ok)", fontWeight: 800 }} aria-label="inclus">✓</span> : <span className="mut" aria-label="non inclus">—</span>}</td>)}</tr>)}
            </tbody>
          </table>
        </div>
      </section>

      <section className="pr-calc">
        <div className="panel stack" style={{ gap: 12 }}>
          <h2 className="h-sec">Hypothèses</h2>
          <div className="field">
            <label htmlFor="c-clients">Clients payants : <b>{pr.calc.clients}</b></label>
            <input id="c-clients" type="range" min={0} max={1000} step={5} value={pr.calc.clients} onChange={(e) => setCalc("clients", Number(e.target.value))} />
          </div>
          <div className="kv"><span className="mut">Prix mensuel moyen (offres payantes)</span><b>{eur(Math.round(avg * 100) / 100)}</b></div>
          <Num label="Frais de paiement (% par transaction)" value={pr.calc.fraisPct} step={0.1} onChange={(v) => setCalc("fraisPct", v)} />
          <Num label="Frais fixe par transaction (€)" value={pr.calc.fraisFixe} step={0.05} onChange={(v) => setCalc("fraisFixe", v)} />
          <Num label="Hébergement et outils (€ / mois)" value={pr.calc.hebergement} step={1} onChange={(v) => setCalc("hebergement", v)} />
          <Num label="Autres frais (€ / mois)" value={pr.calc.autres} step={1} onChange={(v) => setCalc("autres", v)} />
          <p className="tiny mut">Les frais de paiement varient selon le prestataire : vérifie ses tarifs. Impôts et cotisations ne sont pas inclus.</p>
        </div>

        <div className="stack" style={{ gap: 14 }}>
          <div className="pr-result">
            <div><span className="tiny">Revenu mensuel brut estimé</span><b>{eur(s.brut)}</b><span className="tiny">{pr.calc.clients} × {eur(Math.round(avg * 100) / 100)}</span></div>
            <div><span className="tiny">Frais estimés</span><b>− {eur(s.fraisPaiement + s.fraisFixes)}</b><span className="tiny">paiement {eur(s.fraisPaiement)} · fixes {eur(s.fraisFixes)}</span></div>
            <div className={s.resultat < 0 ? "neg" : ""}><span className="tiny">Résultat estimé</span><b>{eur(s.resultat)}</b><span className="tiny">marge {s.marge} %</span></div>
          </div>
          <div className="panel">
            <div className="row between"><h3 style={{ fontSize: 18 }}>Résultat mensuel selon le nombre de clients</h3><span className="tiny mut">Scénarios</span></div>
            <p className="small mut" style={{ marginTop: 4 }}>{be === null ? "Avec ces hypothèses, chaque client coûte plus qu'il ne rapporte." : `Seuil de rentabilité : ${be} client${be > 1 ? "s" : ""} payant${be > 1 ? "s" : ""}.`}</p>
            <svg viewBox="0 0 640 220" className="pr-chart" role="img" aria-label="Résultat estimé pour 10, 50, 100 et 500 clients">
              {(() => {
                // Ligne de base au milieu seulement s'il y a des résultats négatifs.
                const neg = rows.some((r) => r.resultat < 0);
                const pos = rows.some((r) => r.resultat > 0);
                const base = neg && pos ? 105 : neg ? 30 : 180;
                const span = neg && pos ? 75 : 150;
                return (
                  <>
                    <line x1="0" x2="640" y1={base} y2={base} stroke="var(--line-2)" />
                    {rows.map((r, i) => {
                      const hgt = (Math.abs(r.resultat) / max) * span;
                      const x = 50 + i * 155;
                      const y = r.resultat >= 0 ? base - hgt : base;
                      return (
                        <g key={r.n} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)} onFocus={() => setHover(i)} onBlur={() => setHover(null)} tabIndex={0} aria-label={`${r.n} clients : ${eur(r.resultat)}`}>
                          <rect x={x - 20} y={0} width={120} height={200} fill="transparent" />
                          <rect x={x} y={y} width={80} height={Math.max(2, hgt)} rx={4} fill={r.resultat >= 0 ? "var(--blue)" : "var(--coral)"} opacity={hover === null || hover === i ? 1 : 0.45} style={{ transition: "opacity .2s" }} />
                          <text x={x + 40} y={r.resultat >= 0 ? y - 8 : y + hgt + 16} textAnchor="middle" fontSize="13" fill="var(--ink-2)" fontWeight={600}>{eur(Math.round(r.resultat))}</text>
                          <text x={x + 40} y={214} textAnchor="middle" fontSize="12.5" fill="var(--mut)">{r.n} clients</text>
                        </g>
                      );
                    })}
                  </>
                );
              })()}
            </svg>
          </div>
          <div className="panel scroll-x">
            <table className="table">
              <thead><tr><th>Clients</th><th>Brut</th><th>Frais</th><th>Résultat</th></tr></thead>
              <tbody>{rows.map((r) => <tr key={r.n}><td>{r.n}</td><td>{eur(r.brut)}</td><td>{eur(r.fraisPaiement + r.fraisFixes)}</td><td><b style={{ color: r.resultat < 0 ? "var(--bad)" : undefined }}>{eur(r.resultat)}</b></td></tr>)}</tbody>
            </table>
          </div>
        </div>
      </section>

      <style>{`
        .pr-offers{display:grid;grid-template-columns:repeat(auto-fill,minmax(250px,1fr));gap:14px}
        .pr-add{cursor:pointer;font-weight:600;color:var(--mut);min-height:200px;transition:all .2s}
        .pr-add:hover{color:var(--ink);border-color:var(--ink-2)}
        .pr-calc{display:grid;grid-template-columns:360px 1fr;gap:20px;align-items:start}
        .pr-result{display:grid;grid-template-columns:repeat(3,1fr);border-radius:var(--r);overflow:hidden;background:var(--navy);color:#fff}
        .pr-result>div{padding:18px;display:grid;gap:4px;border-right:1px solid rgba(255,255,255,.1)}
        .pr-result>div:last-child{border:0;background:var(--blue)}
        .pr-result>div.neg{background:var(--coral);color:var(--navy)}
        .pr-result b{font:600 26px var(--display);letter-spacing:-.02em}
        .pr-result .tiny{opacity:.75}
        .pr-chart{width:100%;height:auto;margin-top:12px;overflow:visible}
        .pr-chart g{cursor:default;outline:none}
        input[type=range]{accent-color:var(--blue);width:100%}
        @media(max-width:960px){.pr-calc{grid-template-columns:1fr}.pr-result{grid-template-columns:1fr}.pr-result>div{border-right:0;border-bottom:1px solid rgba(255,255,255,.1)}}
      `}</style>
    </div>
  );
}

function Num({ label, value, step, onChange }: { label: string; value: number; step: number; onChange: (v: number) => void }) {
  return (
    <div className="field">
      <label>{label}</label>
      <input className="input" type="number" min={0} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} />
    </div>
  );
}
