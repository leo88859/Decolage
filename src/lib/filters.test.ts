import { writeFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { IDEAS } from "@/data/ideas";
import { projectFiles } from "@/lib/export";
import { filterIdeas, NO_FILTERS } from "@/lib/filters";
import { can, canCreateProject, normalizePlan, PAID_PLANS, planForProjects, PLANS, prixLabel } from "@/lib/plans";
import { newProject } from "@/lib/project";
import { zip } from "@/lib/zip";

describe("filtres du catalogue", () => {
  it("cherche sans tenir compte des accents ni de la casse", () => {
    const r = filterIdeas(IDEAS, { ...NO_FILTERS, q: "ETUDIANT budget" }, []);
    expect(r.map((i) => i.id)).toContain("budget-etudiant");
    expect(filterIdeas(IDEAS, { ...NO_FILTERS, q: "zzz-introuvable" }, [])).toEqual([]);
  });

  it("combine les filtres", () => {
    const r = filterIdeas(IDEAS, { ...NO_FILTERS, categorie: "local", budget: 0, niveau: "low-code" }, []);
    expect(r.length).toBeGreaterThan(0);
    expect(r.every((i) => i.categorie === "local" && i.budget === 0 && i.niveau === "low-code")).toBe(true);
  });

  it("filtre les favoris", () => {
    expect(filterIdeas(IDEAS, { ...NO_FILTERS, favoris: true }, ["coloc", "barbier"]).map((i) => i.id).sort()).toEqual(["barbier", "coloc"]);
  });
});

describe("formules", () => {
  it("applique les prix et limites demandés", () => {
    expect([PLANS.solo.prix, PLANS.pro.prix, PLANS.illimite.prix]).toEqual([2.99, 9.99, 29.99]);
    expect([PLANS.gratuit.maxProjets, PLANS.solo.maxProjets, PLANS.pro.maxProjets]).toEqual([0, 1, 5]);
    // Sans offre, on essaie en aperçu mais on ne génère aucun SaaS.
    expect(canCreateProject("gratuit", 0)).toBe(false);
    expect(canCreateProject("solo", 0)).toBe(true);
    expect(canCreateProject("illimite", 10_000)).toBe(true);
    expect(canCreateProject("pro", 4)).toBe(true);
    expect(canCreateProject("pro", 5)).toBe(false);
  });

  it("réserve la mise en ligne et les fonctions avancées aux offres payantes", () => {
    expect(PLANS.gratuit.maxSites).toBe(0);
    for (const f of ["exportFichiers", "modelesPremium", "personnalisationAvancee", "duplication"] as const) {
      expect(can("gratuit", f)).toBe(false);
      for (const p of PAID_PLANS) expect(can(p, f), `${p} ${f}`).toBe(true);
    }
  });

  it("convertit l'ancienne formule et propose l'offre adaptée", () => {
    expect(normalizePlan("premium")).toBe("illimite");
    expect(normalizePlan("n'importe quoi")).toBe("gratuit");
    expect(planForProjects(1)).toBe("solo");
    expect(planForProjects(3)).toBe("pro");
    expect(planForProjects(12)).toBe("illimite");
    expect(prixLabel("pro")).toBe("9,99 € / mois");
  });
});

describe("archive d'export", () => {
  it("écrit une archive réelle sur disque si demandé", () => {
    const out = process.env.ZIP_OUT;
    const data = zip(projectFiles(newProject("rendez-vous")));
    expect(data.length).toBeGreaterThan(1000);
    if (out) writeFileSync(out, data);
  });
});
