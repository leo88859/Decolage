import Link from "next/link";
import { DesignShowcase } from "@/components/DesignShowcase";
import { DesignThumb } from "@/components/DesignThumb";
import { EXEMPLES } from "@/data/exemples";
import { IdeaBox } from "@/components/IdeaBox";
import { OfferCards } from "@/components/OfferCards";
import { LogoMark, Reveal } from "@/components/ui";
import { DESIGNS } from "@/data/designs";
import { IDEAS } from "@/data/ideas";
import { SECTEURS } from "@/data/secteurs";
import { TEMPLATES } from "@/data/templates";
import { PAID_PLANS, PLANS } from "@/lib/plans";
import "./marketing.css";

const STEPS = [
  ["Décris ton idée", "Une phrase suffit. Décollage reconnaît le type de produit et ton métier, et te propose un nom."],
  ["Choisis ton design", "10 designs complets, chacun avec son menu, son tableau de bord et ses animations. Tu vois ton SaaS dedans avant de choisir."],
  ["Ton SaaS est prêt", "Application interactive, page de vente rédigée, données adaptées à ton métier. Tout reste modifiable."],
  ["Lance-le", "Publication en un clic, vraie liste d'attente, guide pas à pas pour Stripe, Supabase et le nom de domaine."],
];


const FAQ = [
  ["Décollage utilise-t-il une intelligence artificielle ?", "Non. Tout repose sur des modèles, des textes et des briques écrits à l'avance, et sur des règles programmées. Le résultat est instantané, et la même idée donne toujours le même SaaS."],
  ["Que puis-je faire sans payer ?", "Décrire ton idée, voir ton SaaS dans les 10 designs et l'essayer en aperçu interactif, et parcourir le catalogue d'idées. Pour générer ton SaaS, le garder, le modifier et le publier, il faut une offre payante, dès 2,99 € par mois."],
  ["Mon SaaS est-il vraiment en ligne ?", "Avec une offre payante, tu publies en un clic ta page de vente et ta démo sur une adresse publique, avec une vraie liste d'attente. Pour une application complète (comptes, base de données, paiements de tes clients), le guide de mise en production t'accompagne étape par étape."],
  ["Puis-je créer n'importe quelle application ?", "Non, et on préfère être clairs : ton produit est assemblé à partir de 16 types de SaaS et de 17 briques réellement programmées. C'est ce qui rend le résultat fiable."],
  ["Puis-je résilier quand je veux ?", "Oui. Sans engagement : tu changes d'offre ou tu résilies en ligne, à tout moment. Tes projets restent exportables."],
];

function Words({ text, start = 0 }: { text: string; start?: number }) {
  return <>{text.split(" ").map((w, i) => <span key={i} className="word" style={{ "--w": start + i } as React.CSSProperties}>{w}&nbsp;</span>)}</>;
}

const euros = (n: number) => n.toLocaleString("fr-FR", { minimumFractionDigits: 2 });

