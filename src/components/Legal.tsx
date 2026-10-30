import Link from "next/link";
import "./legal.css";
import { champsManquants, dateFr, LEGAL, LEGAL_PAGES, supportContact, VERSIONS, type LegalDoc } from "@/data/legal";

/** Valeur légale, ou repère visible tant qu'elle n'est pas renseignée dans src/data/legal.ts. */
export function V({ v, label }: { v: string; label: string }) {
  return v ? <>{v}</> : <mark className="legal-todo">{label} : à compléter</mark>;
}

/** Valeur PROPOSÉE mais pas confirmée : jamais présentée comme un fait. */
export function P({ v, proposition }: { v: string; proposition: string }) {
  return v ? <>{v}</> : <mark className="legal-todo">{proposition} (proposition, à confirmer)</mark>;
}

/** Adresse e-mail cliquable, ou repère « à compléter » si elle n'est pas renseignée. */
export function Mail({ v = LEGAL.email, label = "Adresse e-mail de contact" }: { v?: string; label?: string }) {
  return v ? <a href={`mailto:${v}`}>{v}</a> : <mark className="legal-todo">{label} : à compléter</mark>;
}

export { supportContact };

/** Bandeau « éléments à compléter avant publication » : affiché UNIQUEMENT s'il reste des champs vides. */
export function TodoBanner() {
  const manquants = champsManquants();
  if (!manquants.length) return null;
  return (
    <aside className="legal-banner" role="note" aria-label="Éléments à compléter avant publication">
      <b>Éléments à compléter avant publication</b>
      <p>Cette page est un brouillon : les informations ci-dessous ne sont pas encore renseignées par l&apos;éditeur et ne sont pas inventées.</p>
      <ul>
        {manquants.map((m) => (
          <li key={m.cle}>{m.label}{m.note ? <span> ({m.note})</span> : null} <span className="legal-where">: {m.pages}</span></li>
        ))}
      </ul>
    </aside>
  );
}

export function LegalPage({ title, doc, children }: { title: string; doc: LegalDoc; children: React.ReactNode }) {
  return (
    <main className="page">
      <article className="container legal">
        <nav className="legal-nav" aria-label="Pages légales">
          {LEGAL_PAGES.map((p) => (
            <Link key={p.href} href={p.href} aria-current={p.doc === doc ? "page" : undefined}>{p.label}</Link>
          ))}
        </nav>
        <h1>{title}</h1>
        <p className="mut small">Dernière mise à jour : {dateFr(VERSIONS[doc])} (version {VERSIONS[doc]})</p>
        <TodoBanner />
        {children}
      </article>
    </main>
  );
}
