"use client";

import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useState } from "react";
import { ProjectMissing } from "@/components/project/ProjectMissing";
import { DESIGN_BY_ID } from "@/data/designs";
import { SECTEUR_BY_ID } from "@/data/secteurs";
import { TEMPLATE_BY_ID } from "@/data/templates";
import { slug } from "@/lib/export";
import { renderLanding } from "@/lib/landing";
import { activePages } from "@/lib/modules";
import { can } from "@/lib/plans";
import { roadmapFor } from "@/lib/plan-builder";
import { defaultConfig } from "@/lib/config";
import { MODULE_BY_ID } from "@/data/modules";
import { detectFonctions, FONCTIONS, motsDeclencheurs } from "@/lib/fonctions";
import { norm } from "@/lib/match";
import { contenuOf } from "@/lib/project";
import { renderPrototype } from "@/lib/prototype";
import { setAppData, useData, useHydrated } from "@/lib/store";
import { useAppDataBridge } from "@/components/AppDataBridge";
import type { Config, Project } from "@/lib/types";

export default function Page() {
  return (
    <Suspense fallback={<main className="page" />}>
      <SitePage />
    </Suspense>
  );
}

function SitePage() {
  const { id } = useParams<{ id: string }>();
  const fresh = useSearchParams().get("nouveau") === "1";
  const project = useData().projects.find((p) => p.id === id);
  const hydrated = useHydrated();
  if (!hydrated) return <main className="page" />;
  if (!project) return <ProjectMissing />;
  return <Site key={project.id} p={project} fresh={fresh} />;
}

