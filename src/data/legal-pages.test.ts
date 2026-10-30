import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { PAID_PLANS, PLANS, prixLabel } from "../lib/plans";
import { champsManquants, dateFr, FOOTER_PRODUCT_LINKS, LEGAL, LEGAL_PAGES, PROPOSITIONS, supportContact, VERSIONS } from "./legal";

const APP = join(process.cwd(), "src", "app");
const pageFile = (route: string) => join(APP, ...route.split("/").filter(Boolean), "page.tsx");
const read = (route: string) => readFileSync(pageFile(route), "utf8");

describe("pages légales", () => {
  it("toutes les pages existent, avec un titre et le composant LegalPage", () => {
    expect(LEGAL_PAGES.map((p) => p.href).sort()).toEqual(["/accessibilite", "/cgu", "/cgv", "/confidentialite", "/contact", "/cookies", "/mentions-legales", "/remboursement"]);
    for (const p of LEGAL_PAGES) {
      expect(existsSync(pageFile(p.href)), p.href).toBe(true);
      const src = read(p.href);
      expect(src, p.href).toMatch(/metadata[^=]*=\s*\{\s*title:\s*"[^"]{3,}"/);
      expect(src, p.href).toMatch(/<LegalPage title="[^"]{3,}" doc="/);
      expect(src, p.href).toContain(`doc="${p.doc}"`);
    }
  });

  it("chaque document a une version datée valide", () => {
    for (const p of LEGAL_PAGES) {
      expect(VERSIONS[p.doc], p.doc).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(Number.isNaN(Date.parse(VERSIONS[p.doc]))).toBe(false);
    }
    expect(dateFr("2026-10-29")).toBe("29 octobre 2026");
  });

  it("aucune page n'affirme que Décollage est « conforme » et aucune ne parle d'IA", () => {
    for (const p of LEGAL_PAGES) {
      const src = read(p.href);
      expect(src, p.href).not.toMatch(/\bconforme\b|\bconformité totale\b/i);
      expect(src, p.href).not.toMatch(/\bIA\b|intelligence artificielle/);
    }
  });
});

describe("pied de page", () => {
  it("tous les liens pointent vers des routes qui existent", () => {
    const liens = [...FOOTER_PRODUCT_LINKS, ...LEGAL_PAGES].map((l) => l.href.split("#")[0] || "/");
    expect(liens.length).toBeGreaterThan(10);
    for (const href of liens) expect(existsSync(pageFile(href)), href).toBe(true);
  });
  it("le pied de page contient le bouton « Gérer mes cookies » et est branché dans le layout", () => {
    const footer = readFileSync(join(process.cwd(), "src", "components", "Footer.tsx"), "utf8");
    expect(footer).toContain("ManageCookiesButton");
    expect(footer).toContain("LEGAL_PAGES");
    const layout = readFileSync(join(APP, "layout.tsx"), "utf8");
    expect(layout).toContain("<Footer />");
    expect(layout).toContain("<ConsentManager />");
    expect(layout).toMatch(/id="contenu"[^>]*tabIndex=\{-1\}/);
  });
});

describe("CGV : prix et offres", () => {
  const cgv = read("/cgv");
  it("les prix viennent de PLANS, jamais écrits en dur", () => {
    expect(cgv).toContain('from "@/lib/plans"');
    expect(cgv).toMatch(/PAID_PLANS\.map/);
    expect(cgv).toContain("prixLabel(");
    expect(cgv).not.toMatch(/\d+\s*[.,]\s*\d{2}\s*(€|euros?)/);
    expect(cgv).not.toMatch(/\b\d+\s*€/);
  });
  it("les prix réels (Solo 2,99 / Pro 9,99 / Illimité 29,99) sortent bien de PLANS", () => {
    expect(PAID_PLANS.map((p) => PLANS[p].prix)).toEqual([2.99, 9.99, 29.99]);
    expect(prixLabel("solo")).toContain("2,99");
    expect(prixLabel("pro")).toContain("9,99");
    expect(prixLabel("illimite")).toContain("29,99");
  });
  it("mentionne rétractation de 14 jours, renonciation, renouvellement et résiliation en ligne", () => {
    expect(cgv).toContain("14 jours");
    expect(cgv).toContain("pleinement exécuté");
    expect(cgv).toMatch(/se renouvelle automatiquement/);
    expect(cgv).toMatch(/résiliation[^.]*en ligne/);
    expect(cgv).toContain("mensuel");
  });
});

describe("informations légales non vérifiées", () => {
  it("aucune donnée personnelle non confirmée n'est codée en dur dans legal.ts", () => {
    const src = readFileSync(join(process.cwd(), "src", "data", "legal.ts"), "utf8");
    expect(src).not.toMatch(/Dechantier|rue de Lille/i);
  });
  it("les champs à compléter sont listés quand ils sont vides, et rien n'est listé quand tout est rempli", () => {
    const vide: typeof LEGAL = {
      ...LEGAL, editeur: "", statut: "", siret: "", adresse: "", email: "", telephone: "",
      directeurPublication: "", contactSupport: "", site: "", tva: "",
      mediateur: { nom: "", site: "" }, hebergeur: { nom: "Vercel Inc.", site: "https://vercel.com", adresse: "" },
    };
    const cles = champsManquants(vide).map((c) => c.cle);
    for (const k of ["editeur", "adresse", "email", "telephone", "siret", "statut", "directeurPublication", "mediateur"]) expect(cles).toContain(k);
    const rempli = {
      ...LEGAL, editeur: "A B", statut: "EI", siret: "123", adresse: "1 rue X", email: "a@b.fr", telephone: "0102030405",
      directeurPublication: "A B", contactSupport: "s@b.fr", site: PROPOSITIONS.site, tva: PROPOSITIONS.tva,
      mediateur: { nom: "M", site: "https://m.fr" }, hebergeur: { ...LEGAL.hebergeur, adresse: "x" },
    };
    expect(champsManquants(rempli)).toEqual([]);
  });
  it("le contact support retombe sur l'e-mail de l'éditeur", () => {
    expect(supportContact()).toBe(LEGAL.contactSupport || LEGAL.email);
  });
});
