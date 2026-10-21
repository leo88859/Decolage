import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { DesignThumb } from "@/components/DesignThumb";
import { FavButton } from "@/components/FavButton";
import { HeroFacts, PageHero } from "@/components/PageHero";
import { Dots, Reveal } from "@/components/ui";
import { DESIGN_BY_ID } from "@/data/designs";
import { CATEGORIES, IDEA_BY_ID, IDEAS } from "@/data/ideas";
import { TEMPLATE_BY_ID } from "@/data/templates";
import { AUDIENCE_LABEL, BUDGET_LABEL, DIFFICULTY_LABEL, LEVEL_LABEL } from "@/lib/labels";
import { REVENUE_LABEL } from "@/lib/modules";
import { analyse } from "@/lib/remplissage";

export const dynamicParams = false;
export const generateStaticParams = () => IDEAS.map((i) => ({ id: i.id }));

export async function generateMetadata({ params }: PageProps<"/idees/[id]">): Promise<Metadata> {
  const i = IDEA_BY_ID[(await params).id];
  return i ? { title: i.nom, description: i.description } : {};
}

export default async function IdeaPage({ params }: PageProps<"/idees/[id]">) {
  const i = IDEA_BY_ID[(await params).id];
  if (!i) notFound();
  const t = TEMPLATE_BY_ID[i.template];
  const cat = CATEGORIES.find((c) => c.id === i.categorie)!;
  const similar = IDEAS.filter((x) => x.categorie === i.categorie && x.id !== i.id).slice(0, 3);
  // Même moteur que la page « Créer » : métier et design proposés à partir de la description.
  const a = analyse(`${i.description} ${i.cible}`);
  const design = DESIGN_BY_ID[a.design]!;
  const creer = `/creer?q=${encodeURIComponent(i.description)}`;

  return (
    <main className="page">
      <PageHero
        tone="navy"
        eyebrow={`Découvrir · ${cat.nom}`}
        title={i.nom}
        lead={i.description}
        aside={<HeroFacts facts={[[`${i.semaines} sem.`, "durée indicative"], [BUDGET_LABEL[i.budget], "budget indicatif"], [DIFFICULTY_LABEL[i.difficulte], "difficulté"], [AUDIENCE_LABEL[i.public], "public"]]} />}
      >
        <Link href={creer} className="btn btn-coral btn-lg">Créer ce SaaS <span className="arrow">→</span></Link>
        <Link href={`/nouveau?idee=${i.id}`} className="btn btn-ghost">Pas à pas</Link>
        <FavButton id={i.id} />
      </PageHero>

      <div className="container">
        <div className="crumbs"><Link href="/idees">Idées</Link> / <Link href={`/idees?categorie=${cat.id}`}>{cat.nom}</Link> / <span>{i.nom}</span></div>

        <Reveal className="if-problem">
          <span className="eyebrow">Le problème</span>
          <p className="serif">« {i.probleme} »</p>
          <span className="small mut">Pour qui : {i.cible}</span>
        </Reveal>

        <div className="if-grid">
          <Reveal className="if-preview">
            <div className="row between" style={{ marginBottom: 12 }}>
              <div><span className="eyebrow">À quoi ça pourrait ressembler</span><h2 className="h-sec" style={{ marginTop: 8 }}>{t.nom} · design {design.nom}</h2></div>
              <Link href={creer} className="btn btn-sm">Personnaliser <span className="arrow">→</span></Link>
            </div>
            <div className="dg-frame"><DesignThumb input={{ idee: i.description, type: i.template, secteur: a.secteur.id, nom: i.nom, design: design.id }} width={1180} /></div>
            <p className="tiny mut" style={{ marginTop: 8 }}>Vrai prototype généré avec les données d&apos;exemple du métier « {a.secteur.nom} ». Tout se change ensuite.</p>
          </Reveal>
          <Reveal className="if-side" delay={1}>
            <div className="kv"><span className="mut">Difficulté</span><span className="row" style={{ gap: 8 }}>{DIFFICULTY_LABEL[i.difficulte]} <Dots value={i.difficulte} label="Difficulté" /></span></div>
            <div className="kv"><span className="mut">Niveau technique</span><b>{LEVEL_LABEL[i.niveau]}</b></div>
            <div className="kv"><span className="mut">Modèle économique</span><b>{REVENUE_LABEL[i.modele]}</b></div>
            <div className="kv"><span className="mut">Type conseillé</span><b>{t.nom}</b></div>
            <p className="tiny mut" style={{ marginTop: 8 }}>Estimations indicatives, non garanties.</p>
            <div className="if-validate">
              <span className="eyebrow">Première action de validation</span>
              <p>{i.validation}</p>
              <Link href="/guide#valider" className="tiny" style={{ textDecoration: "underline" }}>Le guide pour valider une idée →</Link>
            </div>
          </Reveal>
        </div>

        <div className="if-cols">
          <Reveal className="if-block"><h2 className="h-sec">Exemple d&apos;utilisation</h2><p className="serif" style={{ fontSize: 20, marginTop: 10 }}>« {i.exemple} »</p></Reveal>
          <Reveal className="if-block" delay={1}><h2 className="h-sec">Fonctionnalités du MVP</h2><ul className="list blue" style={{ marginTop: 12 }}>{i.mvp.map((m) => <li key={m}>{m}</li>)}</ul></Reveal>
          <Reveal className="if-block"><h2 className="h-sec">Principaux risques</h2><ul className="list warn" style={{ marginTop: 12 }}>{i.risques.map((r) => <li key={r}>{r}</li>)}</ul></Reveal>
          <Reveal className="if-block" delay={1}><h2 className="h-sec">Compétences utiles</h2><div className="row" style={{ marginTop: 12, gap: 6 }}>{i.competences.map((c) => <span key={c} className="badge">{c}</span>)}</div></Reveal>
          <Reveal className="if-block"><h2 className="h-sec">Concurrence à étudier</h2><p style={{ marginTop: 10 }}>{i.concurrence}</p><p className="tiny mut" style={{ marginTop: 8 }}>Piste de recherche, pas une analyse de marché.</p></Reveal>
        </div>

        {similar.length > 0 && (
          <section style={{ marginTop: 56 }}>
            <h2 className="h-sec" style={{ marginBottom: 16 }}>Dans la même catégorie</h2>
            <div className="grid">{similar.map((s) => <Link key={s.id} href={`/idees/${s.id}`} className="panel lift"><b>{s.nom}</b><p className="mut small" style={{ marginTop: 6 }}>{s.description}</p></Link>)}</div>
          </section>
        )}
      </div>
      <style>{`
        .phero .fav-btn,.phero .btn-ghost{--fg:#fff}
        .if-problem{margin:8px 0 32px;padding:34px 0;border-top:1.5px solid var(--ink);border-bottom:1px solid var(--line);display:grid;gap:12px}
        .if-problem p{font-size:clamp(24px,3.2vw,38px);line-height:1.2;max-width:900px}
        .if-grid{display:grid;grid-template-columns:minmax(0,1fr) 300px;gap:24px;align-items:start}
        .if-side{position:sticky;top:84px;padding:20px;border-radius:var(--r-lg);background:var(--paper);border:1px solid var(--line)}
        .if-validate{margin-top:16px;padding:16px;border-radius:14px;background:var(--coral);color:var(--navy);display:grid;gap:8px}
        .if-validate .eyebrow{color:var(--navy)}
        .if-validate p{font-weight:600}
        .if-cols{columns:2 340px;column-gap:24px;margin-top:40px}
        .if-block{break-inside:avoid;margin-bottom:24px;padding:22px;border-radius:var(--r-lg);background:var(--paper);border:1px solid var(--line)}
        .if-block:nth-child(3n+1){background:var(--cream-2);border-color:transparent}
        @media(max-width:900px){.if-grid{grid-template-columns:minmax(0,1fr)}.if-side{position:static}}
      `}</style>
    </main>
  );
}