function Site({ p, fresh }: { p: Project; fresh: boolean }) {
  const { plan } = useData();
  useAppDataBridge(p.id);
  const t = TEMPLATE_BY_ID[p.config.templateId];
  const pages = activePages(p.config);
  const tasks = roadmapFor(p.config, can(plan, "plansDetailles")).reduce((n, s) => n + s.tasks.length, 0);
  const contenu = contenuOf(p);
  const design = p.config.design ? DESIGN_BY_ID[p.config.design] : undefined;
  const secteur = contenu ? SECTEUR_BY_ID[contenu.secteur] : undefined;
  const fonctions = fonctionsActives(p.config, contenu?.idee ?? "");
  const steps = [
    ...(contenu ? ["Lecture de ton idée"] : []),
    `Type de SaaS : ${t.nom}`,
    ...(secteur && secteur.id !== "general" ? [`Métier : ${secteur.nom}`] : []),
    ...(fonctions.length ? [`Fonctions : ${fonctions.map((f) => f.label.toLowerCase()).join(", ")}`] : []),
    ...(design ? [`Design « ${design.nom} » appliqué`] : []),
    `${pages.length} pages : ${pages.slice(0, 4).map((x) => x.titre).join(", ")}${pages.length > 4 ? "…" : ""}`,
    ...(contenu ? [`Données d'exemple adaptées${secteur ? ` : ${secteur.nom.toLowerCase()}` : ""}`] : []),
    "Page de vente rédigée",
    `Feuille de route de ${tasks} tâches`,
  ];
  // Animation d'assemblage seulement à la création ; elle affiche ce qui a réellement été généré.
  const [shown, setShown] = useState(fresh ? 0 : steps.length + 1);
  useEffect(() => {
    if (shown > steps.length) return;
    const id = setTimeout(() => setShown((s) => s + 1), shown === 0 ? 900 : shown === steps.length ? 600 : 420);
    return () => clearTimeout(id);
  }, [shown, steps.length]);

  const [view, setView] = useState<"app" | "landing">("app");
  const [reload, setReload] = useState(0);
  const [device, setDevice] = useState<"desktop" | "mobile">("desktop");
  const doc = useMemo(
    () => (view === "app" ? renderPrototype(p.config, "accueil", contenu, { persist: true, storeKey: p.id }) : renderLanding(p.config, p.landing, p.pricing.offres.length ? p.pricing : null, { inlineCss: true, contenu })),
    [view, p.id, p.config, p.landing, p.pricing, contenu],
  );

  if (shown <= steps.length) {
    return (
      <main className="page">
        <div className="container narrow" style={{ display: "grid", placeItems: "center", minHeight: "60vh" }}>
          <div className="panel st-gen">
            <span className="eyebrow">Génération</span>
            <h1 style={{ fontSize: 30, margin: "10px 0 16px" }}>On assemble « {p.config.nom} »</h1>
            {contenu && <p className="st-idea">« <Surligne texte={contenu.idee} secteur={secteur?.mots ?? []} /> »</p>}
            <div className="st-bar"><i style={{ width: `${Math.round((Math.min(shown, steps.length) / steps.length) * 100)}%` }} /></div>
            <ul className="st-steps">
              {steps.map((s, i) => (
                <li key={s} className={i < shown ? "done" : i === shown ? "now" : ""}>
                  <span className="st-ic">{i < shown ? "✓" : ""}</span>{s}
                </li>
              ))}
            </ul>
          </div>
        </div>
        <style>{STYLE}</style>
      </main>
    );
  }

  return (
    <main className="page">
      <div className="container">
        <div className="crumbs"><Link href="/tableau-de-bord">Mes projets</Link> / <Link href={`/projets/${p.id}`}>{p.config.nom}</Link> / <span>Mon SaaS</span></div>
        <div className="st-head fade">
          <div>
            {fresh && <span className="badge badge-ok" style={{ marginBottom: 10 }}>✓ Généré</span>}
            <h1 className="h-page">Ton SaaS <span className="serif" style={{ color: "var(--coral-ink)" }}>{p.config.nom}</span> est prêt</h1>
            <p className="mut" style={{ marginTop: 8, maxWidth: 640 }}>{p.config.description}</p>
          </div>
          <div className="row">
            <Link href={`/projets/${p.id}/constructeur`} className="btn btn-ghost">Personnaliser</Link>
            <Link href={`/projets/${p.id}?onglet=export`} className="btn">Télécharger</Link>
          </div>
        </div>

        <div className="row between" style={{ margin: "22px 0 14px" }}>
          <div className="seg" role="group" aria-label="Vue">
            <button aria-pressed={view === "app"} onClick={() => setView("app")}>Application</button>
            <button aria-pressed={view === "landing"} onClick={() => setView("landing")}>Page de vente</button>
          </div>
          <div className="seg" role="group" aria-label="Appareil">
            <button aria-pressed={device === "desktop"} onClick={() => setDevice("desktop")}>Ordinateur</button>
            <button aria-pressed={device === "mobile"} onClick={() => setDevice("mobile")}>Mobile</button>
          </div>
        </div>

        <div className={`device ${device} fade`} style={{ height: device === "mobile" ? 760 : "min(820px, calc(100vh - 140px))" }}>
          <div className="device-bar"><i /><i /><i /><span className="url">{p.config.domaine || `${slug(p.config.nom)}.exemple`}{view === "app" ? " · application" : ""}</span></div>
          <iframe key={`${view}-${reload}`} title={view === "app" ? "Ton application" : "Ta page de vente"} srcDoc={doc} sandbox="allow-scripts allow-forms allow-downloads" />
        </div>
        <p className="center tiny mut" style={{ marginTop: 12 }}>
          {view === "app"
            ? <>Ton application est utilisable : ce que tu ajoutes, modifies ou supprimes est <b>enregistré dans ton projet</b> (sur cet appareil{" "}et sur ton compte s&apos;il est connecté). Import et export CSV dans « Paramètres » de l&apos;application. Connexion, paiements et notifications restent simulés.</>
            : "Aperçu de ta page de vente. Rien n'est en ligne tant que tu ne l'as pas publiée."}
          {view === "app" && p.appData && <> · <button className="ov-reset" onClick={() => { setAppData(p.id, null); setReload((n) => n + 1); }}>Revenir aux données d&apos;exemple</button></>}
        </p>

        <div className="st-next">
          <Link href={`/projets/${p.id}?onglet=enligne`} className="panel lift st-hl"><b>🚀 Publier en ligne</b><span className="mut small">Une adresse publique et une vraie liste d&apos;attente.</span></Link>
          <Link href={`/projets/${p.id}/constructeur`} className="panel lift"><b>Personnaliser</b><span className="mut small">Nom, couleurs, thème, police, logo, pages.</span></Link>
          <Link href={`/projets/${p.id}?onglet=production`} className="panel lift"><b>Mise en production</b><span className="mut small">Supabase, Stripe, Vercel, domaine : le pas à pas.</span></Link>
          <Link href={`/projets/${p.id}?onglet=validation`} className="panel lift"><b>Valider l&apos;idée</b><span className="mut small">9 questions pour savoir si ça vaut le coup.</span></Link>
        </div>
      </div>
      <style>{STYLE}</style>
    </main>
  );
}

