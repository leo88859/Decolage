import Link from "next/link";
import "./legal.css";
import { dateFr, LEGAL, LEGAL_PAGES, supportContact, VERSIONS, type LegalDoc } from "@/data/legal";

/** Adresse e-mail cliquable ; rien n'est affiché tant qu'elle n'est pas renseignée dans src/data/legal.ts. */
export function Mail({ v = LEGAL.email }: { v?: string }) {
  return v ? <a href={`mailto:${v}`}>{v}</a> : null;
}

export { supportContact };

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
        {children}
      </article>
    </main>
  );
}
