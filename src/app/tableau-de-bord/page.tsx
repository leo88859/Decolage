"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { DesignThumb, ProjectThumb } from "@/components/DesignThumb";
import { HeroFacts, PageHero } from "@/components/PageHero";
import { Confirm, Meter, Reveal, toast } from "@/components/ui";
import { DESIGN_BY_ID } from "@/data/designs";
import { EXEMPLES } from "@/data/exemples";
import { IDEA_BY_ID } from "@/data/ideas";
import { TEMPLATE_BY_ID } from "@/data/templates";
import { can, PLANS } from "@/lib/plans";
import { projectProgress } from "@/lib/project";
import { deleteProject, duplicate, useData, useHydrated } from "@/lib/store";
import type { Project } from "@/lib/types";

function ago(iso: string) {
  const s = (Date.now() - new Date(iso).getTime()) / 1000;
  if (s < 60) return "à l'instant";
  if (s < 3600) return `il y a ${Math.floor(s / 60)} min`;
  if (s < 86400) return `il y a ${Math.floor(s / 3600)} h`;
  return `il y a ${Math.floor(s / 86400)} j`;
}
const date = (iso: string) => new Date(iso).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });

type Sort = "recent" | "nom" | "avancement" | "creation";
const SORTS: [Sort, string][] = [["recent", "Dernière modification"], ["nom", "Nom"], ["avancement", "Avancement"], ["creation", "Date de création"]];

