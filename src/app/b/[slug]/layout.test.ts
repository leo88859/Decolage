import { createElement } from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

// Rendu du layout des boutiques publiées : la mention « Créé avec Décollage » dépend UNIQUEMENT du booléen marque_blanche.
const h = vi.hoisted(() => ({ marque: undefined as unknown }));
vi.mock("server-only", () => ({}));
vi.mock("@/components/vitrine/load", () => ({
  chargerCatalogue: async () => ({
    etat: "ok",
    data: { boutique: { id: "b", slug: "chez-awa", nom: "Chez Awa", couleur_principale: "#1f45e0", couleur_accent: "#ff6b4a", adresse: null, modes: [] }, categories: [], produits: [], marque_blanche: h.marque },
  }),
}));
vi.mock("@/components/vitrine/CartProvider", () => ({ CartProvider: ({ children }: { children: unknown }) => children }));
vi.mock("@/components/vitrine/Chrome", () => ({ ContactLinks: () => null, VitrineHeader: () => null }));
vi.mock("@/components/vitrine/vitrine.css", () => ({}));

import Layout, { generateMetadata } from "./layout";

const rendre = async () => renderToStaticMarkup(await Layout({ children: createElement("p", null, "contenu"), params: Promise.resolve({ slug: "chez-awa" }) }));

describe("pied de page des boutiques", () => {
  it.each([[undefined], [false], ["true"], [1], [null]])("marque_blanche=%s : mention affichée", async (v) => {
    h.marque = v;
    expect(await rendre()).toContain("Créé avec");
  });
  it("marque_blanche=true : mention masquée, lien de suivi de commande conservé", async () => {
    h.marque = true;
    const html = await rendre();
    expect(html).not.toContain("Créé avec");
    expect(html).not.toContain("Décollage");
    expect(html).toContain("Suivre ma commande");
    expect(html).toContain("Chez Awa");
  });
  it("titres des pages enfants : « Décollage » par défaut, nom de la boutique si masquée", async () => {
    h.marque = false;
    expect(await generateMetadata({ params: Promise.resolve({ slug: "chez-awa" }) })).toEqual({});
    h.marque = true;
    expect(await generateMetadata({ params: Promise.resolve({ slug: "chez-awa" }) })).toEqual({ title: { template: "%s · Chez Awa", default: "Chez Awa" } });
  });
});
