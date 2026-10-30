"use client";

import Link from "next/link";
import { useVitrine } from "./CartProvider";
import { countArticles, mailLink, telLink, whatsappLink, type BoutiquePub } from "./logic";

/** En-tête de la boutique : logo, nom, lien du panier avec le nombre d'articles. */
export function VitrineHeader() {
  const { catalogue, lignes, pret } = useVitrine();
  const b = catalogue.boutique;
  const n = pret ? countArticles(lignes) : 0;
  return (
    <header className="vt-head">
      <div className="vt-wrap">
        <Link href={`/b/${b.slug}`} className="vt-brand">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {b.logo && /^https:\/\//i.test(b.logo) ? <img src={b.logo} alt="" className="vt-logo" width={40} height={40} /> : null}
          <span>{b.nom}</span>
        </Link>
        <Link href={`/b/${b.slug}/panier`} className="vt-cartlink" aria-label={`Panier, ${n} article${n > 1 ? "s" : ""}`}>
          <span aria-hidden="true">Panier</span>
          <span className="vt-count" aria-hidden="true">{n}</span>
        </Link>
      </div>
    </header>
  );
}

/** Boutons de contact direct : uniquement ceux que le commerçant a renseignés. */
export function ContactLinks({ b, message }: { b: Pick<BoutiquePub, "whatsapp" | "email" | "telephone" | "nom">; message?: string }) {
  const wa = whatsappLink(b.whatsapp, message ?? `Bonjour ${b.nom}, `);
  const tel = telLink(b.telephone);
  const mail = mailLink(b.email);
  if (!wa && !tel && !mail) return null;
  return (
    <ul className="vt-contact" aria-label="Contacter la boutique">
      {wa ? <li><a className="vt-btn sm" href={wa} target="_blank" rel="noopener noreferrer">WhatsApp<span className="sr-only"> (nouvel onglet)</span></a></li> : null}
      {mail ? <li><a className="vt-btn sm alt" href={mail}>E-mail : {b.email}</a></li> : null}
      {tel ? <li><a className="vt-btn sm alt" href={tel}>Téléphone : {b.telephone}</a></li> : null}
    </ul>
  );
}
