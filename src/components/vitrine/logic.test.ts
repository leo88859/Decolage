import { describe, expect, it } from "vitest";
import {
  addLigne, cleanWhatsapp, contrast, countArticles, dispoProduit, dispoVariante, hasProbleme, mailLink, mapCommandeError,
  parseCart, parseCommandeSuccess, readableOn, removeLigne, resolveCart, safeColor, setQuantite, telLink, textOnWhite,
  totalIndicatif, whatsappLink, type ProduitPub,
} from "./logic";

const V1 = "11111111-1111-4111-8111-111111111111";
const V2 = "22222222-2222-4222-8222-222222222222";
const V3 = "33333333-3333-4333-8333-333333333333";
const prod = (id: string, prix: number, stocks: number[]): ProduitPub => ({
  id, categorie_id: null, titre: "P" + id, description: "", prix_centimes: prix, images: [], position: 0,
  // Le public ne reçoit plus la quantité exacte (migration 0007) : seulement disponible / stock_bas (stock de 1 à 5).
  variantes: stocks.map((s, i) => ({ id: i === 0 ? id : `${id}-${i}`, nom: "v" + i, position: i, disponible: s > 0, stock_bas: s > 0 && s <= 5 })),
});

describe("panier", () => {
  it("ajoute, additionne et plafonne à 99", () => {
    let l = addLigne([], V1);
    l = addLigne(l, V1, 2);
    expect(l).toEqual([{ variante_id: V1, quantite: 3 }]);
    expect(addLigne(l, V1, 500)[0]!.quantite).toBe(99);
    expect(addLigne(l, V2, 0)).toEqual(l);
  });
  it("limite à 20 lignes différentes", () => {
    let l: ReturnType<typeof addLigne> = [];
    for (let i = 0; i < 25; i++) l = addLigne(l, `00000000-0000-4000-8000-${String(i).padStart(12, "0")}`);
    expect(l).toHaveLength(20);
  });
  it("modifie la quantité, 0 retire la ligne, retire", () => {
    const l = addLigne(addLigne([], V1, 2), V2, 1);
    expect(setQuantite(l, V1, 5)[0]!.quantite).toBe(5);
    expect(setQuantite(l, V1, 0)).toEqual([{ variante_id: V2, quantite: 1 }]);
    expect(setQuantite(l, V1, Number.NaN)).toHaveLength(1);
    expect(removeLigne(l, V2)).toEqual([{ variante_id: V1, quantite: 2 }]);
    expect(countArticles(l)).toBe(3);
  });
  it("relit un stockage corrompu sans planter", () => {
    expect(parseCart(null)).toEqual([]);
    expect(parseCart("{pas du json")).toEqual([]);
    expect(parseCart('{"a":1}')).toEqual([]);
    const raw = JSON.stringify([{ variante_id: V1, quantite: 2 }, { variante_id: V1, quantite: 1 }, { variante_id: "x", quantite: 1 }, { variante_id: V2, quantite: -3 }, { variante_id: V3, quantite: "2" }, null]);
    expect(parseCart(raw)).toEqual([{ variante_id: V1, quantite: 3 }]);
  });
});

describe("totaux indicatifs et disponibilité", () => {
  const produits = [prod(V1, 1250, [10]), prod(V2, 300, [2]), prod(V3, 999, [0])];
  it("calcule le total des lignes valides seulement", () => {
    const items = resolveCart([{ variante_id: V1, quantite: 2 }, { variante_id: V2, quantite: 1 }], produits);
    expect(totalIndicatif(items)).toBe(2800);
    expect(hasProbleme(items)).toBe(false);
  });
  it("signale épuisé et article retiré, hors du total ; le stock exact n'étant plus public, une quantité trop grande n'est tranchée que par le serveur", () => {
    const items = resolveCart([{ variante_id: V2, quantite: 3 }, { variante_id: V3, quantite: 1 }, { variante_id: "44444444-4444-4444-8444-444444444444", quantite: 1 }, { variante_id: V1, quantite: 1 }], produits);
    expect(items.map((i) => i.probleme)).toEqual([null, "indisponible", "retire", null]);
    expect(totalIndicatif(items)).toBe(3 * 300 + 1250);
    expect(hasProbleme(items)).toBe(true);
    expect(items.map((i) => i.max)).toEqual([99, 0, 0, 99]);
  });
  it("disponible / stock bas / indisponible", () => {
    expect(dispoVariante({ disponible: false, stock_bas: false })).toBe("indisponible");
    expect(dispoVariante({ disponible: true, stock_bas: true })).toBe("bas");
    expect(dispoVariante({ disponible: true, stock_bas: false })).toBe("disponible");
    expect(dispoProduit(prod("a", 1, [0, 2]))).toBe("bas");
    expect(dispoProduit(prod("a", 1, [0, 0]))).toBe("indisponible");
    expect(dispoProduit(prod("a", 1, [0, 9]))).toBe("disponible");
  });
});

