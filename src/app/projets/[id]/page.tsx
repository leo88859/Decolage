"use client";

import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { ProjectThumb } from "@/components/DesignThumb";
import { GuideView } from "@/components/GuideView";
import { PageHero } from "@/components/PageHero";
import { DESIGN_BY_ID } from "@/data/designs";
import { ExportTab } from "@/components/project/ExportTab";
import { OnlineTab } from "@/components/project/OnlineTab";
import { LandingTab } from "@/components/project/LandingTab";
import { LaunchTab } from "@/components/project/LaunchTab";
import { MetricsTab } from "@/components/project/MetricsTab";
import { Overview } from "@/components/project/Overview";
import { PricingTab } from "@/components/project/PricingTab";
import { ProjectMissing } from "@/components/project/ProjectMissing";
import { RoadmapTab } from "@/components/project/RoadmapTab";
import type { TabId } from "@/components/project/tabs";
import { ValidationTab } from "@/components/project/ValidationTab";
import { Confirm, toast } from "@/components/ui";
import { TEMPLATE_BY_ID } from "@/data/templates";
import { can } from "@/lib/plans";
import { projectProgress } from "@/lib/project";
import { deleteProject, duplicate, updateProject, useData, useHydrated } from "@/lib/store";

const TABS: { id: TabId; label: string; groupe: string }[] = [
  { id: "apercu", label: "Vue d'ensemble", groupe: "Piloter" },
  { id: "indicateurs", label: "Indicateurs", groupe: "Piloter" },
  { id: "validation", label: "Validation", groupe: "Valider et vendre" },
  { id: "landing", label: "Page de vente", groupe: "Valider et vendre" },
  { id: "prix", label: "Prix", groupe: "Valider et vendre" },
  { id: "feuille", label: "Feuille de route", groupe: "Construire et lancer" },
  { id: "lancement", label: "Lancement", groupe: "Construire et lancer" },
  { id: "enligne", label: "En ligne", groupe: "Mettre en ligne" },
  { id: "production", label: "Mise en production", groupe: "Mettre en ligne" },
  { id: "export", label: "Export", groupe: "Mettre en ligne" },
];
const GROUPES = [...new Set(TABS.map((t) => t.groupe))];
const DONE_STEP: Partial<Record<TabId, string>> = { validation: "valider", landing: "landing", feuille: "feuille", lancement: "lancement" };

export default function Page() {
  return (
    <Suspense fallback={<main className="page" />}>
      <ProjectPage />
    </Suspense>
  );
}