export default function Home() {
  return (
    <main>
      <section className="hero">
        <div className="halo h1" />
        <div className="halo h2" />
        <div className="container">
          <div className="hero-head">
            <span className="hero-pill"><b>Sans IA</b> Sans code · sans clé API</span>
            <h1>
              <Words text="De ton idée à ton SaaS." />
              <br />
              <Words text="Sans partir de" start={6} />
              <span className="word serif" style={{ "--w": 9 } as React.CSSProperties}>zéro.</span>
            </h1>
            <p className="lead">
              Décollage transforme une phrase en SaaS complet : application interactive, tableau de bord, page de vente et plan de lancement,
              dans le design de ton choix.
            </p>
            <IdeaBox />
          </div>
          <Reveal>
            <DesignShowcase />
          </Reveal>
        </div>
      </section>

      <section className="sec">
        <div className="container">
          <Reveal className="sec-head center center">
            <span className="eyebrow">Comment ça marche</span>
            <h2>De ton idée à ton SaaS, <span className="serif">en 4 étapes</span>.</h2>
          </Reveal>
          <ol className="process p4" style={{ padding: 0 }}>
            {STEPS.map(([t, d], i) => (
              <Reveal as="li" key={t} delay={i}>
                <div className="n">{i + 1}</div>
                <div>
                  <h3 style={{ fontSize: 20, marginBottom: 6 }}>{t}</h3>
                  <p className="mut small">{d}</p>
                </div>
              </Reveal>
            ))}
          </ol>
        </div>
      </section>

      <section className="sec sec-dark">
        <div className="halo h1" style={{ top: "auto", bottom: -260, left: "-10%" }} />
        <div className="halo h2" style={{ top: -120, right: "-8%" }} />
        <div className="container">
          <Reveal className="sec-head center center">
            <span className="eyebrow">10 designs</span>
            <h2>Chaque design a son <span className="serif">propre caractère</span>.</h2>
            <p>Un menu, un tableau de bord et des animations différents. Ci-dessous, 10 idées réelles, remplies automatiquement : ce sont de vrais prototypes, pas des images.</p>
          </Reveal>
          <div className="dz-grid">
            {DESIGNS.slice(0, 6).map((d, i) => {
              const ex = EXEMPLES[i % EXEMPLES.length]!;
              return (
                <Reveal key={d.id} delay={i % 3}>
                  <Link href={`/creer?q=${encodeURIComponent(ex.idee)}&design=${d.id}`} className="dz-card">
                    <DesignThumb input={{ ...ex, design: d.id }} />
                    <div className="dz-meta">
                      <span className="dz-sw" style={{ background: `linear-gradient(135deg, ${d.couleurs.primaire}, ${d.couleurs.accent})` }} />
                      <span style={{ minWidth: 0 }}>
                        <b>{d.nom}</b>
                        <span className="dz-ex">« {ex.idee} »</span>
                      </span>
                      <span className="arrow">→</span>
                    </div>
                  </Link>
                </Reveal>
              );
            })}
          </div>
          <div className="row" style={{ justifyContent: "center", marginTop: 32 }}>
            <Link href="/modeles" className="btn btn-coral btn-lg">Voir les {DESIGNS.length} designs en grand <span className="arrow">→</span></Link>
            <Link href="/modeles#types" className="btn btn-ghost btn-lg" style={{ "--fg": "#fff", borderColor: "rgba(255,255,255,.3)" } as React.CSSProperties}>Les types de SaaS</Link>
          </div>
        </div>
      </section>

      <section className="sec sec-paper">
        <div className="container">
          <Reveal className="sec-head">
            <span className="eyebrow">Tout est inclus</span>
            <h2>Pas seulement un joli site : <span className="serif">de quoi lancer</span>.</h2>
          </Reveal>
          <div className="bento">
            <Reveal className="b-a">
              <span className="eyebrow" style={{ color: "var(--coral)" }}>Remplissage automatique</span>
              <h3 style={{ fontSize: 30 }}>Ton métier, tes clients, tes textes.</h3>
              <p className="mut">Décollage reconnaît {SECTEURS.length} métiers et {TEMPLATES.length} types de SaaS. Les pages, les données d&apos;exemple, la page de vente et la FAQ sont écrites pour ton activité.</p>
              <div className="chips">{SECTEURS.slice(0, 12).map((s) => <span key={s.id}>{s.nom}</span>)}</div>
            </Reveal>
            <Reveal className="b-b" delay={1}>
              <h3>Publication en un clic</h3>
              <p>Une adresse publique pour ta page de vente et ta démo, avec une vraie liste d&apos;attente pour récolter tes premiers inscrits.</p>
            </Reveal>
            <Reveal className="b-c" delay={2}>
              <h3>Constructeur en direct</h3>
              <p className="mut small">Couleurs, logo, police, pages et briques : l&apos;aperçu change à chaque clic.</p>
            </Reveal>
            <Reveal className="b-d" delay={3}>
              <div className="big-num" style={{ fontSize: 56 }}>{DESIGNS.length}</div>
              <p>designs</p>
            </Reveal>
            <Reveal className="b-e" delay={1}>
              <h3>Labo des prix</h3>
              <p className="mut small">Tes offres, la comparaison et des scénarios de revenus.</p>
              <div className="bars" aria-hidden="true">{[30, 45, 40, 62, 70, 88].map((h, i) => <i key={i} style={{ height: `${h}%`, animationDelay: `${i * 80}ms` }} />)}</div>
            </Reveal>
            <Reveal className="b-f" delay={2}>
              <h3>Guide de mise en production</h3>
              <p className="mut small">Stripe, Supabase, hébergement, domaine, mentions légales : chaque étape expliquée pour ton projet.</p>
            </Reveal>
            <Reveal className="b-g" delay={3}>
              <h3>Feuille de route et lancement</h3>
              <p className="mut small">Validation de l&apos;idée, tâches adaptées à ton SaaS et calendrier de lancement.</p>
            </Reveal>
          </div>
        </div>
      </section>

      <section className="sec" id="offres">
        <div className="container">
          <Reveal className="sec-head center center">
            <span className="eyebrow">Offres</span>
            <h2>Ton premier SaaS dès <span className="serif" style={{ whiteSpace: "nowrap" }}>{euros(PLANS.solo.prix)} €</span> par&nbsp;mois.</h2>
            <p>Essaie gratuitement ton SaaS dans les 10 designs. Pour le générer, le garder et le publier, choisis ton offre : toutes donnent accès à toutes les fonctions, seule change la quantité.</p>
          </Reveal>
          <Reveal>
            <OfferCards
              plans={PAID_PLANS}
              cta={(k) => <Link href="/parametres#formule" className={`btn ${k === "pro" ? "btn-coral" : ""}`}>Choisir {PLANS[k].nom}</Link>}
            />
          </Reveal>
          <p className="center mut small" style={{ marginTop: 26 }}>Sans engagement, résiliable en ligne. <Link href="/creer" style={{ textDecoration: "underline" }}>Essayer d&apos;abord gratuitement →</Link></p>
        </div>
      </section>

      <section className="sec sec-paper">
        <div className="container narrow">
          <Reveal className="sec-head center center">
            <span className="eyebrow">Comparaison</span>
            <h2>Partir de zéro, ou décoller&nbsp;?</h2>
          </Reveal>
          <Reveal className="versus">
            <div className="zero">
              <h3>Partir de zéro</h3>
              <ul>
                <li>Une page blanche et des dizaines d&apos;onglets ouverts</li>
                <li>Des semaines avant d&apos;avoir quelque chose à montrer</li>
                <li>La page de vente repoussée à plus tard</li>
                <li>Aucune idée de l&apos;étape suivante</li>
              </ul>
            </div>
            <div className="dec">
              <h3>Avec Décollage</h3>
              <ul>
                <li>Ton SaaS visible dès la première phrase</li>
                <li>Un design pro, des animations et un vrai tableau de bord</li>
                <li>Une page de vente rédigée et publiable</li>
                <li>Un plan clair jusqu&apos;au lancement</li>
              </ul>
            </div>
          </Reveal>
        </div>
      </section>

      <section className="sec">
        <div className="container narrow faq">
          <Reveal className="sec-head center center"><span className="eyebrow">FAQ</span><h2>Questions fréquentes</h2></Reveal>
          {FAQ.map(([q, r]) => (
            <details key={q}><summary>{q}</summary><p>{r}</p></details>
          ))}
        </div>
      </section>

      <section className="sec" style={{ paddingTop: 0 }}>
        <div className="container">
          <Reveal className="final">
            <h2>Ton SaaS commence <span className="serif">maintenant</span>.</h2>
            <p style={{ fontSize: 18, margin: "18px auto 30px", maxWidth: 540 }}>Décris ton idée, regarde-la prendre vie dans 10 designs, et garde celle qui te ressemble.</p>
            <div className="row" style={{ justifyContent: "center" }}>
              <Link href="/creer" className="btn btn-dark btn-lg">Décrire mon idée <span className="arrow">→</span></Link>
              <Link href="#offres" className="btn btn-light btn-lg">Voir les offres</Link>
            </div>
            <p className="small" style={{ marginTop: 18, opacity: 0.75 }}>Pas d&apos;idée ? <Link href="/idees" style={{ textDecoration: "underline" }}>{IDEAS.length} idées t&apos;attendent</Link>.</p>
          </Reveal>
        </div>
      </section>

      <footer className="footer">
        <div className="container row between">
          <span className="logo" style={{ color: "#fff" }}><LogoMark /> Décollage</span>
          <nav className="row" aria-label="Pied de page">
            <Link href="/creer">Créer</Link>
            <Link href="/#offres">Offres</Link>
            <Link href="/idees">Idées</Link>
            <Link href="/guide">Guide</Link>
            <Link href="/tableau-de-bord">Mes projets</Link>
          </nav>
          <span>© {new Date().getFullYear()} Décollage</span>
        </div>
      </footer>
    </main>
  );
}