describe("contact", () => {
  it("nettoie le numéro WhatsApp", () => {
    expect(cleanWhatsapp("+221 77 123 45 67")).toBe("221771234567");
    expect(cleanWhatsapp("00 33 6 12-34-56-78")).toBe("33612345678");
    expect(cleanWhatsapp("(+33) 6.12.34.56.78")).toBe("33612345678");
    expect(cleanWhatsapp("abc")).toBeNull();
    expect(cleanWhatsapp("123")).toBeNull();
    expect(cleanWhatsapp("1234567890123456")).toBeNull();
    expect(cleanWhatsapp(null)).toBeNull();
    expect(cleanWhatsapp("")).toBeNull();
  });
  it("construit les liens, seulement si valides", () => {
    expect(whatsappLink("+33 6 12 34 56 78")).toBe("https://wa.me/33612345678");
    expect(whatsappLink("+33612345678", "Bonjour & merci")).toBe("https://wa.me/33612345678?text=Bonjour%20%26%20merci");
    expect(whatsappLink("rien")).toBeNull();
    expect(telLink("+33 6 12 34 56 78")).toBe("tel:+33612345678");
    expect(telLink("javascript:alert(1)")).toBeNull();
    expect(mailLink("a@b.fr")).toBe("mailto:a@b.fr");
    expect(mailLink("pas un mail")).toBeNull();
    expect(mailLink(null)).toBeNull();
  });
});

describe("réponse de commande", () => {
  const jeton = "a".repeat(64);
  it("accepte une vraie réussite", () => {
    expect(parseCommandeSuccess(201, { commande: { ref: "CMD-3F9A1C2B", total_centimes: 2599, jeton_suivi: jeton }, rejouee: false }))
      .toEqual({ ref: "CMD-3F9A1C2B", jeton, total_centimes: 2599, rejouee: false });
  });
  it("accepte une référence de 12 caractères (nouvelles commandes) comme de 8 (anciennes)", () => {
    const jeton = "a".repeat(64);
    expect(parseCommandeSuccess(201, { commande: { ref: "CMD-3F9A1C2B4D5E", total_centimes: 1, jeton_suivi: jeton }, rejouee: false })?.ref).toBe("CMD-3F9A1C2B4D5E");
    expect(parseCommandeSuccess(201, { commande: { ref: "CMD-3F9A1C2B4D5", total_centimes: 1, jeton_suivi: jeton }, rejouee: false })).toBeNull();
  });
  it("accepte une commande rejouée sans jeton", () => {
    const r = parseCommandeSuccess(200, { commande: { ref: "CMD-3F9A1C2B", total_centimes: 100 }, rejouee: true });
    expect(r?.jeton).toBeNull();
    expect(r?.rejouee).toBe(true);
  });
  it("refuse le faux succès anti-spam et toute réponse incomplète", () => {
    expect(parseCommandeSuccess(201, { commande: { ref: "CMD-00000000", statut: "nouvelle", paiement: "non_payee" }, rejouee: false })).toBeNull();
    expect(parseCommandeSuccess(201, { commande: { ref: "CMD-3F9A1C2B" }, rejouee: false })).toBeNull();
    expect(parseCommandeSuccess(201, { commande: { ref: "n'importe quoi", total_centimes: 1, jeton_suivi: jeton } })).toBeNull();
    expect(parseCommandeSuccess(500, { commande: { ref: "CMD-3F9A1C2B", total_centimes: 1, jeton_suivi: jeton } })).toBeNull();
    expect(parseCommandeSuccess(201, null)).toBeNull();
  });
});

describe("erreurs de commande", () => {
  it("stock insuffisant : message du serveur et rafraîchissement", () => {
    const e = mapCommandeError(409, { error: "Un article n'est plus disponible en quantité suffisante. Mets à jour ton panier.", code: "stock_insuffisant" });
    expect(e.message).toContain("quantité suffisante");
    expect(e.rafraichir).toBe(true);
  });
  it("champs invalides remontés", () => {
    const e = mapCommandeError(400, { error: "Certains champs sont invalides.", code: "invalid", errors: { "client.nom": "Nom requis." } });
    expect(e.champs["client.nom"]).toBe("Nom requis.");
  });
  it("réseau coupé, limite, erreur serveur, inconnu", () => {
    expect(mapCommandeError(null, null)).toMatchObject({ reessayer: true });
    expect(mapCommandeError(429, { code: "rate_limit" })).toMatchObject({ reessayer: true });
    expect(mapCommandeError(500, { code: "server" })).toMatchObject({ reessayer: true });
    expect(mapCommandeError(404, { code: "boutique_introuvable" }).message).toContain("plus ouverte");
    expect(mapCommandeError(418, "n'importe quoi").message.length).toBeGreaterThan(5);
  });
});

describe("couleurs", () => {
  it("refuse les couleurs non hexadécimales (pas d'injection CSS)", () => {
    expect(safeColor("#FF0000", "#000000")).toBe("#ff0000");
    expect(safeColor("red; background:url(x)", "#123456")).toBe("#123456");
    expect(safeColor(null, "#123456")).toBe("#123456");
  });
  it("choisit un texte lisible et assombrit un texte trop clair", () => {
    expect(readableOn("#ffffff")).toBe("#111111");
    expect(readableOn("#0a1433")).toBe("#ffffff");
    expect(contrast(textOnWhite("#ffee00"), "#ffffff")).toBeGreaterThanOrEqual(4.5);
    expect(textOnWhite("#0a1433")).toBe("#0a1433");
  });
});
