import type { Metadata } from "next";
import Link from "next/link";
import { Apprendre } from "@/components/Apprendre";
import { GuideView } from "@/components/GuideView";
import { HeroFacts, PageHero } from "@/components/PageHero";
import { PARCOURS } from "@/data/parcours";
import { defaultConfig } from "@/lib/config";
import { defaultPricing } from "@/lib/pricing";

export const metadata: Metadata = { title: "Apprendre", description: "Valider une idée, définir un MVP, choisir un prix, lancer son produit et le mettre en production : conseils et checklists." };

const TOOLS = [
  ["Supabase", "La base de données et les comptes utilisateurs. Tes données sont protégées par des règles d'accès."],
  ["Stripe", "Les paiements par carte et les abonnements. Ton site ne voit jamais les numéros de carte."],
  ["Vercel", "L'hébergement : ton site est mis en ligne à chaque modification de ton code."],
  ["GitHub", "Le dépôt où est rangé le code de ton SaaS, avec son historique."],
  ["Nom de domaine", "L'adresse de ton site (ex. monsaas.fr), louée chaque année chez un registraire."],
];

export default function Guide() {
  // Exemple générique : un SaaS avec comptes et abonnement. Chaque projet a son guide adapté.
  const cfg = defaultConfig("abonnement");
  const checks = PARCOURS.reduce((n, p) => n + p.etapes.reduce((m, e) => m + e.checks.length, 0), 0);
  return (
    <main className="page">
      <PageHero
        tone="paper"
        eyebrow="Apprendre"
        title={<>Du doute au lancement, <span className="serif">étape par étape</span>.</>}
        lead="Quatre parcours pratiques pour valider ton idée, définir ton MVP, choisir ton prix et lancer ton produit, puis le guide pour le mettre en production. Coche au fur et à mesure : ta progression est enregistrée."
        aside={<HeroFacts facts={[[PARCOURS.length + 1, "parcours"], [PARCOURS.reduce((n, p) => n + p.etapes.length, 0), "étapes"], [checks, "points à cocher"], ["Libre", "accès sans offre payante"]]} />}
      >
        <a href="#valider" className="btn">Commencer par valider mon idée <span className="arrow">→</span></a>
        <a href="#production" className="btn btn-ghost">Mise en production</a>
      </PageHero>

      <div className="container">
        <Apprendre />

        <section id="production" className="ap-prod">
          <div className="ap-head" style={{ marginBottom: 20 }}>
            <span className="ap-n">05</span>
            <div>
              <h2>Mettre un SaaS en production</h2>
              <p className="mut">Base de données, paiements, hébergement, domaine et pages légales. Ouvre l&apos;onglet <b>« Mise en production »</b> d&apos;un projet pour obtenir ce guide adapté à ton SaaS, avec ton script SQL et tes produits Stripe.</p>
            </div>
          </div>
          <div className="ap-tools">
            {TOOLS.map(([n, d]) => <div key={n}><b>{n}</b><p className="mut small">{d}</p></div>)}
          </div>
          <div className="row between" style={{ margin: "28px 0 14px" }}>
            <h3 className="h-sec">Exemple : un SaaS avec comptes et abonnement</h3>
            <Link href="/tableau-de-bord" className="btn btn-ghost btn-sm">Ouvrir un de mes projets</Link>
          </div>
          <div className="narrow" style={{ margin: 0 }}><GuideView cfg={cfg} pricing={defaultPricing(cfg)} /></div>
        </section>
      </div>
    </main>
  );
}
