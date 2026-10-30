import { describe, expect, it } from "vitest";
import { eurosEnCentimes, formatEuros, totalCentimes } from "./money";
import { validateBoutique, validateCategorie, validateCommande, validateProduit, validateStatut, validateVariante } from "./validate";

const ID = "11111111-1111-4111-8111-111111111111";
const CLE = "cle-1234567890abcdef";
const base = { slug: "chez-awa", cle: CLE, mode: "retrait", client: { nom: "Awa", email: "awa@exemple.fr" }, lignes: [{ variante_id: ID, quantite: 2 }] };

describe("montants en centimes", () => {
  it("convertit sans nombre à virgule et refuse le reste", () => {
    expect(eurosEnCentimes("12,50")).toBe(1250);
    expect(eurosEnCentimes("12.5")).toBe(1250);
    expect(eurosEnCentimes("0,07")).toBe(7);
    expect(eurosEnCentimes("19")).toBe(1900);
    for (const bad of ["-1", "1,234", "abc", "", "1e3", "12,", "999999999"]) expect(eurosEnCentimes(bad)).toBeNull();
  });
  it("total et affichage", () => {
    expect(totalCentimes([{ prix_unitaire_centimes: 1999, quantite: 3 }, { prix_unitaire_centimes: 1, quantite: 1 }])).toBe(5998);
    expect(formatEuros(1250).replace(/\s/g, " ")).toBe("12,50 €");
  });
});

describe("validation produit", () => {
  it("accepte un produit correct avec variantes", () => {
    const r = validateProduit({ titre: "  Robe   wax ", prix_centimes: 2599, images: ["https://exemple.fr/a.jpg"], variantes: [{ nom: "M", stock: 3 }, { nom: "L", stock: 0 }] });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value).toMatchObject({ titre: "Robe wax", prix_centimes: 2599 });
  });
  it("refuse prix négatif, décimal, texte, trop grand ou manquant", () => {
    for (const p of [-1, 12.5, "12", 100_000_000, NaN, null]) expect(validateProduit({ titre: "x", prix_centimes: p }).ok).toBe(false);
    expect(validateProduit({ titre: "x" }).ok).toBe(false);
  });
  it("refuse balises, caractères de contrôle, champs inconnus et images non https", () => {
    expect(validateProduit({ titre: "<script>alert(1)</script>", prix_centimes: 1 }).ok).toBe(false);
    expect(validateProduit({ titre: "a\u0000b", prix_centimes: 1 }).ok).toBe(false);
    expect(validateProduit({ titre: "a‮b", prix_centimes: 1 }).ok).toBe(false);
    expect(validateProduit({ titre: "x", prix_centimes: 1, boutique_id: ID }).ok).toBe(false);
    expect(validateProduit({ titre: "x", prix_centimes: 1, images: ["javascript:alert(1)"] }).ok).toBe(false);
    expect(validateProduit({ titre: "x", prix_centimes: 1, images: ["http://exemple.fr/a.jpg"] }).ok).toBe(false);
    expect(validateProduit({ titre: "x", prix_centimes: 1, variantes: [{ nom: "M" }, { nom: "M" }] }).ok).toBe(false);
  });
  it("modification partielle : au moins un champ, jamais variantes", () => {
    expect(validateProduit({}, true).ok).toBe(false);
    expect(validateProduit({ actif: false }, true).ok).toBe(true);
    expect(validateProduit({ variantes: [{ nom: "M" }] }, true).ok).toBe(false);
  });
});