function ProjectPage() {
  const { id } = useParams<{ id: string }>();
  const params = useSearchParams();
  const router = useRouter();
  const { projects, plan } = useData();
  const hydrated = useHydrated();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const project = projects.find((p) => p.id === id);
  const tabParam = params.get("onglet");
  const tab: TabId = TABS.some((t) => t.id === tabParam) ? (tabParam as TabId) : "apercu";

  if (!hydrated) return <main className="page"><div className="container"><div className="skeleton" style={{ height: 180 }} /></div></main>;
  if (!project) return <ProjectMissing />;

  const t = TEMPLATE_BY_ID[project.config.templateId];
  const prog = projectProgress(project, can(plan, "plansDetailles"));
  const go = (next: TabId) => router.replace(`/projets/${id}${next === "apercu" ? "" : `?onglet=${next}`}`, { scroll: false });

  function onDuplicate() {
    const r = duplicate(project!.id);
    if (!r.ok) return toast(r.error, "error");
    toast("Projet dupliqué");
    router.push(`/projets/${r.id}`);
  }

  const design = project.config.design ? DESIGN_BY_ID[project.config.design] : undefined;
  const c = project.config;
  // Logo en data URL (importé ou généré) : next/image n'apporte rien ici.
  // eslint-disable-next-line @next/next/no-img-element
  const mark = c.logo ? <img src={c.logo} alt="" /> : c.initiales;

  return (
    <main className="page">
      <PageHero
        tone="navy"
        compact
        eyebrow={`Mes projets · ${t.nom}${design ? ` · design ${design.nom}` : ""}`}
        title={<span className="pj-title"><span className="pj-mark" style={{ background: `linear-gradient(135deg, ${c.couleurs.primaire}, ${c.couleurs.accent})` }}>{mark}</span>{c.nom}</span>}
        lead={c.description}
        aside={
          <Link href={`/projets/${id}/site`} className="pj-thumb" aria-label="Voir mon SaaS en grand">
            <ProjectThumb project={project} width={1180} />
            <span>Voir mon SaaS ↗</span>
          </Link>
        }
      >
        <Link href={`/projets/${id}/constructeur`} className="btn btn-coral">Reprendre dans le constructeur <span className="arrow">→</span></Link>
        <Link href={`/projets/${id}/site`} className="btn btn-ghost">Voir mon SaaS</Link>
        <button className="btn btn-ghost btn-sm" onClick={onDuplicate} disabled={!can(plan, "duplication")} title={can(plan, "duplication") ? "" : "Inclus dans les offres payantes"}>Dupliquer{can(plan, "duplication") ? "" : " · offre payante"}</button>
        <button className="btn btn-ghost btn-sm pj-del" onClick={() => setConfirmDelete(true)}>Supprimer</button>
      </PageHero>

      <div className="pj-bar">
        <div className="container">
          <div className="pj-tabs" role="tablist" aria-label="Sections du projet">
            {GROUPES.map((g) => (
              <div key={g} className="pj-group">
                <span className="pj-glabel">{g}</span>
                <div className="pj-gtabs">
                  {TABS.filter((x) => x.groupe === g).map((x) => {
                    const done = DONE_STEP[x.id] && prog.etapes.some((e) => e.id === DONE_STEP[x.id] && e.done);
                    return (
                      <button key={x.id} role="tab" id={`tab-${x.id}`} aria-selected={tab === x.id} aria-controls="panel" className="pj-tab" onClick={() => go(x.id)}>
                        {x.label}{done && <span className="pj-done" aria-label="terminé">✓</span>}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="container">
        <div className="crumbs" style={{ margin: "18px 0 22px" }}><Link href="/tableau-de-bord">Mes projets</Link> / <span>{c.nom}</span> / <span>{TABS.find((x) => x.id === tab)!.label}</span></div>
        <div id="panel" role="tabpanel" aria-labelledby={`tab-${tab}`} key={tab} className="fade">
          {tab === "apercu" && <Overview project={project} go={go} />}
          {tab === "validation" && <ValidationTab project={project} go={go} />}
          {tab === "landing" && <LandingTab project={project} />}
          {tab === "feuille" && <RoadmapTab project={project} />}
          {tab === "prix" && <PricingTab project={project} />}
          {tab === "lancement" && <LaunchTab project={project} />}
          {tab === "indicateurs" && <MetricsTab project={project} />}
          {tab === "enligne" && <OnlineTab project={project} />}
          {tab === "production" && (
            <GuideView
              cfg={project.config}
              pricing={project.pricing.offres.length ? project.pricing : null}
              checks={project.guide ?? {}}
              onToggle={(sid) => updateProject(project.id, (x) => ({ ...x, guide: { ...(x.guide ?? {}), [sid]: !x.guide?.[sid] } }), "Mise en production : étape cochée")}
            />
          )}
          {tab === "export" && <ExportTab project={project} />}
        </div>
      </div>

      <Confirm
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        onConfirm={() => { deleteProject(project.id); toast("Projet supprimé"); router.push("/tableau-de-bord"); }}
        title={`Supprimer « ${project.config.nom} » ?`}
        text="Le projet et toutes ses données (validation, feuille de route, prix, indicateurs) seront supprimés de ce navigateur (et de ton compte s'il est connecté). Si ce projet est publié en ligne, son site est dépublié et sa liste d'inscrits est effacée. Exporte-le d'abord si tu veux le garder."
        cta="Supprimer définitivement"
        danger
      />
      <style>{`
        .pj-title{display:inline-flex;align-items:center;gap:18px;flex-wrap:wrap}
        .pj-mark{width:clamp(48px,6vw,68px);height:clamp(48px,6vw,68px);border-radius:18px;display:grid;place-items:center;font:700 clamp(16px,2vw,22px) var(--display);color:#fff;overflow:hidden;flex-shrink:0;box-shadow:0 0 0 4px rgba(255,255,255,.08)}
        .pj-mark img{width:100%;height:100%;object-fit:cover}
        .pj-thumb{display:block;position:relative;border-radius:16px;overflow:hidden;border:1px solid rgba(255,255,255,.18);box-shadow:0 40px 80px -40px rgba(0,0,0,.8);transform:rotate(-1.2deg);transition:transform .4s var(--ease)}
        .pj-thumb:hover{transform:none}
        .pj-thumb > span{position:absolute;right:10px;bottom:10px;padding:6px 11px;border-radius:99px;background:var(--coral);color:var(--navy);font-size:12.5px;font-weight:700}
        .phero .pj-del{color:#ffb4a6}
        .pj-bar{position:sticky;top:64px;z-index:20;margin-top:-44px;background:rgba(246,241,231,.94);backdrop-filter:blur(12px);border-bottom:1px solid var(--line)}
        .pj-tabs{display:flex;gap:22px;overflow-x:auto;scrollbar-width:none;padding:10px 0}
        .pj-tabs::-webkit-scrollbar{display:none}
        .pj-group{display:grid;gap:4px;flex-shrink:0}
        .pj-glabel{font-size:11px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:var(--mut);padding-left:10px}
        .pj-gtabs{display:flex;gap:2px;padding:3px;border-radius:12px;background:var(--cream-2)}
        .pj-tab{border:0;background:none;padding:7px 12px;border-radius:9px;font-weight:600;font-size:14px;color:var(--ink-2);cursor:pointer;white-space:nowrap;display:inline-flex;gap:6px;align-items:center;transition:background .2s,color .2s,box-shadow .2s}
        .pj-tab:hover{color:var(--ink);background:rgba(255,255,255,.5)}
        .pj-tab[aria-selected="true"]{background:var(--navy);color:#fff;box-shadow:0 6px 14px -8px var(--navy)}
        .pj-done{width:16px;height:16px;border-radius:50%;display:inline-grid;place-items:center;background:var(--ok);color:#fff;font-size:9px}
        @media(max-width:720px){.pj-bar{margin-top:-28px}.pj-thumb{transform:none}}
      `}</style>
    </main>
  );
}
