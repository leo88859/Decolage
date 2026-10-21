import { describe, expect, it } from "vitest";
import { cleanAppData } from "@/lib/appdata";
import { defaultConfig } from "@/lib/config";
import { prototypeData, renderPrototype } from "@/lib/prototype";

describe("données des applications", () => {
  it("garde un état valide et écarte le reste", () => {
    const ok = cleanAppData({ v: 1, rows: [{ id: 3, v: ["a", "b", "c", "d"], fav: true }, { id: "x", v: [] }, { id: 4, v: ["<script>", 2] }], next: 9, cart: { "3": 2, x: 1, "4": -1 }, goals: [{ nom: "Vélo", cible: 400, actuel: 10 }, { nom: 1 }] });
    expect(ok?.rows).toEqual([{ id: 3, v: ["a", "b", "c", "d"], fav: true }]);
    expect(ok?.cart).toEqual({ "3": 2 });
    expect(ok?.goals).toHaveLength(1);
    expect(cleanAppData(null)).toBeNull();
    expect(cleanAppData({ rows: "non" })).toBeNull();
  });

  it("plafonne la taille des cellules et le nombre de lignes", () => {
    const many = cleanAppData({ v: 1, rows: Array.from({ length: 6000 }, (_, i) => ({ id: i, v: ["x"] })) });
    expect(many?.rows.length).toBe(5000);
    const long = cleanAppData({ v: 1, rows: [{ id: 1, v: ["x".repeat(900)] }] });
    expect(long?.rows[0]!.v[0]!.length).toBe(500);
    // Au-delà de 1,5 Mo au total, l'état est refusé plutôt que de saturer le stockage.
    expect(cleanAppData({ v: 1, rows: Array.from({ length: 5000 }, (_, i) => ({ id: i, v: ["x".repeat(500)] })) })).toBeNull();
  });

  it("le prototype n'enregistre que si on le demande", () => {
    const cfg = defaultConfig("taches");
    expect(prototypeData(cfg).persist).toBeUndefined();
    const d = prototypeData(cfg, "accueil", undefined, { persist: true, storeKey: "p1", initial: { v: 1, rows: [] } });
    expect(d.persist).toBe(true);
    expect(d.storeKey).toBe("p1");
    expect(renderPrototype(cfg, "accueil", undefined, { persist: true, storeKey: "p1" })).toContain('"persist":true');
  });
});
