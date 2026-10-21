import { describe, expect, it } from "vitest";
import { IDEAS } from "@/data/ideas";
import { matchIdeas, stem, tokens } from "@/lib/match";

const top = (q: string, n = 3) => matchIdeas(q, IDEAS, n).map((m) => m.idea.id);

describe("correspondance description → idées", () => {
  it("normalise, retire les mots vides et simplifie les terminaisons", () => {
    expect(tokens("Je veux créer une APPLICATION pour les Coiffeurs")).toEqual(["coiff"]);
    expect(stem("réservations".normalize("NFD").replace(/[̀-ͯ]/g, ""))).toBe("reserv");
  });

  it("trouve les idées de prise de rendez-vous pour un salon", () => {
    const q = "une app pour que les clients d'un coiffeur réservent leur rendez-vous en ligne";
    expect(top(q)).toContain("barbier");
    // Les mots affichés sont ceux de l'utilisateur, pas les racines internes.
    expect(matchIdeas(q, IDEAS)[0]!.mots).toEqual(expect.arrayContaining(["coiffeur", "rendez-vous"]));
  });

  it("trouve le suivi de revente", () => {
    expect(top("je revends des vêtements sur Vinted et je veux savoir combien je gagne vraiment")).toContain("achat-revente");
  });

  it("trouve le planning de révisions", () => {
    expect(top("aider les étudiants à organiser leurs révisions avant les examens")).toContain("planning-revisions");
  });

  it("comprend les synonymes", () => {
    expect(top("gérer mes prospects et relancer mes clients", 4)).toEqual(expect.arrayContaining(["relances-impayes"]));
  });

  it("ne renvoie rien pour une description vide ou sans mot utile", () => {
    expect(matchIdeas("", IDEAS)).toEqual([]);
    expect(matchIdeas("je veux faire un site", IDEAS)).toEqual([]);
  });

  it("est déterministe et classe la meilleure à 100 %", () => {
    const a = matchIdeas("carte de fidélité pour mon snack", IDEAS);
    expect(a).toEqual(matchIdeas("carte de fidélité pour mon snack", IDEAS));
    expect(a[0]!.pct).toBe(100);
    expect(a[0]!.idea.id).toBe("fidelite");
  });
});
