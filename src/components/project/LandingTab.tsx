"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Confirm, CopyButton, download, toast } from "@/components/ui";
import { slug } from "@/lib/export";
import { buildLanding, LAYOUTS, landingCss, landingText, moveSection, renderLanding, SECTION_LABEL } from "@/lib/landing";
import { can } from "@/lib/plans";
import { contenuOf } from "@/lib/project";
import { updateProject, useData } from "@/lib/store";
import type { Landing, LandingLayout, LandingSection, Project } from "@/lib/types";

export function LandingTab({ project: p }: { project: Project }) {
  const { plan } = useData();
  const [device, setDevice] = useState<"desktop" | "mobile">("desktop");
  const [open, setOpen] = useState<string | null>("hero");
  const [confirm, setConfirm] = useState(false);
  const l = p.landing;
  const advanced = can(plan, "personnalisationAvancee");
  const pricing = p.pricing.offres.length ? p.pricing : null;
  const contenu = contenuOf(p);
  const html = useMemo(() => renderLanding(p.config, l, pricing, { inlineCss: true, contenu }), [p.config, l, pricing, contenu]);

  const save = (next: Landing, label = "Landing : modifiée") => updateProject(p.id, (x) => ({ ...x, landing: { ...next, edited: true } }), label);
  const setSection = (id: string, patch: Partial<LandingSection>) => save({ ...l, sections: l.sections.map((s) => (s.id === id ? { ...s, ...patch } : s)) });

  function exportFiles() {
    if (!can(plan, "exportFichiers")) return;
    download("index.html", renderLanding(p.config, l, pricing, { inlineCss: false, contenu }), "text/html");
    setTimeout(() => download("style.css", landingCss(p.config, l), "text/css"), 300);
    updateProject(p.id, (x) => x, "Landing : exportée");
    toast("index.html et style.css téléchargés");
  }

  return (
    <div className="lt">
      <div className="stack" style={{ gap: 14 }}>
        <div className="panel stack" style={{ gap: 12 }}>
          <span className="label">Mise en page</span>
          <div className="lt-layouts">
            {(Object.keys(LAYOUTS) as LandingLayout[]).map((k) => {
              const locked = k !== "centre" && !advanced;
              return (
                <button key={k} className={`lt-layout lay-${k}`} aria-pressed={l.layout === k} disabled={locked} onClick={() => save({ ...l, layout: k }, "Landing : mise en page changée")}>
                  <span className="lt-thumb" aria-hidden="true"><i /><i /><i /></span>
                  <b>{LAYOUTS[k].nom}</b>
                  <span className="tiny mut">{locked ? "🔒 Offre payante" : LAYOUTS[k].description}</span>
                </button>
              );
            })}
          </div>
          <p className="hint">Le style visuel et les couleurs se règlent dans le <Link href={`/projets/${p.id}/constructeur`} style={{ textDecoration: "underline" }}>constructeur</Link>.</p>
        </div>

        <div className="panel stack" style={{ gap: 10 }}>
          <span className="label">Boutons</span>
          <input className="input" value={l.boutonPrincipal} maxLength={40} onChange={(e) => save({ ...l, boutonPrincipal: e.target.value })} aria-label="Bouton principal" />
          <input className="input" value={l.boutonSecondaire} maxLength={40} onChange={(e) => save({ ...l, boutonSecondaire: e.target.value })} aria-label="Bouton secondaire" />
        </div>

        <div className="stack" style={{ gap: 8 }}>
          <div className="row between"><span className="label">Sections</span><span className="tiny mut">↑↓ pour réordonner</span></div>
          {l.sections.map((s, i) => (
            <div key={s.id} className={`lt-sec ${s.visible ? "" : "off"}`}>
              <div className="row between" style={{ flexWrap: "nowrap" }}>
                <button className="lt-sec-title" onClick={() => setOpen(open === s.id ? null : s.id)} aria-expanded={open === s.id}>
                  <span className="lt-caret">{open === s.id ? "▾" : "▸"}</span>{SECTION_LABEL[s.type]}
                </button>
                <div className="row" style={{ gap: 4, flexWrap: "nowrap" }}>
                  <button className="icon-btn" style={{ width: 30, height: 30 }} disabled={i <= 1} onClick={() => save(moveSection(l, i, -1))} aria-label={`Monter ${SECTION_LABEL[s.type]}`}>↑</button>
                  <button className="icon-btn" style={{ width: 30, height: 30 }} disabled={i === 0 || i === l.sections.length - 1} onClick={() => save(moveSection(l, i, 1))} aria-label={`Descendre ${SECTION_LABEL[s.type]}`}>↓</button>
                  <input type="checkbox" className="switch" checked={s.visible} disabled={s.type === "hero"} onChange={() => setSection(s.id, { visible: !s.visible })} aria-label={`Afficher ${SECTION_LABEL[s.type]}`} />
                </div>
              </div>
              {open === s.id && (
                <div className="stack fade" style={{ gap: 10, marginTop: 12 }}>
                  <input className="input" value={s.titre} maxLength={90} onChange={(e) => setSection(s.id, { titre: e.target.value })} aria-label="Titre" />
                  {s.type !== "avantages" && <textarea className="input" value={s.texte} maxLength={300} onChange={(e) => setSection(s.id, { texte: e.target.value })} aria-label="Texte" placeholder="Texte (facultatif)" />}
                  {s.type === "tarifs" && <p className="hint">Les offres viennent du <b>labo des prix</b>.</p>}
                  {["features", "etapes", "avantages", "faq"].includes(s.type) && (
                    <>
                      {s.items.map((it, j) => (
                        <div key={j} className="lt-item">
                          <input className="input" value={it.titre} maxLength={90} onChange={(e) => setSection(s.id, { items: s.items.map((x, k) => (k === j ? { ...x, titre: e.target.value } : x)) })} aria-label={`Élément ${j + 1}`} />
                          {s.type !== "avantages" && <textarea className="input" style={{ minHeight: 60 }} value={it.texte} maxLength={300} onChange={(e) => setSection(s.id, { items: s.items.map((x, k) => (k === j ? { ...x, texte: e.target.value } : x)) })} aria-label={`Texte de l'élément ${j + 1}`} />}
                          <button className="btn btn-danger btn-sm" style={{ alignSelf: "flex-start" }} onClick={() => setSection(s.id, { items: s.items.filter((_, k) => k !== j) })}>Retirer</button>
                        </div>
                      ))}
                      {s.items.length < 8 && <button className="btn btn-ghost btn-sm" style={{ alignSelf: "flex-start" }} onClick={() => setSection(s.id, { items: [...s.items, { titre: s.type === "faq" ? "Nouvelle question ?" : "Nouvel élément", texte: "" }] })}>+ Ajouter</button>}
                    </>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="panel stack" style={{ gap: 10 }}>
          <div className="row">
            <CopyButton text={landingText(l)} label="Copier le texte" />
            <button className="btn btn-sm" onClick={exportFiles} disabled={!can(plan, "exportFichiers")}>Télécharger HTML + CSS{can(plan, "exportFichiers") ? "" : " · offre payante"}</button>
          </div>
          <button className="btn btn-ghost btn-sm" style={{ alignSelf: "flex-start" }} onClick={() => setConfirm(true)}>Régénérer les textes depuis le modèle</button>
          <p className="tiny mut">Textes assemblés à partir de modèles rédactionnels et de tes réponses. Aucun domaine ni hébergement n&apos;est réservé par Décollage.</p>
        </div>
      </div>

      <div className="lt-preview">
        <div className="row between" style={{ marginBottom: 12 }}>
          <span className="label">Aperçu en direct</span>
          <div className="seg" role="group" aria-label="Appareil">
            <button aria-pressed={device === "desktop"} onClick={() => setDevice("desktop")}>Ordinateur</button>
            <button aria-pressed={device === "mobile"} onClick={() => setDevice("mobile")}>Mobile</button>
          </div>
        </div>
        <div className={`device ${device}`} style={{ height: device === "mobile" ? 720 : 760 }}>
          <div className="device-bar"><i /><i /><i /><span className="url">{p.config.domaine || `${slug(p.config.nom)}.exemple`}</span></div>
          <iframe title="Aperçu de la landing" srcDoc={html} sandbox="allow-scripts allow-forms" />
        </div>
      </div>

      <Confirm
        open={confirm}
        onClose={() => setConfirm(false)}
        onConfirm={() => { updateProject(p.id, (x) => ({ ...x, landing: { ...buildLanding(x.config, contenuOf(x)), layout: x.landing.layout } }), "Landing : textes régénérés"); toast("Textes régénérés"); }}
        title="Régénérer les textes ?"
        text="Tes modifications de texte, l'ordre et la visibilité des sections seront remplacés par les textes du modèle. La mise en page est conservée."
        cta="Régénérer"
        danger
      />

      <style>{`
        .lt{display:grid;grid-template-columns:400px 1fr;gap:24px;align-items:start}
        .lt-preview{position:sticky;top:84px}
        .lt-layouts{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}
        .lt-layout{border:1.5px solid var(--line-2);background:#fff;border-radius:12px;padding:8px;display:flex;flex-direction:column;gap:4px;text-align:left;cursor:pointer;transition:all .2s var(--ease)}
        .lt-layout[aria-pressed="true"]{border-color:var(--blue);box-shadow:0 0 0 3px rgba(47,91,255,.18)}
        .lt-layout:disabled{opacity:.6;cursor:not-allowed}
        .lt-thumb{height:48px;border-radius:8px;background:var(--cream);display:grid;gap:4px;padding:7px}
        .lt-thumb i{display:block;height:6px;border-radius:3px;background:var(--cream-2)}
        .lay-centre .lt-thumb{justify-items:center}.lay-centre .lt-thumb i:first-child{width:70%;background:var(--navy)}.lay-centre .lt-thumb i:nth-child(2){width:50%}.lay-centre .lt-thumb i:last-child{width:30%;background:var(--blue)}
        .lay-split .lt-thumb{grid-template-columns:1fr 1fr;grid-template-rows:auto auto 1fr}.lay-split .lt-thumb i:first-child{background:var(--navy)}.lay-split .lt-thumb i:last-child{grid-column:2;grid-row:1/4;height:auto;background:var(--blue-soft)}
        .lay-editorial .lt-thumb i:first-child{height:12px;width:90%;background:var(--navy)}.lay-editorial .lt-thumb i:last-child{width:60%}
        .lt-sec{background:var(--paper);border:1px solid var(--line);border-radius:14px;padding:10px 12px;transition:opacity .2s}
        .lt-sec.off{opacity:.55}
        .lt-sec-title{border:0;background:none;font-weight:600;cursor:pointer;display:flex;gap:8px;align-items:center;text-align:left;padding:4px 0}
        .lt-caret{color:var(--mut);width:12px}
        .lt-item{display:grid;gap:6px;padding:10px;border-radius:10px;background:var(--cream)}
        @media(max-width:1060px){.lt{grid-template-columns:1fr}.lt-preview{position:static}}
      `}</style>
    </div>
  );
}
