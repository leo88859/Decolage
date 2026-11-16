import { describe, expect, it } from "vitest";
import { BRAND_OPTION_PRIX, PLANS, brandOptionLabel, brandOptionTotalLabel, canCreateProject, whiteLabelAllowed } from "@/lib/plans";
import { decideWhiteLabel } from "@/lib/brand/decision";
import { computeEffectiveBrand } from "@/lib/brand/effective";
import { siteBrandFrom } from "@/lib/brand/site-brand";

// Matrice des droits de marque blanche et des limites de projets : plans.ts est la source côté interface ET côté serveur
// (decideWhiteLabel est appelée par /api/brand, /api/export, les sites publiés, les boutiques). Les limites en base (SQL) sont
// vérifiées contre plans.ts par limites-serveur.test.ts (PostgreSQL en mémoire), la route /api/brand par brand.test.ts.
describe("formules : prix et limites de projets", () => {
  it("Découverte 0 € / 1 projet, Solo 2,99 € / 1, Pro 12,99 € / 5, Illimité 29,99 € / sans limite", () => {
    expect([PLANS.gratuit.prix, PLANS.gratuit.maxProjets]).toEqual([0, 1]);
    expect([PLANS.solo.prix, PLANS.solo.maxProjets]).toEqual([2.99, 1]);
    expect([PLANS.pro.prix, PLANS.pro.maxProjets]).toEqual([12.99, 5]);
    expect([PLANS.illimite.prix, PLANS.illimite.maxProjets]).toEqual([29.99, Infinity]);
  });
  it("canCreateProject suit ces limites", () => {
    expect([canCreateProject("gratuit", 0), canCreateProject("gratuit", 1)]).toEqual([true, false]);
    expect([canCreateProject("solo", 0), canCreateProject("solo", 1)]).toEqual([true, false]);
    expect([canCreateProject("pro", 4), canCreateProject("pro", 5)]).toEqual([true, false]);
    expect(canCreateProject("illimite", 10_000)).toBe(true);
  });
  it("option marque blanche : +4,99 €/mois, 7,98 €/mois au total pour Solo", () => {
    expect(BRAND_OPTION_PRIX).toBe(4.99);
    expect(brandOptionLabel()).toMatch(/^\+4,99\s€\/mois$/);
    expect(brandOptionTotalLabel().replace(/\s/g, " ")).toBe("7,98 €/mois au total");
  });
});

describe("droit de marque blanche : Découverte non, Solo avec option seulement, Pro et Illimité inclus", () => {
  const cas: [string | null | undefined, boolean | undefined, boolean][] = [
    ["gratuit", undefined, false], ["gratuit", false, false], ["gratuit", true, false], // un ancien droit ne sert à rien
    ["solo", undefined, false], ["solo", false, false], ["solo", true, true],
    ["pro", undefined, true], ["pro", false, true], ["illimite", undefined, true], ["illimite", false, true],
    ["premium", undefined, true], // ancienne formule « premium » = Illimité
    ["bidon", true, false], [null, true, false], [undefined, true, false], // valeur inconnue : refusé (fail-closed)
  ];
  it.each(cas)("formule %s, option %s -> %s", (plan, option, attendu) => {
    expect(decideWhiteLabel(plan, option)).toBe(attendu);
  });
  it("option fournie sous une autre forme qu'un vrai booléen : ignorée", () => {
    expect(decideWhiteLabel("solo", "true")).toBe(false);
    expect(decideWhiteLabel("solo", 1)).toBe(false);
  });
  it("whiteLabelAllowed (plans.ts) et decideWhiteLabel disent la même chose", () => {
    for (const p of ["gratuit", "solo", "pro", "illimite"] as const) for (const o of [false, true]) expect(decideWhiteLabel(p, o)).toBe(whiteLabelAllowed(p, o));
  });
  it("l'identité n'est imposée aux créations publiques que si le droit est actif (siteBrandFrom)", () => {
    const row = { name: "Atelier Lumière", color_primary: "#12ab34" };
    for (const [plan, option, ok] of [["gratuit", true, false], ["solo", false, false], ["solo", true, true], ["pro", undefined, true], ["illimite", undefined, true]] as const) {
      expect(siteBrandFrom(computeEffectiveBrand({ plan, optionActive: option, row })) !== null).toBe(ok);
    }
  });
});
