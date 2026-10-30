import { describe, expect, it } from "vitest";
import { QUANTITE_TOTALE_MAX } from "./money";
import { REF_RE, validateCommande } from "./validate";

// Compléments de la migration 0007 : référence plus longue, plafond d'articles par commande.
const CLE = "cle-1234567890abcdef";
const id = (i: number) => `0000000${i}-0000-4000-8000-000000000000`;
const base = { slug: "chez-awa", cle: CLE, mode: "retrait", client: { nom: "Awa", email: "awa@exemple.fr" } };

describe("référence de commande", () => {
  it("accepte l'ancienne forme (8 caractères) et la nouvelle (12), rien d'autre", () => {
    expect(REF_RE.test("CMD-3F9A1C2B")).toBe(true);
    expect(REF_RE.test("CMD-3F9A1C2B4D5E")).toBe(true);
    for (const bad of ["CMD-3F9A1C2", "CMD-3F9A1C2B4", "CMD-3F9A1C2B4D5EF", "cmd-3f9a1c2b", "CMD-3F9A1C2G", "CMD-3F9A1C2B\n", "x CMD-3F9A1C2B"]) expect(REF_RE.test(bad), bad).toBe(false);
  });
});

describe("plafond d'articles par commande", () => {
  it(`refuse plus de ${QUANTITE_TOTALE_MAX} articles au total, accepte exactement ${QUANTITE_TOTALE_MAX}`, () => {
    const trop = validateCommande({ ...base, lignes: [1, 2, 3].map((i) => ({ variante_id: id(i), quantite: 99 })) });
    expect(trop.ok).toBe(false);
    if (!trop.ok) expect(trop.errors.lignes).toContain("200");
    const limite = validateCommande({ ...base, lignes: [{ variante_id: id(1), quantite: 99 }, { variante_id: id(2), quantite: 99 }, { variante_id: id(3), quantite: 2 }] });
    expect(limite.ok).toBe(true);
    const un = validateCommande({ ...base, lignes: [{ variante_id: id(1), quantite: 1 }] });
    expect(un.ok).toBe(true);
  });
});