/** L'idée, avec les mots que le moteur a reconnus (métier et fonctions) mis en évidence. */
function Surligne({ texte, secteur }: { texte: string; secteur: string[] }) {
  // Les expressions (« carte des ») sont surlignées par leurs mots significatifs.
  const trig = new Set([...motsDeclencheurs(texte)].flatMap((m) => (m.includes(" ") ? m.split(" ").filter((w) => w.length > 3) : [m])));
  return (
    <>
      {texte.split(/(\s+)/).map((w, i) => {
        const n = norm(w).replace(/[^a-z0-9-]/g, "");
        const hit = n.length > 2 && (trig.has(n) || secteur.some((m) => n.startsWith(m)));
        return hit ? <mark key={i} style={{ "--i": i } as React.CSSProperties}>{w}</mark> : w;
      })}
    </>
  );
}

/** Fonctions demandées (repérées dans l'idée ou ajoutées à la main) et réellement présentes dans le SaaS. */
function fonctionsActives(cfg: Config, idee: string) {
  const base = defaultConfig(cfg.templateId).modules;
  const lues = new Set(detectFonctions(idee).map((x) => x.f.id));
  return FONCTIONS.filter((f) => {
    if (f.page) return (cfg.extras ?? []).includes(f.page);
    if (!f.module || !cfg.modules.includes(f.module)) return false;
    // Une brique ajoutée seulement comme dépendance d'une autre (ex. profil pour le paiement) n'est pas une demande.
    return lues.has(f.id) || (!base.includes(f.module) && f.id !== "dashboard" && !FONCTIONS.some((g) => g.module && g.module !== f.module && cfg.modules.includes(g.module) && MODULE_BY_ID[g.module].deps.includes(f.module!)));
  });
}

const STYLE = `
.st-gen{width:min(580px,100%);padding:32px}
.st-idea{font-size:17px;line-height:1.6;color:var(--ink-2);margin:0 0 16px;padding:14px 16px;border-radius:14px;background:var(--cream);border:1px solid var(--line)}
.st-idea mark{background:rgba(255,107,74,.22);color:inherit;border-radius:5px;padding:0 3px;animation:hl .6s var(--ease) both;animation-delay:calc(var(--i) * 25ms + .3s)}
@keyframes hl{from{background:transparent}}
.st-bar{height:6px;border-radius:99px;background:var(--cream-2);overflow:hidden;margin-bottom:20px}.st-bar i{display:block;height:100%;border-radius:inherit;background:linear-gradient(90deg,var(--blue),var(--coral));transition:width .4s var(--ease)}
.st-steps{list-style:none;padding:0;margin:0;display:grid;gap:12px}
.st-steps li{display:flex;gap:12px;align-items:center;color:var(--mut);opacity:.45;transition:opacity .3s,color .3s;font-weight:500}
.st-steps li.now{opacity:1;color:var(--ink)}.st-steps li.done{opacity:1;color:var(--ink)}
.st-ic{width:26px;height:26px;border-radius:8px;border:1.5px solid var(--line-2);display:grid;place-items:center;font-size:13px;flex-shrink:0;transition:all .3s var(--ease)}
.now .st-ic{border-color:var(--blue);border-top-color:transparent;border-radius:50%;animation:spin .7s linear infinite}
.done .st-ic{background:var(--ok);border-color:var(--ok);color:#fff;animation:pop .35s var(--ease)}
@keyframes spin{to{transform:rotate(360deg)}}
.ov-reset{border:0;background:none;padding:0;color:var(--blue-ink);font:inherit;font-weight:600;text-decoration:underline;cursor:pointer}
.st-head{display:flex;justify-content:space-between;align-items:flex-end;gap:20px;flex-wrap:wrap}
.st-next{display:grid;grid-template-columns:repeat(4,1fr);gap:14px;margin-top:32px}
.st-next a{display:grid;gap:4px}
.st-hl{background:var(--navy);color:#fff;border-color:transparent}.st-hl .mut{color:rgba(255,255,255,.7)}
@media(max-width:900px){.st-next{grid-template-columns:1fr 1fr}}
@media(max-width:520px){.st-next{grid-template-columns:1fr}}
`;
