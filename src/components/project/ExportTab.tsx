"use client";

import Link from "next/link";
import { download, toast } from "@/components/ui";
import { generateNextProject, generationPlan } from "@/lib/codegen";
import { projectFiles, projectJson, slug } from "@/lib/export";
import { can } from "@/lib/plans";
import { updateProject, useData } from "@/lib/store";
import type { Project } from "@/lib/types";
import { zip } from "@/lib/zip";

const FILES = [
  ["index.html + style.css", "Page de vente statique, hébergeable telle quelle."],
  ["prototype.html", "Application autonome : ouvre-la dans un navigateur, les données y sont enregistrées."],
  ["decollage.json", "Configuration complète du projet (format documenté, réimportable)."],
  ["README.md", "Contenu de l'archive et étapes pour passer en production."],
];

export function ExportTab({ project: p }: { project: Project }) {
  const { plan } = useData();
  const allowed = can(plan, "exportFichiers");
  const { gen, skipped } = generationPlan(p);
  const name = slug(p.config.nom) || "mon-saas";

  function zipAll() {
    if (!allowed) return;
    download(`${name}.zip`, zip(projectFiles(p)) as BlobPart, "application/zip");
    updateProject(p.id, (x) => x, "Export : archive téléchargée");
    toast("Archive téléchargée");
  }

  function zipNext() {
    if (!allowed) return;
    // Tout est rangé dans un dossier au nom du projet.
    const files = generateNextProject(p).map((f) => ({ name: `${name}/${f.name}`, content: f.content }));
    download(`${name}-nextjs.zip`, zip(files) as BlobPart, "application/zip");
    updateProject(p.id, (x) => x, "Export : projet Next.js téléchargé");
    toast("Projet Next.js téléchargé");
  }

  return (
    <div className="stack" style={{ gap: 22 }}>
      <section className="ex-next">
        <div>
          <span className="eyebrow">Nouveau · code source</span>
          <h2 className="h-sec" style={{ marginTop: 8 }}>Projet Next.js prêt à lancer</h2>
          <p className="mut small" style={{ marginTop: 6, maxWidth: 620 }}>
            Une vraie application React / Next.js, générée à partir de composants écrits à l&apos;avance : tes pages, ton design, tes couleurs et tes données de départ.
            Ajouter, modifier, supprimer, rechercher, importer et exporter en CSV fonctionnent. Les données sont enregistrées dans le navigateur de chaque utilisateur.
          </p>
          <div className="row" style={{ marginTop: 14 }}>
            <button className="btn btn-coral" onClick={zipNext} disabled={!allowed}>Télécharger le projet Next.js (.zip){allowed ? "" : " · offre payante"}</button>
          </div>
          <p className="tiny mut" style={{ marginTop: 10 }}>Pour le lancer : <code className="kbd">npm install</code> puis <code className="kbd">npm run dev</code> (Node.js 20 ou plus). Les étapes de mise en ligne sont dans le README.</p>
        </div>
        <div className="ex-cols">
          <div className="ex-col ok">
            <b>Pages générées ({gen.length})</b>
            <ul>{gen.map((g) => <li key={g.href}>{g.titre} <span className="tiny mut">{g.href}</span></li>)}</ul>
          </div>
          <div className="ex-col no">
            <b>Pas inclus dans le code</b>
            <ul>
              <li>Comptes utilisateurs réels (pas de connexion)</li>
              <li>Base de données partagée entre appareils</li>
              <li>Paiements (offres affichées à titre indicatif)</li>
              {skipped.map((s) => <li key={s}>Page « {s} » (reste dans le prototype)</li>)}
            </ul>
          </div>
        </div>
      </section>

      <div className="grid-2" style={{ alignItems: "start" }}>
        <section className="panel stack" style={{ gap: 14 }}>
          <h2 className="h-sec">Archive du prototype</h2>
          <div className="stack" style={{ gap: 8 }}>
            {FILES.map(([n, d]) => <div key={n} className="kv"><b className="small">{n}</b><span className="small mut" style={{ textAlign: "right" }}>{d}</span></div>)}
          </div>
          <div className="row">
            <button className="btn" onClick={zipAll} disabled={!allowed}>Télécharger l&apos;archive .zip{allowed ? "" : " · offre payante"}</button>
            <button className="btn btn-ghost" onClick={() => { download(`${name}.decollage.json`, projectJson(p), "application/json"); toast("Configuration exportée"); }}>Configuration JSON seule</button>
          </div>
          {!allowed && <p className="hint">Les exports de fichiers sont inclus dans les offres payantes (dès 2,99 €/mois). La configuration JSON reste toujours exportable gratuitement : tes données t&apos;appartiennent. <Link href="/parametres" style={{ textDecoration: "underline" }}>Voir les offres</Link></p>}
        </section>

        <section className="panel">
          <h2 className="h-sec" style={{ marginBottom: 12 }}>Les trois niveaux</h2>
          <div className="stack" style={{ gap: 12 }}>
            <Level n={1} ok title="Prototype personnalisé" text="Aperçu interactif dans ton design, avec tes données enregistrées." />
            <Level n={2} ok title="Projet exportable et exécutable" text="Projet Next.js qui compile et fonctionne seul, données dans le navigateur." />
            <Level n={3} title="Application en ligne multi-utilisateurs" text="Comptes, base de données partagée et paiements : à brancher (Supabase, Stripe…). Pas encore généré par Décollage." />
          </div>
        </section>
      </div>
      <style>{`
        .ex-next{display:grid;grid-template-columns:minmax(0,1.1fr) minmax(0,.9fr);gap:24px;padding:26px;border-radius:var(--r-lg);background:var(--navy);color:#fff}
        .ex-next .mut{color:rgba(255,255,255,.7)}
        .ex-next .kbd{color:var(--ink)}
        .ex-cols{display:grid;gap:12px}
        .ex-col{padding:16px;border-radius:14px;background:rgba(255,255,255,.06);border-top:3px solid var(--c)}
        .ex-col.ok{--c:#2ecf8f}.ex-col.no{--c:var(--coral)}
        .ex-col ul{margin:8px 0 0;padding-left:18px;display:grid;gap:4px;font-size:14px}
        @media(max-width:900px){.ex-next{grid-template-columns:minmax(0,1fr)}}
      `}</style>
    </div>
  );
}

function Level({ n, ok, title, text }: { n: number; ok?: boolean; title: string; text: string }) {
  return (
    <div className="row" style={{ flexWrap: "nowrap", alignItems: "flex-start" }}>
      <span className="glyph" style={{ width: 36, height: 36, fontSize: 14, background: ok ? "var(--ok)" : "var(--cream-2)", color: ok ? "#fff" : "var(--mut)" }}>{ok ? "✓" : n}</span>
      <div><b>{n} · {title}</b><p className="small mut">{text}</p></div>
    </div>
  );
}
