import { describe, expect, it, vi } from "vitest";
import { api, BOUTIQUE_VIDE, boutiquePayload, erreursEtape, mapApiError, PRODUIT_VIDE, produitPayload, prochainsStatuts, stockEtat } from "./logic";

const json = (status: number, body: unknown) => async () => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

describe("conversion euros -> centimes dans le formulaire produit", () => {
  const base = { ...PRODUIT_VIDE, titre: "Robe wax" };
  it("convertit sans erreur d'arrondi", () => {
    for (const [saisie, c] of [["25,99", 2599], ["19.99", 1999], ["0,07", 7], ["1,1", 110], ["8", 800], ["1.005", null]] as const) {
      const r = produitPayload({ ...base, prix: saisie });
      if (c === null) expect(r.ok).toBe(false);
      else {
        expect(r.ok).toBe(true);
        if (r.ok) expect(r.produit.prix_centimes).toBe(c);
      }
    }
  });
  it("refuse prix vide, négatif, texte", () => {
    for (const prix of ["", "-3", "abc", "1,234"]) {
      const r = produitPayload({ ...base, prix });
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.errors.prix).toBeTruthy();
    }
  });
  it("valide titre, image https, variantes et stock", () => {
    const r = produitPayload({ ...base, titre: "", prix: "5", image: "http://x.fr/a.jpg", variantes: [{ nom: "M", stock: "2,5", actif: true }, { nom: "M", stock: "1", actif: true }] });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.errors.titre).toBeTruthy();
      expect(r.errors.image).toBeTruthy();
      expect(r.errors["variante.0.stock"]).toBeTruthy();
    }
    const dup = produitPayload({ ...base, prix: "5", variantes: [{ nom: "M", stock: "2", actif: true }, { nom: "M", stock: "1", actif: true }] });
    expect(dup.ok).toBe(false);
    const ok = produitPayload({ ...base, prix: "5", image: "https://x.fr/a.jpg", variantes: [{ id: "v1", nom: "M", stock: "2", actif: true }] });
    expect(ok.ok).toBe(true);
    if (ok.ok) {
      expect(ok.produit.images).toEqual(["https://x.fr/a.jpg"]);
      expect(ok.variantes).toEqual([{ id: "v1", nom: "M", stock: 2, actif: true }]);
    }
  });
});

describe("mapping des erreurs serveur", () => {
  it("formule insuffisante, session, doublon", () => {
    expect(mapApiError(403, { code: "limite_boutiques", error: "x" }).message).toMatch(/formule/);
    expect(mapApiError(401, {}).code).toBe("auth");
    expect(mapApiError(409, { code: "duplicate" }).message).toMatch(/déjà utilisé/);
    expect(mapApiError(409, { code: "statut_invalide" }).message).toMatch(/statut/);
  });
  it("garde le message et les erreurs par champ du serveur, et n'invente rien sans corps", () => {
    const m = mapApiError(400, { code: "invalid", error: "Certains champs sont invalides.", errors: { nom: "Ce champ est obligatoire." } });
    expect(m.message).toBe("Certains champs sont invalides.");
    expect(m.errors?.nom).toBe("Ce champ est obligatoire.");
    expect(mapApiError(500, null).message).toMatch(/serveur/);
    expect(mapApiError(418, "bizarre").message).toBe("Erreur 418.");
  });
});

describe("appel API : aucun faux succès", () => {
  it("succès seulement si 2xx + JSON", async () => {
    expect((await api("", undefined, json(200, { boutiques: [] }) as typeof fetch)).ok).toBe(true);
    const r = await api("", undefined, json(403, { code: "limite_sites", error: "non" }) as typeof fetch);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe("limite_sites");
    const vide = await api("", undefined, (async () => new Response("pas du json", { status: 200 })) as typeof fetch);
    expect(vide.ok).toBe(false);
  });
  it("réseau coupé : erreur claire", async () => {
    const r = await api("", undefined, (async () => { throw new TypeError("fetch failed"); }) as typeof fetch);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe("network");
  });
  it("envoie le JSON et la méthode demandés", async () => {
    const f = vi.fn(json(201, { categorie: {} }));
    await api("/abc/categories", { method: "POST", body: { nom: "Robes" } }, f as unknown as typeof fetch);
    const [url, init] = f.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("/api/boutique/abc/categories");
    expect(init.method).toBe("POST");
    expect(init.body).toBe('{"nom":"Robes"}');
  });
});

describe("formulaire boutique", () => {
  it("assistant : erreurs rattachées à la bonne étape", () => {
    const r = boutiquePayload({ ...BOUTIQUE_VIDE, nom: "", slug: "ab", logo: "http://x", modes: [] });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(Object.keys(erreursEtape(0, r.errors)).sort()).toEqual(["nom", "slug"]);
      expect(Object.keys(erreursEtape(1, r.errors))).toEqual(["logo"]);
      expect(Object.keys(erreursEtape(3, r.errors))).toEqual(["modes"]);
    }
  });
  it("les champs vides facultatifs deviennent null", () => {
    const r = boutiquePayload({ ...BOUTIQUE_VIDE, nom: "Chez Awa", slug: "Chez-Awa" });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.body).toMatchObject({ slug: "chez-awa", logo: null, whatsapp: null, email: null, telephone: null, modes: ["retrait"] });
  });
});

describe("stock et statuts", () => {
  it("disponible / stock bas / indisponible", () => {
    expect(stockEtat([{ stock: 10, actif: true }])).toBe("disponible");
    expect(stockEtat([{ stock: 10, actif: true }, { stock: 2, actif: true }])).toBe("stock_bas");
    expect(stockEtat([{ stock: 0, actif: true }])).toBe("indisponible");
    expect(stockEtat([{ stock: 5, actif: false }])).toBe("indisponible");
  });
  it("transitions de commande identiques au serveur", () => {
    expect(prochainsStatuts("nouvelle")).toEqual(["confirmee", "annulee"]);
    expect(prochainsStatuts("terminee")).toEqual([]);
    expect(prochainsStatuts("annulee")).toEqual([]);
  });
});