describe("validation boutique, catégorie, variante, statut", () => {
  it("boutique : adresse, couleurs, contacts, modes", () => {
    const ok = validateBoutique({ slug: "Chez-Awa", nom: "Chez Awa", email: "A@Exemple.fr", whatsapp: "+221 77 000 00 00", couleur_principale: "#2F5BFF", modes: ["retrait", "contact"] });
    expect(ok).toMatchObject({ ok: true, value: { slug: "chez-awa", email: "a@exemple.fr", whatsapp: "+221770000000", couleur_principale: "#2f5bff" } });
    for (const bad of [{ slug: "a", nom: "x" }, { slug: "admin", nom: "x" }, { slug: "ok-slug", nom: "x", email: "pas-un-mail" }, { slug: "ok-slug", nom: "x", whatsapp: "abc" },
      { slug: "ok-slug", nom: "x", couleur_principale: "rouge" }, { slug: "ok-slug", nom: "x", modes: ["poste"] }, { slug: "ok-slug", nom: "x", modes: [] }, { slug: "ok-slug", nom: "x", proprietaire_id: ID },
      { slug: "ok-slug", nom: "x", statut: "payee" }, { slug: "ok-slug", nom: "<b>x</b>" }, { slug: "ok-slug", nom: "x", logo: "data:image/png;base64,AAAA" }, { slug: "ok-slug", nom: "x", logo: "http://x.fr/a.png" }, "texte", null, []]) {
      expect(validateBoutique(bad).ok, JSON.stringify(bad)).toBe(false);
    }
  });
  it("catégorie, variante, statut", () => {
    expect(validateCategorie({ nom: "Habits" }).ok).toBe(true);
    expect(validateCategorie({ nom: "" }).ok).toBe(false);
    expect(validateVariante({ nom: "M", stock: 3 }).ok).toBe(true);
    for (const stock of [-1, 1.5, "3", 1_000_001]) expect(validateVariante({ nom: "M", stock }).ok).toBe(false);
    expect(validateStatut({ statut: "terminee" }).ok).toBe(true);
    for (const s of ["payee", "", 3, null]) expect(validateStatut({ statut: s }).ok).toBe(false);
    expect(validateStatut({ statut: "prete", paiement: "payee" }).ok).toBe(false);
  });
});

describe("validation de la commande publique", () => {
  it("accepte une commande correcte et ignore prix/total/paiement envoyés", () => {
    const r = validateCommande({ ...base, total_centimes: 1, paiement: "payee", lignes: [{ variante_id: ID, quantite: 2, prix_centimes: 1, prix: 0.01 }] });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.lignes).toEqual([{ variante_id: ID, quantite: 2 }]);
      expect(JSON.stringify(r.value)).not.toMatch(/prix|total|paiement/);
    }
  });
  it("refuse quantité 0, négative, décimale, texte ou énorme", () => {
    for (const q of [0, -1, 1.5, "2", 100, null]) expect(validateCommande({ ...base, lignes: [{ variante_id: ID, quantite: q }] }).ok).toBe(false);
  });
  it("refuse panier vide ou trop long, identifiant faux, clé trop courte, mode inconnu", () => {
    expect(validateCommande({ ...base, lignes: [] }).ok).toBe(false);
    expect(validateCommande({ ...base, lignes: Array.from({ length: 21 }, () => ({ variante_id: ID, quantite: 1 })) }).ok).toBe(false);
    expect(validateCommande({ ...base, lignes: [{ variante_id: "1; drop table", quantite: 1 }] }).ok).toBe(false);
    expect(validateCommande({ ...base, cle: "court" }).ok).toBe(false);
    expect(validateCommande({ ...base, mode: "poste" }).ok).toBe(false);
  });
  it("refuse e-mail invalide, absence de contact, adresse manquante en livraison", () => {
    expect(validateCommande({ ...base, client: { nom: "Awa", email: "pas-un-mail" } }).ok).toBe(false);
    expect(validateCommande({ ...base, client: { nom: "Awa" } }).ok).toBe(false);
    expect(validateCommande({ ...base, client: { nom: "Awa", telephone: "abc" } }).ok).toBe(false);
    expect(validateCommande({ ...base, mode: "livraison" }).ok).toBe(false);
    expect(validateCommande({ ...base, mode: "livraison", client: { nom: "Awa", email: "awa@exemple.fr", adresse: "1 rue X" } }).ok).toBe(true);
  });
  it("refuse l'injection de balises dans le nom, l'adresse et la note ; garde le SQL comme du simple texte", () => {
    expect(validateCommande({ ...base, client: { nom: "<img src=x onerror=alert(1)>", email: "a@b.fr" } }).ok).toBe(false);
    expect(validateCommande({ ...base, client: { nom: "Awa", email: "a@b.fr", note: "<script>x</script>" } }).ok).toBe(false);
    expect(validateCommande({ ...base, client: { nom: "Awa", email: "a@b.fr", note: "x\u0000y" } }).ok).toBe(false);
    expect(validateCommande({ ...base, client: { nom: "Robert'); DROP TABLE commandes;--", email: "a@b.fr" } }).ok).toBe(true); // texte inoffensif : requêtes paramétrées
  });
  it("refuse un corps qui n'est pas un objet", () => {
    for (const bad of [null, "x", 3, []]) expect(validateCommande(bad).ok).toBe(false);
  });
});
