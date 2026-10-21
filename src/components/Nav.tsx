"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { useFeatures } from "@/components/CloudSync";
import { LogoMark, toast } from "@/components/ui";
import { signOut, useCloud } from "@/lib/cloud";

type Item = { href: string; label: string; desc: string; ic: string };
type Group = { id: string; label: string; href: string; match: string[]; items?: Item[] };

const GROUPS: Group[] = [
  {
    id: "decouvrir", label: "Découvrir", href: "/idees", match: ["/idees", "/modeles"],
    items: [
      { href: "/idees", label: "Catalogue d'idées", desc: "216 idées de micro-SaaS, filtres et favoris", ic: "✦" },
      { href: "/modeles", label: "Galerie des designs", desc: "10 designs complets à essayer en grand", ic: "◐" },
      { href: "/idees#categories", label: "Catégories", desc: "Explorer par univers : créateurs, étudiants…", ic: "▦" },
    ],
  },
  {
    id: "construire", label: "Construire", href: "/creer", match: ["/creer", "/nouveau", "/constructeur"],
    items: [
      { href: "/creer", label: "Depuis une idée", desc: "Une phrase, et ton SaaS est assemblé", ic: "→" },
      { href: "/nouveau", label: "Pas à pas", desc: "Type, design, fonctions, personnalisation", ic: "◇" },
      { href: "/modeles", label: "Choisir un design d'abord", desc: "Partir du look que tu préfères", ic: "◐" },
    ],
  },
  { id: "projets", label: "Mes projets", href: "/tableau-de-bord", match: ["/tableau-de-bord", "/projets"] },
  { id: "apprendre", label: "Apprendre", href: "/guide", match: ["/guide"] },
];

export function Nav() {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  const { session, syncing } = useCloud();
  const { cloud } = useFeatures();
  const dark = path === "/";
  // Le constructeur a sa propre barre d'outils plein écran.
  if (path.endsWith("/constructeur")) return null;
  const active = (g: Group) => g.match.some((m) => (m.startsWith("/") ? path.startsWith(m) : path.includes(m)));
  const close = () => setOpen(false);

  return (
    <>
      <header className={`nav ${dark ? "dark" : ""}`}>
        <div className="container nav-in">
          <Link href="/" className="logo" onClick={close}>
            <LogoMark /> Décollage
          </Link>
          <nav className="nav-links" aria-label="Navigation principale">
            {GROUPS.map((g) => g.items ? (
              <div key={g.id} className="nav-group">
                <Link href={g.href} className="nav-link" aria-current={active(g) ? "page" : undefined} aria-haspopup="true">
                  {g.label} <span className="nav-caret" aria-hidden="true">▾</span>
                </Link>
                <div className="nav-panel" role="menu">
                  {g.items.map((it) => (
                    <Link key={it.label} href={it.href} role="menuitem" className="nav-item">
                      <span className="nav-ic" aria-hidden="true">{it.ic}</span>
                      <span><b>{it.label}</b><span>{it.desc}</span></span>
                    </Link>
                  ))}
                </div>
              </div>
            ) : (
              <Link key={g.id} href={g.href} className="nav-link" aria-current={active(g) ? "page" : undefined}>{g.label}</Link>
            ))}
            {session ? (
              <details className="acct">
                <summary className="nav-link" aria-label="Mon compte">
                  <span className="acct-av">{session.email[0]?.toUpperCase()}</span>
                  {syncing && <span className="acct-sync" aria-label="Synchronisation" />}
                </summary>
                <div className="acct-menu" onClick={(e) => e.currentTarget.closest("details")?.removeAttribute("open")}>
                  <span className="tiny mut" style={{ padding: "6px 12px" }}>{session.email}</span>
                  <Link href="/parametres">Paramètres et abonnement</Link>
                  <button onClick={async () => { await signOut(); toast("Déconnecté·e"); }}>Se déconnecter</button>
                </div>
              </details>
            ) : (
              <>
                {cloud && <Link href="/connexion" className="nav-link">Connexion</Link>}
                <Link href="/parametres" className="nav-link nav-gear" aria-label="Paramètres" title="Paramètres" aria-current={path.startsWith("/parametres") ? "page" : undefined}>⚙</Link>
              </>
            )}
            <Link href="/creer" className={`btn btn-sm ${dark ? "btn-coral" : ""}`} style={{ marginLeft: 8 }}>Créer mon SaaS</Link>
            <button className="icon-btn menu-btn" aria-label="Menu" aria-expanded={open} onClick={() => setOpen(!open)}>{open ? "✕" : "☰"}</button>
          </nav>
        </div>
      </header>
      {open && (
        <nav className="mobile-menu" aria-label="Menu mobile">
          {GROUPS.map((g) => (
            <div key={g.id} className="mm-group">
              <Link href={g.href} onClick={close} className="mm-head">{g.label}</Link>
              {g.items?.map((it) => <Link key={it.label} href={it.href} onClick={close} className="mm-item">{it.label}</Link>)}
            </div>
          ))}
          <Link href="/parametres" onClick={close} className="mm-head">Paramètres</Link>
          {!session && cloud && <Link href="/connexion" onClick={close} className="mm-head">Connexion</Link>}
          {session && <button className="btn btn-ghost" onClick={async () => { close(); await signOut(); toast("Déconnecté·e"); }}>Se déconnecter</button>}
        </nav>
      )}
    </>
  );
}