export default function Dashboard() {
  const { projects, favorites, plan, designFavs = [] } = useData();
  const hydrated = useHydrated();
  const router = useRouter();
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<Sort>("recent");
  const [toDelete, setToDelete] = useState<Project | null>(null);
  const detaille = can(plan, "plansDetailles");

  if (!hydrated) return <main className="page"><div className="container"><div className="skeleton" style={{ height: 260 }} /></div></main>;

  const stats = projects.map((p) => ({ p, prog: projectProgress(p, detaille) }));
  const tasksDone = stats.reduce((s, x) => s + x.prog.done, 0);
  const favIdeas = favorites.map((f) => IDEA_BY_ID[f]).filter(Boolean);
  const needle = q.trim().toLowerCase();
  const shown = stats
    .filter(({ p }) => !needle || `${p.config.nom} ${TEMPLATE_BY_ID[p.config.templateId].nom} ${p.config.description}`.toLowerCase().includes(needle))
    .sort((a, b) => sort === "nom" ? a.p.config.nom.localeCompare(b.p.config.nom, "fr") : sort === "avancement" ? b.prog.pct - a.prog.pct : sort === "creation" ? b.p.createdAt.localeCompare(a.p.createdAt) : b.p.updatedAt.localeCompare(a.p.updatedAt));
  const max = PLANS[plan].maxProjets;
  const last = [...projects].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0];

  function onDuplicate(p: Project) {
    const r = duplicate(p.id);
    if (!r.ok) return toast(r.error, "error");
    toast(`« ${p.config.nom} » dupliqué`);
  }

  return (
    <main className="page">
      <PageHero
        tone="coral"
        compact
        eyebrow="Mes projets"
        title={projects.length ? <>Tes SaaS, <span className="serif">là où tu les as laissés</span>.</> : <>Ton premier SaaS commence <span className="serif">ici</span>.</>}
        lead={projects.length ? `${projects.length} projet${projects.length > 1 ? "s" : ""} enregistré${projects.length > 1 ? "s" : ""} dans ce navigateur${last ? ` · dernière modification ${ago(last.updatedAt)}` : ""}.` : "Tu n'as encore aucun projet. Choisis par où commencer : tout reste modifiable ensuite."}
        aside={projects.length ? <HeroFacts facts={[[max === Infinity ? projects.length : `${projects.length}/${max}`, "projets"], [tasksDone, "tâches terminées"], [favorites.length, "idées en favori"], [PLANS[plan].nom, "formule"]]} /> : undefined}
      >
        <Link href="/creer" className="btn btn-dark">+ Nouveau SaaS</Link>
        <Link href="/nouveau" className="btn btn-ghost">Pas à pas</Link>
      </PageHero>

      <div className="container">
        {projects.length === 0 ? (
          <Welcome favorites={favIdeas.length} />
        ) : (
          <>
            <div className="db-tools">
              <label className="db-search">
                <span aria-hidden="true">⌕</span>
                <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Rechercher un projet…" aria-label="Rechercher un projet" />
                {q && <button onClick={() => setQ("")} aria-label="Effacer la recherche">✕</button>}
              </label>
              <label className="row" style={{ gap: 8 }}>
                <span className="tiny mut">Trier par</span>
                <select className="input" style={{ width: "auto", padding: "8px 34px 8px 12px" }} value={sort} onChange={(e) => setSort(e.target.value as Sort)}>
                  {SORTS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </label>
            </div>

            {shown.length === 0 ? (
              <div className="empty fade">
                <h2 className="h-sec">Aucun projet ne correspond à « {q} »</h2>
                <p className="mut" style={{ margin: "8px 0 18px" }}>Cherche par nom, par type de SaaS ou par description.</p>
                <button className="btn btn-ghost" onClick={() => setQ("")}>Effacer la recherche</button>
              </div>
            ) : (
              <div className="db-cards">
                {shown.map(({ p, prog }, i) => {
                  const d = p.config.design ? DESIGN_BY_ID[p.config.design] : undefined;
                  return (
                    <Reveal key={p.id} delay={i % 3} className="db-card">
                      <Link href={`/projets/${p.id}/site`} className="db-shot" aria-label={`Voir ${p.config.nom}`}>
                        <ProjectThumb project={p} />
                        <span className="db-open">Voir mon SaaS ↗</span>
                      </Link>
                      <div className="db-body">
                        <div className="row between" style={{ flexWrap: "nowrap", alignItems: "flex-start" }}>
                          <div style={{ minWidth: 0 }}>
                            <Link href={`/projets/${p.id}`} className="db-title"><h2>{p.config.nom}</h2></Link>
                            <span className="tiny mut">{TEMPLATE_BY_ID[p.config.templateId].nom}{d ? ` · design ${d.nom}` : ""}</span>
                          </div>
                          <details className="db-menu">
                            <summary className="icon-btn" aria-label={`Actions pour ${p.config.nom}`}>⋯</summary>
                            <div onClick={(e) => e.currentTarget.closest("details")?.removeAttribute("open")}>
                              <Link href={`/projets/${p.id}`}>Ouvrir le projet</Link>
                              <Link href={`/projets/${p.id}?onglet=feuille`}>Feuille de route</Link>
                              <button onClick={() => onDuplicate(p)} disabled={!can(plan, "duplication")}>Dupliquer{can(plan, "duplication") ? "" : " · offre payante"}</button>
                              <button className="danger" onClick={() => setToDelete(p)}>Supprimer…</button>
                            </div>
                          </details>
                        </div>
                        <div className="db-steps" aria-label={`Étape en cours : ${prog.etape}`}>
                          {prog.etapes.map((e) => <span key={e.id} className={e.done ? "done" : e.label === prog.etape ? "now" : ""} title={`${e.label}${e.done ? " : fait" : ""}`} />)}
                          <b className="tiny">{prog.etape}</b>
                        </div>
                        <div className="row between small"><span className="mut">Feuille de route</span><b>{prog.done}/{prog.tasks}</b></div>
                        <Meter value={prog.pct} label={`Avancement de ${p.config.nom}`} />
                        <p className="tiny mut">Prochaine tâche : <b style={{ color: "var(--ink)" }}>{prog.next?.titre ?? "tout est fait"}</b></p>
                        <p className="tiny mut" title={date(p.updatedAt)}>Modifié {ago(p.updatedAt)} · {p.activity[0]?.label ?? "—"}</p>
                        <div className="row" style={{ marginTop: "auto", gap: 8 }}>
                          <button className="btn btn-sm" onClick={() => router.push(`/projets/${p.id}/constructeur`)}>Reprendre</button>
                          <Link href={`/projets/${p.id}/site`} className="btn btn-ghost btn-sm">Voir mon SaaS</Link>
                        </div>
                      </div>
                    </Reveal>
                  );
                })}
                {Number.isFinite(max) && projects.length < max && (
                  <Link href="/creer" className="db-new"><span>+</span><b>Nouveau SaaS</b><span className="tiny mut">{max - projects.length} emplacement{max - projects.length > 1 ? "s" : ""} libre{max - projects.length > 1 ? "s" : ""} dans ta formule</span></Link>
                )}
              </div>
            )}

            <section className="db-favs">
              <div>
                <h2 className="h-sec">Idées en favori</h2>
                {favIdeas.length ? (
                  <div className="db-fav-list">{favIdeas.slice(0, 8).map((i) => <Link key={i!.id} href={`/idees/${i!.id}`} className="chip">{i!.nom}</Link>)}</div>
                ) : <p className="mut small" style={{ marginTop: 8 }}>Aucune pour l&apos;instant. Ajoute des idées avec ♡ depuis le <Link href="/idees" style={{ textDecoration: "underline" }}>catalogue</Link>.</p>}
              </div>
              <div>
                <h2 className="h-sec">Designs en favori</h2>
                {designFavs.length ? (
                  <div className="db-fav-list">{designFavs.map((id) => DESIGN_BY_ID[id] && <Link key={id} href={`/creer?design=${id}`} className="chip"><i className="bz-dot" style={{ background: DESIGN_BY_ID[id]!.couleurs.primaire, width: 10, height: 10, borderRadius: "50%", display: "inline-block" }} />{DESIGN_BY_ID[id]!.nom}</Link>)}</div>
                ) : <p className="mut small" style={{ marginTop: 8 }}>Aucun. Ajoute-en depuis la <Link href="/modeles" style={{ textDecoration: "underline" }}>galerie</Link>.</p>}
              </div>
            </section>
          </>
        )}
      </div>

      <Confirm
        open={!!toDelete}
        onClose={() => setToDelete(null)}
        onConfirm={() => { if (toDelete) { deleteProject(toDelete.id); toast(`« ${toDelete.config.nom} » supprimé`); } }}
        title={`Supprimer « ${toDelete?.config.nom ?? ""} » ?`}
        text="Le projet, sa configuration, sa page de vente et sa feuille de route seront supprimés de ce navigateur (et de ton compte s'il est connecté). Exporte-le d'abord si tu veux le garder."
        cta="Supprimer définitivement"
        danger
      />
      <style>{`
        .db-tools{display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap;margin-bottom:20px}
        .db-search{display:flex;align-items:center;gap:8px;flex:1;max-width:420px;padding:0 12px;border-radius:14px;border:1.5px solid var(--line-2);background:#fff;transition:border-color .15s,box-shadow .15s}
        .db-search:focus-within{border-color:var(--blue);box-shadow:0 0 0 4px rgba(47,91,255,.15)}
        .db-search input{flex:1;border:0;outline:0;background:none;padding:11px 0;font:inherit;color:var(--ink)}
        .db-search button{border:0;background:var(--cream-2);border-radius:50%;width:24px;height:24px;cursor:pointer;font-size:11px}
        .db-cards{display:grid;grid-template-columns:repeat(auto-fill,minmax(min(100%,340px),1fr));gap:20px}
        .db-card{display:flex;flex-direction:column;border-radius:var(--r-lg);background:var(--paper);border:1px solid var(--line);overflow:hidden;transition:transform .3s var(--ease),box-shadow .3s}
        .db-card:hover{transform:translateY(-4px);box-shadow:var(--shadow-lg)}
        .db-shot{position:relative;display:block;border-bottom:1px solid var(--line)}
        .db-open{position:absolute;right:10px;bottom:10px;padding:6px 11px;border-radius:99px;background:rgba(10,20,51,.88);color:#fff;font-size:12px;font-weight:600;opacity:0;transform:translateY(6px);transition:all .25s var(--ease)}
        .db-shot:hover .db-open,.db-shot:focus-visible .db-open{opacity:1;transform:none}
        .db-body{padding:18px;display:flex;flex-direction:column;gap:10px;flex:1}
        .db-title h2{font-size:22px;transition:color .15s;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
        .db-title:hover h2{color:var(--blue-ink)}
        .db-steps{display:flex;align-items:center;gap:5px}
        .db-steps span{width:22px;height:6px;border-radius:3px;background:var(--cream-2)}
        .db-steps span.done{background:var(--ok)}
        .db-steps span.now{background:var(--coral);animation:pulse 1.6s ease-in-out infinite}
        .db-steps b{margin-left:6px}
        .db-menu{position:relative}
        .db-menu summary{list-style:none}.db-menu summary::-webkit-details-marker{display:none}
        .db-menu > div{position:absolute;right:0;top:calc(100% + 6px);min-width:210px;display:grid;padding:6px;border-radius:14px;background:var(--paper);border:1px solid var(--line);box-shadow:var(--shadow-lg);z-index:10;animation:drop .2s var(--ease)}
        .db-menu a,.db-menu button{text-align:left;border:0;background:none;padding:9px 11px;border-radius:9px;font-size:14px;font-weight:500;cursor:pointer}
        .db-menu a:hover,.db-menu button:hover{background:var(--cream)}
        .db-menu button:disabled{opacity:.45;cursor:not-allowed}
        .db-menu .danger{color:var(--bad)}
        .db-new{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;min-height:260px;border-radius:var(--r-lg);border:2px dashed var(--line-2);color:var(--ink-2);transition:all .25s var(--ease)}
        .db-new span:first-child{width:52px;height:52px;border-radius:16px;display:grid;place-items:center;background:var(--navy);color:var(--coral);font:600 28px var(--display);transition:transform .3s var(--ease)}
        .db-new:hover{border-color:var(--coral);background:rgba(255,107,74,.06)}
        .db-new:hover span:first-child{transform:rotate(90deg)}
        .db-favs{display:grid;grid-template-columns:1fr 1fr;gap:28px;margin-top:48px;padding-top:32px;border-top:1.5px solid var(--ink)}
        .db-fav-list{display:flex;gap:8px;flex-wrap:wrap;margin-top:12px}
        .welcome-paths{display:grid;grid-template-columns:repeat(3,1fr);gap:16px}
        .wpath{display:flex;flex-direction:column;border-radius:var(--r-lg);overflow:hidden;background:var(--paper);border:1px solid var(--line);transition:transform .3s var(--ease),box-shadow .3s}
        .wpath:hover{transform:translateY(-4px);box-shadow:var(--shadow-lg)}
        .wpath > div:last-child{padding:18px;display:grid;gap:6px}
        .wpath .n{font:600 13px var(--display);color:var(--coral-ink)}
        @media(max-width:900px){.welcome-paths,.db-favs{grid-template-columns:1fr}}
      `}</style>
    </main>
  );
}

function Welcome({ favorites }: { favorites: number }) {
  const paths = [
    { href: "/creer", n: "01", t: "Décrire mon idée", d: "Une phrase : le type, le métier et les fonctions sont reconnus, et ton SaaS est assemblé.", design: "aurora" },
    { href: "/nouveau", n: "02", t: "Construire pas à pas", d: "Type, design, personnalisation, fonctions, vérification : cinq étapes guidées.", design: "maison" },
    { href: "/idees", n: "03", t: "Trouver une idée", d: `216 idées de micro-SaaS${favorites ? ` (${favorites} en favori)` : ""}, avec la première action de validation.`, design: "neon" },
  ];
  return (
    <div className="welcome-paths">
      {paths.map((p, i) => (
        <Reveal key={p.href} delay={i}>
          <Link href={p.href} className="wpath">
            <DesignThumb input={{ ...EXEMPLES[i * 3]!, design: p.design }} />
            <div><span className="n">{p.n}</span><h2 style={{ fontSize: 22 }}>{p.t}</h2><p className="mut small">{p.d}</p></div>
          </Link>
        </Reveal>
      ))}
    </div>
  );
}
