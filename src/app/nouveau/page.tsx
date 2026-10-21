"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { PageHero } from "@/components/PageHero";
import { IDEA_BY_ID } from "@/data/ideas";
import { TEMPLATE_BY_ID, TEMPLATES } from "@/data/templates";
import { can, PLANS } from "@/lib/plans";
import { createProject, useData, useHydrated } from "@/lib/store";
import type { TemplateId } from "@/lib/types";

export default function Page() {
  return (
    <Suspense fallback={<main className="page" />}>
      <Nouveau />
    </Suspense>
  );
}

function Nouveau() {
  const params = useSearchParams();
  const router = useRouter();
  const data = useData();
  const hydrated = useHydrated();
  const idea = params.get("idee") ? IDEA_BY_ID[params.get("idee")!] : undefined;
  const fromParam = params.get("modele") as TemplateId | null;
  const [picked, setPicked] = useState<TemplateId | null>(idea?.template ?? (fromParam && TEMPLATE_BY_ID[fromParam] ? fromParam : null));
  const [error, setError] = useState("");

  const limit = PLANS[data.plan].maxProjets;
  const full = hydrated && data.projects.length >= limit;
  const locked = (id: TemplateId) => TEMPLATE_BY_ID[id].premium && !can(data.plan, "modelesPremium");

  function create() {
    if (!picked || locked(picked)) return;
    const r = createProject(picked, idea?.id);
    if (!r.ok) {
      setError(r.error);
      return;
    }
    // Le type est choisi : la suite du parcours (design, personnalisation, fonctions, vérification) se fait dans le constructeur.
    router.push(`/projets/${r.id}/constructeur?etape=design`);
  }

  return (
    <main className="page">
      <PageHero
        tone="blue"
        compact
        eyebrow="Construire · Pas à pas"
        title={<>Étape 1 : <span className="serif">quel type</span> de SaaS ?</>}
        lead={idea ? <>Pour l&apos;idée « {idea.nom} », le type conseillé est présélectionné. Tu peux en choisir un autre.</> : "Le type définit les pages, les rôles et les briques de départ. Tu choisiras ensuite le design, puis tu personnaliseras tout."}
        aside={
          <ol className="wiz-steps">
            {["Type de SaaS", "Design", "Personnalisation", "Fonctions", "Vérification"].map((s, i) => <li key={s} className={i === 0 ? "on" : ""}><span>{i + 1}</span>{s}</li>)}
          </ol>
        }
      />
      <div className="container">
        {hydrated && limit > 0 && <p className="tiny mut" style={{ marginBottom: 14 }}>{limit === Infinity ? `${data.projects.length} projet${data.projects.length > 1 ? "s" : ""} · illimité` : `${data.projects.length} / ${limit} projet${limit > 1 ? "s" : ""}`} · formule {PLANS[data.plan].nom}</p>}

        {full && limit === 0 && (
          <div className="alert alert-warn" style={{ marginBottom: 20 }}>
            Tu peux parcourir les modèles librement. Pour générer ton SaaS, <Link href="/parametres#formule" style={{ textDecoration: "underline" }}>choisis une offre</Link> (dès 2,99 €/mois), ou <Link href="/creer" style={{ textDecoration: "underline" }}>essaie d&apos;abord ton idée dans les 10 designs</Link>.
          </div>
        )}
        {full && limit > 0 && (
          <div className="alert alert-warn" style={{ marginBottom: 20 }}>
            Tu as atteint la limite de {limit} projet{limit > 1 ? "s" : ""} de la formule {PLANS[data.plan].nom}. <Link href="/tableau-de-bord" style={{ textDecoration: "underline" }}>Supprime un projet</Link> ou <Link href="/parametres" style={{ textDecoration: "underline" }}>choisis une offre supérieure</Link>.
          </div>
        )}

        <div className="tp-grid" role="radiogroup" aria-label="Types de SaaS">
          {TEMPLATES.map((t, i) => {
            const isLocked = hydrated && locked(t.id);
            const on = picked === t.id;
            return (
              <button key={t.id} role="radio" aria-checked={on} disabled={isLocked} onClick={() => setPicked(t.id)} className={`tp-card ${on ? "on" : ""}`} style={{ "--i": i } as React.CSSProperties}>
                <div className="row between" style={{ flexWrap: "nowrap" }}>
                  <span className="glyph">{t.glyph}</span>
                  {t.premium ? <span className="badge badge-coral">{isLocked ? "🔒 Offre payante" : "Offre payante"}</span> : <span className="tp-check" aria-hidden="true">{on ? "✓" : ""}</span>}
                </div>
                <b className="tp-name">{t.nom}</b>
                <span className="mut small">{t.accroche}</span>
                {/* Plan des pages du type : une mini-carte de sa structure. */}
                <span className="tp-map" aria-hidden="true">{t.pages.slice(0, 5).map((p) => <i key={p.id}>{p.titre}</i>)}</span>
                <span className="tiny mut">{t.pages.length} pages · {t.roles.join(", ")}</span>
              </button>
            );
          })}
        </div>

        <div className="tp-bar">
          <span>{picked ? <>Type : <b>{TEMPLATE_BY_ID[picked].nom}</b></> : "Choisis un type pour continuer"}</span>
          <div className="row">
            {error && <span className="err">{error}</span>}
            <button className="btn btn-coral btn-lg" disabled={!picked || full || (picked ? locked(picked) : false)} onClick={create}>Étape 2 : le design <span className="arrow">→</span></button>
          </div>
        </div>
      </div>
    </main>
  );
}
