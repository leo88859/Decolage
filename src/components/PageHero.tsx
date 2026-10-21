/**
 * En-tête de page : un bandeau pleine largeur dont l'ambiance change selon l'espace du site
 * (bleu nuit pour Découvrir, bleu pour Construire, corail pour Mes projets, papier pour Apprendre).
 * Les détails graphiques (grille de plan, repères de coupe, règle) évoquent l'assemblage d'un produit.
 */
export function PageHero({ tone = "navy", eyebrow, title, lead, children, aside, compact }: {
  tone?: "navy" | "blue" | "coral" | "paper";
  eyebrow: string;
  title: React.ReactNode;
  lead?: React.ReactNode;
  children?: React.ReactNode;
  aside?: React.ReactNode;
  compact?: boolean;
}) {
  return (
    <section className={`phero ${tone} ${compact ? "compact" : ""}`}>
      <div className="phero-grid" aria-hidden="true" />
      <div className={`container phero-in ${aside ? "" : "solo"}`}>
        <div className="phero-text page-enter">
          <span className="eyebrow">{eyebrow}</span>
          <h1>{title}</h1>
          {lead && <p className="lead">{lead}</p>}
          {children && <div className="phero-actions">{children}</div>}
        </div>
        {aside && <div className="phero-aside page-enter" style={{ animationDelay: "120ms" }}>{aside}</div>}
      </div>
      <div className="phero-ruler" aria-hidden="true" />
    </section>
  );
}

/** Petits chiffres réels affichés dans un en-tête (jamais de statistiques inventées). */
export function HeroFacts({ facts }: { facts: [string | number, string][] }) {
  return (
    <dl className="phero-facts">
      {facts.map(([v, l]) => <div key={l}><dt>{v}</dt><dd>{l}</dd></div>)}
    </dl>
  );
}
