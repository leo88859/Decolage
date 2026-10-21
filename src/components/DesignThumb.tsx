"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { renderLanding } from "@/lib/landing";
import { activePages } from "@/lib/modules";
import { contenuOf, newProjectFromIdee } from "@/lib/project";
import { renderPrototype } from "@/lib/prototype";
import type { Project } from "@/lib/types";

export type IdeeInput = Parameters<typeof newProjectFromIdee>[0];
/** Ce que montre l'aperçu : le tableau de bord, une page de l'application, ou la page de vente. */
export type PreviewView = "dashboard" | "accueil" | "liste" | "landing";

const EPOCH = new Date("2026-01-01T09:00:00Z");
const LIST_KINDS: string[] = ["tableau", "liste", "grille", "kanban", "calendrier"];

/** Page de démarrage : celle qui montre le mieux le design (le tableau de bord s'il existe). */
export function showcasePage(p: Project, view: PreviewView = "dashboard") {
  const pages = activePages(p.config);
  // Architecture dédiée : « app » est le premier écran de l'espace utilisateur.
  if (pages.some((x) => x.id === "app")) {
    if (view === "accueil") return "accueil";
    const appScreens = pages.filter((x) => !String(x.kind).startsWith("site-"));
    return (view === "liste" ? appScreens[1] ?? appScreens[0] : appScreens[0])!.id;
  }
  const want = view === "accueil" ? pages.find((x) => x.kind === "accueil") : view === "liste" ? pages.find((x) => LIST_KINDS.includes(x.kind)) : pages.find((x) => x.kind === "dashboard");
  return (want ?? pages.find((x) => x.kind !== "accueil" && x.nav) ?? pages[0]!).id;
}

/** HTML complet d'une idée dans un design, prêt pour un iframe. */
export function designDoc(input: IdeeInput, view: PreviewView = "dashboard") {
  const p = newProjectFromIdee(input, EPOCH);
  const html = view === "landing"
    ? renderLanding(p.config, p.landing, p.pricing.offres.length ? p.pricing : null, { inlineCss: true, contenu: p.contenu })
    : renderPrototype(p.config, showcasePage(p, view), p.contenu);
  return { p, html };
}

/**
 * Miniature vivante : le vrai prototype, rendu à `width` px puis réduit à la taille du cadre.
 * Chargée seulement quand elle approche de l'écran, avec un fond animé en attendant.
 */
export function DesignThumb({ input, view = "dashboard", width = 1040, interactive = false, className = "" }: { input: IdeeInput; view?: PreviewView; width?: number; interactive?: boolean; className?: string }) {
  return <ScaledFrame docKey={`${view}|${JSON.stringify(input)}`} make={() => designDoc(input, view).html} width={width} interactive={interactive} className={className} />;
}

/** Miniature d'un projet enregistré, dans son design et avec ses données. */
export function ProjectThumb({ project, width = 1040 }: { project: Project; width?: number }) {
  return <ScaledFrame docKey={`${project.id}|${project.updatedAt}`} make={() => renderPrototype(project.config, showcasePage(project), contenuOf(project), { initial: project.appData })} width={width} />;
}

/** Cadre réduit générique : `make` produit le HTML, recalculé seulement quand `docKey` change. */
export function ScaledFrame({ docKey: key, make, width = 1040, interactive = false, className = "" }: { docKey: string; make: () => string; width?: number; interactive?: boolean; className?: string }) {
  const box = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  const [loaded, setLoaded] = useState("");
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const doc = useMemo(() => (visible ? make() : ""), [visible, key]);

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => { if (e?.isIntersecting) { setVisible(true); io.disconnect(); } }, { rootMargin: "300px" });
    io.observe(el);
    const ro = new ResizeObserver(([e]) => { if (e) el.style.setProperty("--k", String(e.contentRect.width / width)); });
    ro.observe(el);
    return () => { io.disconnect(); ro.disconnect(); };
  }, [width]);

  return (
    <div className={`dthumb ${loaded === key ? "ready" : ""} ${className}`} ref={box} style={{ "--w": `${width}px` } as React.CSSProperties}>
      {doc && (
        <iframe
          key={key}
          title="Aperçu du design"
          srcDoc={doc}
          sandbox="allow-scripts allow-forms"
          onLoad={() => setLoaded(key)}
          tabIndex={interactive ? 0 : -1}
          aria-hidden={interactive ? undefined : true}
          style={{ pointerEvents: interactive ? "auto" : "none" }}
        />
      )}
    </div>
  );
}
