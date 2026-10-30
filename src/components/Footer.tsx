import Link from "next/link";
import "./legal.css";
import { ManageCookiesButton } from "@/components/ConsentManager";
import { FOOTER_PRODUCT_LINKS, LEGAL_PAGES } from "@/data/legal";

/** Pied de page commun : liens produit, pages légales et bouton « Gérer mes cookies ». */
export function Footer() {
  return (
    <footer className="footer site-footer">
      <div className="container sf-grid">
        <div className="sf-brand">
          <b className="sf-name">Décollage</b>
          <p>Un constructeur guidé de micro-SaaS : le moteur Décollage assemble ton projet à partir de modèles écrits à l&apos;avance.</p>
        </div>
        <nav aria-label="Pied de page : le service">
          <h2 className="sf-h">Le service</h2>
          <ul>{FOOTER_PRODUCT_LINKS.map((l) => <li key={l.href}><Link href={l.href}>{l.label}</Link></li>)}</ul>
        </nav>
        <nav aria-label="Pied de page : informations légales">
          <h2 className="sf-h">Informations légales</h2>
          <ul>
            {LEGAL_PAGES.map((l) => <li key={l.href}><Link href={l.href}>{l.label}</Link></li>)}
            <li><ManageCookiesButton className="linklike" /></li>
          </ul>
        </nav>
      </div>
      <div className="container sf-copy">© {new Date().getFullYear()} Décollage</div>
    </footer>
  );
}
