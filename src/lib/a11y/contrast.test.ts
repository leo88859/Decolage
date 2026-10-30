import { describe, expect, it } from "vitest";
import { contrastRatio, flatten, parseColor, ratioOf } from "./contrast";
import { buildPairs, evaluate, loadTokens } from "./palette-pairs";

describe("contraste WCAG 2.x : fonctions", () => {
  it("donne 21 pour noir sur blanc et 1 pour deux couleurs identiques", () => {
    expect(contrastRatio({ r: 0, g: 0, b: 0 }, { r: 255, g: 255, b: 255 })).toBeCloseTo(21, 5);
    expect(ratioOf("#2f5bff", "#2f5bff")).toBeCloseTo(1, 5);
  });
  it("reproduit des valeurs de référence connues", () => {
    expect(ratioOf("#777777", "#ffffff")).toBeCloseTo(4.48, 2); // gris classique, juste sous 4,5
    expect(ratioOf("#767676", "#ffffff")).toBeCloseTo(4.54, 2);
  });
  it("lit les formats hexadécimal court, long et rgba", () => {
    expect(parseColor("#fff")).toEqual({ r: 255, g: 255, b: 255, a: 1 });
    expect(parseColor("rgba(10, 20, 51, 0.78)")).toEqual({ r: 10, g: 20, b: 51, a: 0.78 });
    expect(() => parseColor("hsl(0 0% 0%)")).toThrow();
  });
  it("compose les transparences avant de mesurer", () => {
    const fond = flatten(["#000000", "rgba(255, 255, 255, 0.5)"]);
    expect(Math.round(fond.r)).toBe(128);
    expect(ratioOf("rgba(255, 255, 255, 0.5)", "#000000")).toBeCloseTo(5.32, 1); // gris 128 sur noir
  });
});

describe("contraste WCAG 2.x : le vrai site (palette-pairs.ts)", () => {
  const tokens = loadTokens();
  const rows = evaluate(tokens);

  it("lit les variables réelles de globals.css et a11y.css", () => {
    expect(tokens["--navy"]).toBe("#0a1433");
    expect(tokens["--cream"]).toBe("#f6f1e7");
    expect(tokens["--focus-light"]).toBeDefined();
  });

  it("a une liste de paires assez complète et sans doublon d'identifiant", () => {
    const ids = buildPairs().map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.length).toBeGreaterThan(200);
  });

  it("n'utilise que des variables qui existent", () => {
    const erreurs = rows.filter((r) => r.error).map((r) => `${r.pair.id} : ${r.error}`);
    expect(erreurs).toEqual([]);
  });

  it.each(rows.map((r) => [r.pair.group, r.pair.id, r] as const))("%s · %s", (_g, _id, r) => {
    const detail = `${r.pair.label} → ${r.ratio?.toFixed(2)}:1 (seuil ${r.pair.min}:1, ${r.pair.kind})`;
    expect(r.ratio, detail).not.toBeNull();
    expect(r.ok, detail).toBe(true);
  });
});
