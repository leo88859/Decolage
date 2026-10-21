import type { Metadata } from "next";
import Link from "next/link";
import { DesignGallery } from "@/components/DesignGallery";
import { HeroFacts, PageHero } from "@/components/PageHero";
import { Reveal } from "@/components/ui";
import { DESIGNS } from "@/data/designs";
import { MODULE_BY_ID } from "@/data/modules";
import { TEMPLATES } from "@/data/templates";
import { REVENUE_LABEL } from "@/lib/modules";

export const metadata: Metadata = { title: "Galerie des designs" };

export default function Modeles() {
  return (
    <main className="page">
      <PageHero
        tone="navy"
        eyebrow="Découvrir · Galerie"
        title={<>{DESIGNS.length} designs, <span className="serif">10 caractères</span>.</>}
        lead="Chaque design change le menu, le tableau de bord, les boutons, les formulaires, les fonds et les animations, sur toutes les pages de ton SaaS. Les aperçus sont de vrais prototypes cliquables."
        aside={<HeroFacts facts={[[DESIGNS.length, "designs complets"], [4, "structures de menu"], [10, "tableaux de bord"], [TEMPLATES.length, "types de SaaS"]]} />}
      >
        <Link href="/creer" className="btn btn-coral">Partir de mon idée <span className="arrow">→</span></Link>
        <a href="#types" className="btn btn-ghost">Voir les types de SaaS</a>
      </PageHero>

      <div className="container">
        <DesignGallery />
      </div>

      <section className="types-band" id="types">
        <div className="container">
          <Reveal className="sec-head-sm">
            <span className="eyebrow">Types de SaaS</span>
            <h2 className="h-page" style={{ marginTop: 10 }}>{TEMPLATES.length} structures prêtes, <span className="serif">à habiller</span> avec n&apos;importe quel design.</h2>
            <p className="mut" style={{ marginTop: 10, maxWidth: 640 }}>Le type définit les pages, les rôles, les briques obligatoires et les données d&apos;exemple. Le design définit l&apos;apparence. Les deux se combinent librement.</p>
          </Reveal>
          <ol className="types-list">
            {TEMPLATES.map((t, i) => (
              <Reveal as="li" key={t.id} delay={i % 4} className="type-row">
                <span className="type-n">{String(i + 1).padStart(2, "0")}</span>
                <span className="glyph">{t.glyph}</span>
                <div className="type-main">
                  <div className="row" style={{ gap: 8 }}>
                    <h3>{t.nom}</h3>
                    <span className="tiny mut">{REVENUE_LABEL[t.revenu]}</span>
                    {t.premium && <span className="badge badge-coral">Offre payante</span>}
                  </div>
                  <p className="mut small">{t.description}</p>
                  <div className="row type-chips">
                    {t.pages.map((p) => <span key={p.id} className="badge badge-line">{p.titre}</span>)}
                    {t.modules.requis.map((m) => <span key={m} className="badge badge-dark" title="Brique obligatoire">{MODULE_BY_ID[m].nom}</span>)}
                  </div>
                </div>
                <Link href={`/nouveau?modele=${t.id}`} className="btn btn-ghost btn-sm type-go">Utiliser <span className="arrow">→</span></Link>
              </Reveal>
            ))}
          </ol>
          <p className="tiny mut" style={{ marginTop: 18 }}>Badge foncé : brique obligatoire pour ce type.</p>
        </div>
      </section>
    </main>
  );
}
