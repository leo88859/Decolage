// Kit du générateur : composants React copiés tels quels dans chaque projet généré.
// Mêmes règles que kit-data.ts : pas d'accent grave ni de « ${ » dans ces textes.

/** components/Shell.tsx — menu, barre du haut, mode sombre. */
export const SHELL_TSX = String.raw`"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { SAAS } from "@/lib/config";
import { Toasts } from "@/components/views";
import { storageError, useStore } from "@/lib/store";
import type { PageKind } from "@/lib/types";

const ICONS: Record<PageKind, string> = {
  accueil: "M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z",
  dashboard: "M4 4h7v7H4zM13 4h7v4h-7zM13 10h7v10h-7zM4 13h7v7H4z",
  table: "M4 5h16v14H4zM4 10h16M10 10v9",
  cards: "M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01",
  grid: "M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z",
  kanban: "M4 4h4v16H4zM10 4h4v10h-4zM16 4h4v13h-4z",
  agenda: "M5 6h14v14H5zM5 10h14M9 3v4M15 3v4",
  form: "M12 5v14M5 12h14",
  todo: "M4 12a8 8 0 0 1 14-5.3M20 4v4h-4M20 12a8 8 0 0 1-14 5.3M4 20v-4h4",
  goals: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8z",
  settings: "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM4 12h2M18 12h2M12 4v2M12 18v2",
  pricing: "M4 7h16v10H4zM4 11h16M8 15h3",
  login: "M10 17l5-5-5-5M15 12H3M14 4h5v16h-5",
  activity: "M12 7v5l3 2M4 12a8 8 0 1 0 2.3-5.6M4 4v4h4",
  waitlist: "M4 6h16v12H4zM4 7l8 6 8-6",
};

export function Shell({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const state = useStore();
  const [dark, setDark] = useState(false);
  useEffect(() => { document.documentElement.classList.toggle("dark", dark); }, [dark]);
  const nav = SAAS.pages.filter((p) => p.nav);
  const err = storageError();
  return (
    <>
      <aside className="side">
        <div className="brand"><span className="mark" style={{ width: 32, height: 32 }}>{SAAS.initiales}</span><b>{SAAS.nom}</b></div>
        <nav aria-label="Navigation principale">
          {nav.map((p) => (
            <Link key={p.id} href={p.href} data-t={p.titre} className={(p.href === "/" ? path === "/" : path.startsWith(p.href)) ? "on" : ""}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={ICONS[p.kind]} /></svg>
              <span>{p.titre}</span>
            </Link>
          ))}
        </nav>
        <div className="side-f"><span className="mut xs">{state.items.length} {SAAS.entite.pluriel.toLowerCase()}</span></div>
      </aside>
      <div className="wrap">
        <header className="top">
          <span className="mut sm">{SAAS.cible}</span>
          <div className="row">
            <button className="ib" onClick={() => setDark(!dark)} aria-label="Mode sombre" title="Mode sombre">◐</button>
          </div>
        </header>
        <main>
          {err && <div className="card" role="alert" style={{ marginBottom: 14, borderColor: "#e11d48" }}>{err}</div>}
          <div className="enter">{children}</div>
        </main>
      </div>
      <div className="badge-proto saved" title="Les données restent dans ce navigateur">● Données enregistrées dans ce navigateur</div>
      <Toasts />
    </>
  );
}
`;

/** CSS propre aux composants React, en plus de la feuille des prototypes. */
export const REACT_CSS = `a{color:inherit;text-decoration:none}.side a{text-decoration:none}main{flex:1}
.kc{gap:8px}.kc-open{all:unset;cursor:pointer;display:grid;gap:4px}.kc select{padding:6px 8px;font-size:12.5px}
.li{border:var(--bd);font:inherit;color:inherit}.tile{font:inherit;color:inherit;border:var(--bd)}
.chart text{font-family:inherit}.chart .bar{animation:none;transform:none}
.toasts{position:fixed;bottom:24px;left:50%;transform:translateX(-50%);display:grid;gap:8px;z-index:60;justify-items:center;pointer-events:none}
.toasts .toast.bad{background:#be123c}.toasts .toast.ok{background:#0f172a}
.err{display:block;color:#be123c;font-size:13px;font-weight:600;margin-top:4px}
.ok-msg{color:#15803d;font-weight:600}
input[aria-invalid="true"]{border-color:#be123c;box-shadow:0 0 0 3px rgba(190,18,60,.12)}
.slots{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:10px}
.slot{all:unset;box-sizing:border-box;display:grid;gap:4px;padding:12px 14px;border-radius:12px;border:var(--bd);background:var(--sf);font-size:14px;cursor:pointer}
.slot b{font-size:17px}.slot.free{border-style:dashed;color:var(--p)}.slot.free:hover,.slot.free:focus-visible{background:color-mix(in srgb,var(--p) 10%,var(--sf))}
.slot.taken{background:var(--sf2)}.slot.past{opacity:.45;cursor:default}
.fiche{display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:14px;margin:0 0 14px}.fiche dd{margin:4px 0 0;font-weight:600}
.offre-edit{display:grid;grid-template-columns:1fr auto auto;gap:8px;align-items:start;padding:10px 0;border-bottom:1px solid var(--ln)}.offre-edit textarea{grid-column:1/-1}
button:focus-visible,a:focus-visible,tr:focus-visible{outline:3px solid color-mix(in srgb,var(--p) 55%,transparent);outline-offset:2px}
@media(max-width:680px){.badge-proto{display:none}.offre-edit{grid-template-columns:1fr}}`;
