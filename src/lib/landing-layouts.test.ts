import { describe, expect, it } from "vitest";
import { DESIGNS } from "@/data/designs";
import { LAYOUTS, renderLanding } from "@/lib/landing";
import { newProjectFromIdee } from "@/lib/project";
import { LANDING_LAYOUTS, type LandingLayout } from "@/lib/types";

// Chaque mise en page de vente a sa propre structure (pas seulement d'autres couleurs).
const MARQUEURS: Record<LandingLayout, string[]> = {
  centre: ['class="mock mock-wide fade-in"'],
  split: ['class="split"', 'class="feat-rows"'],
  editorial: ['class="n"'],
  bento: ['class="hero hero-bg gridbg"', 'class="beam"', 'class="marquee"', 'class="bento"', "card spot rv"],
  dashboard: ['class="chart"', 'class="beam"', 'class="tick"', 'class="rows"', 'class="viz"'],
  prestige: ['class="hstats fade-in"', 'class="wrap quotes"', 'class="svc"', 'class="no"'],
  immersif: ['class="cue"', 'class="panels"', 'class="pic"'],
  catalogue: ['class="orbit fade-in"', 'class="disc"', 'class="ptag t1"', 'class="prods"'],
};

const projet = (layout: LandingLayout) => {
  const x = newProjectFromIdee({ idee: "boutique de bougies artisanales", type: "boutique", secteur: "artisanat", nom: "Bougie Lune", design: "vitrine" });
  return { ...x, landing: { ...x.landing, layout } };
};

describe("mises en page de vente", () => {
  it("toutes les mises en page sont décrites et autorisées", () => {
    expect(Object.keys(LAYOUTS).sort()).toEqual([...LANDING_LAYOUTS].sort());
  });
  it.each(LANDING_LAYOUTS)("« %s » produit sa structure propre", (layout) => {
    const x = projet(layout);
    const html = renderLanding(x.config, x.landing, null, { inlineCss: true, contenu: x.contenu });
    for (const m of MARQUEURS[layout]) expect(html).toContain(m);
    expect(html).not.toContain("undefined");
    expect(html).toContain("Bougie Lune");
  });
  it("les chiffres qui comptent affichent déjà leur valeur finale (sans script, rien ne manque)", () => {
    const x = projet("dashboard");
    const html = renderLanding(x.config, x.landing, null, { inlineCss: true, contenu: x.contenu });
    const [, to, u, shown] = html.match(/<b class="tick" data-to="([^"]+)" data-u="([^"]*)">([^<]+)<\/b>/)!;
    expect(shown).toBe(`${Number(to).toLocaleString("fr-FR")}${u}`);
  });
  it("le faisceau lumineux n'écrase pas l'apparition de l'aperçu", () => {
    for (const layout of ["bento", "dashboard"] as const) {
      const x = projet(layout);
      expect(renderLanding(x.config, x.landing, null, { inlineCss: true, contenu: x.contenu })).not.toMatch(/class="[^"]*\bbeam\b[^"]*\bfade-in\b|class="[^"]*\bfade-in\b[^"]*\bbeam\b/);
    }
  });
  it("les designs se partagent au moins six mises en page différentes", () => {
    expect(new Set(DESIGNS.map((d) => d.layout)).size).toBeGreaterThanOrEqual(6);
  });
});
