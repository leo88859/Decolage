import { describe, expect, it } from "vitest";
import { CATEGORIES, IDEAS } from "@/data/ideas";
import { LAUNCH_ACTIONS } from "@/data/launch";
import { MODULE_BY_ID, MODULES } from "@/data/modules";
import { BASE_TASKS, ROADMAP_STEPS } from "@/data/roadmap";
import { TEMPLATE_BY_ID, TEMPLATES } from "@/data/templates";
import { defaultConfig, validateConfig } from "@/lib/config";
import { dependencies, moduleIssues } from "@/lib/modules";

describe("catalogue d'idées", () => {
  it("contient au moins 200 idées", () => {
    expect(IDEAS.length).toBeGreaterThanOrEqual(200);
  });

  it("n'a ni identifiant, ni nom, ni description en double", () => {
    for (const key of ["id", "nom", "description", "probleme", "exemple"] as const) {
      const values = IDEAS.map((i) => i[key].toLowerCase());
      expect(new Set(values).size, key).toBe(values.length);
    }
  });

  it("a des fiches complètes et cohérentes", () => {
    const cats = new Set(CATEGORIES.map((c) => c.id));
    const bad = IDEAS.filter((i) =>
      !cats.has(i.categorie) || !TEMPLATE_BY_ID[i.template] || i.mvp.length < 3 || i.risques.length < 2 || i.competences.length < 2 || i.semaines <= 0 ||
      [i.nom, i.description, i.probleme, i.cible, i.exemple, i.concurrence, i.validation].some((f) => f.trim().length <= 3),
    ).map((i) => i.id);
    expect(bad).toEqual([]);
  });

  it("couvre chaque catégorie avec 18 idées", () => {
    for (const c of CATEGORIES) expect(IDEAS.filter((i) => i.categorie === c.id).length, c.id).toBe(18);
  });

  it("produit une configuration valide pour chaque idée", () => {
    for (const i of IDEAS) expect(validateConfig(defaultConfig(i.template, i)), i.id).toEqual({});
  });
});

describe("modèles et briques", () => {
  it("propose 16 modèles avec des identifiants uniques", () => {
    expect(TEMPLATES).toHaveLength(16);
    expect(new Set(TEMPLATES.map((t) => t.id)).size).toBe(16);
  });

  it("ne référence que des briques existantes, sans dépendance circulaire", () => {
    for (const m of MODULES) {
      for (const d of [...m.deps, ...m.conflits]) expect(MODULE_BY_ID[d], `${m.id} → ${d}`).toBeDefined();
      expect(dependencies(m.id)).not.toContain(m.id);
    }
  });

  it("déclare des conflits symétriques", () => {
    for (const m of MODULES) for (const c of m.conflits) expect(MODULE_BY_ID[c].conflits, `${m.id} ↔ ${c}`).toContain(m.id);
  });

  it("donne une configuration par défaut cohérente pour chaque modèle", () => {
    for (const t of TEMPLATES) {
      const cfg = defaultConfig(t.id);
      expect(moduleIssues(cfg), t.id).toEqual([]);
      expect(validateConfig(cfg), t.id).toEqual({});
      for (const r of t.modules.requis) expect(cfg.modules).toContain(r);
      expect(t.entite.exemples.every((row) => row.length === t.entite.champs.length), t.id).toBe(true);
    }
  });
});

describe("feuille de route et lancement", () => {
  it("a des tâches de base pour chaque étape, aux identifiants uniques", () => {
    const ids = [...ROADMAP_STEPS.flatMap((s) => BASE_TASKS[s.id].map((t) => t.id)), ...TEMPLATES.flatMap((t) => Object.values(t.taches).flat().map((x) => x.id))];
    expect(new Set(ids).size).toBe(ids.length);
    for (const s of ROADMAP_STEPS) expect(BASE_TASKS[s.id].length, s.id).toBeGreaterThan(0);
  });

  it("a des actions de lancement uniques", () => {
    expect(new Set(LAUNCH_ACTIONS.map((a) => a.id)).size).toBe(LAUNCH_ACTIONS.length);
  });
});
