import { describe, expect, it } from "vitest";
import { archOf } from "@/data/archetypes";
import { DEMO } from "@/data/demo";
import { DESIGN_BY_ID, designFor, DESIGNS } from "@/data/designs";
import { detectFonctions, FONCTIONS } from "@/lib/fonctions";
import { SECTEUR_GENERAL, SECTEURS } from "@/data/secteurs";
import { TEMPLATE_BY_ID, TEMPLATES } from "@/data/templates";
import { validateConfig } from "@/lib/config";
import { renderLanding } from "@/lib/landing";
import { contenuOf, newProjectFromIdee } from "@/lib/project";
import { cleanContenu, siteData, validateSiteData } from "@/lib/publish";
import { prototypeData, renderPrototype } from "@/lib/prototype";
import { analyse, buildContenu, detectSecteur, detectType, suggestNames } from "@/lib/remplissage";

describe("détection sans IA", () => {
  it("reconnaît le type et le secteur", () => {
    expect(detectType("Une appli pour que les clients d'un coiffeur réservent en ligne").type).toBe("rendez-vous");
    expect(detectSecteur("Une appli pour que les clients d'un coiffeur réservent en ligne").id).toBe("coiffure");
    expect(detectType("Je vends des bougies faites main").type).toBe("boutique");
    expect(detectType("Suivre mon budget et mes dépenses").type).toBe("suivi-gains");
    expect(detectSecteur("Suivre mon budget et mes dépenses").id).toBe("budget");
  });
  it("même idée, même résultat", () => {
    expect(analyse("cours de guitare en ligne")).toEqual(analyse("cours de guitare en ligne"));
  });
  it("propose 6 noms distincts", () => {
    const n = suggestNames("salon de coiffure", "rendez-vous", SECTEURS.find((s) => s.id === "coiffure")!);
    expect(n).toHaveLength(6);
    expect(new Set(n).size).toBe(6);
    expect(n.every((x) => x.length > 0 && x.length <= 40)).toBe(true);
  });
});

describe("fonctions demandées dans le texte", () => {
  const idee = "Une appli de réservation pour coiffeur avec paiement en ligne, rappels par SMS et une carte des salons";
  it("repère les fonctions sans fausser le type ni le métier", () => {
    const ids = detectFonctions(idee).map((x) => x.f.id);
    expect(ids).toEqual(expect.arrayContaining(["paiement", "notifications", "carte"]));
    const a = analyse(idee);
    expect(a.type).toBe("rendez-vous");
    expect(a.secteur.id).toBe("coiffure");
  });
  it("ne confond pas « carte de fidélité » avec une carte géographique", () => {
    expect(detectFonctions("une carte de fidélité pour les cafés").map((x) => x.f.id)).not.toContain("carte");
  });
  it("active les briques et ajoute les pages", () => {
    const p = newProjectFromIdee({ idee, type: "rendez-vous", secteur: "coiffure", nom: "Coiffio", design: "aurora", fonctions: ["paiement", "notifications", "carte", "messages"] });
    expect(p.config.modules).toEqual(expect.arrayContaining(["abonnement", "notifications"]));
    expect(p.config.extras).toEqual(["carte", "conversation"]);
    expect(validateConfig(p.config)).toEqual({});
    expect(prototypeData(p.config).pages.map((x) => x.kind)).toEqual(expect.arrayContaining(["carte", "conversation"]));
  });
  it("toutes les fonctions sur tous les types gardent une configuration valide", () => {
    for (const t of TEMPLATES) {
      const p = newProjectFromIdee({ idee: "test", type: t.id, secteur: "general", nom: "Test", design: "aurora", fonctions: FONCTIONS.map((f) => f.id) });
      expect(validateConfig(p.config), t.id).toEqual({});
    }
  });
  it("chaque métier a un design proposé", () => {
    for (const s of SECTEURS) expect(DESIGN_BY_ID[designFor("rendez-vous", s.id).id]).toBeDefined();
    expect(analyse("logiciel de support pour une boîte informatique").design).toBe("terminal");
  });
});

describe("contenu pour chaque type et chaque secteur", () => {
  for (const t of TEMPLATES) {
    it(t.id, () => {
      for (const s of [...SECTEURS, SECTEUR_GENERAL]) {
        const c = buildContenu(`idée ${s.nom}`, t.id, s.id);
        const all = JSON.stringify(c);
        expect(all).not.toMatch(/undefined|NaN|\{(clients|client|pros|metier|lieu|action|douleur|benefice|offre|categorie)\}/);
        expect(c.lignes).toHaveLength(DEMO[t.id].rows.length);
        for (const r of c.lignes) {
          expect(r).toHaveLength(TEMPLATE_BY_ID[t.id].entite.champs.length);
          expect(c.statuts).toContain(r[DEMO[t.id].status]);
        }
        // Formats attendus par les pages : créneaux, pourcentages, montants.
        if (t.id === "rendez-vous") expect(c.lignes[0]![1]).toMatch(/^\p{L}+\.? \d\d:\d\d$/u);
        if (t.id === "boutique") expect(c.lignes.every((r) => /€|Gratuit/.test(r[1]!))).toBe(true);
        expect(cleanContenu(c, t.id)).toEqual(c);
      }
    });
  }
});

describe("projet créé à partir d'une idée", () => {
  const p = newProjectFromIdee({ idee: "réservations pour un salon de coiffure", type: "rendez-vous", secteur: "coiffure", nom: "Coiffio", design: "neon" });
  it("applique le design et reste valide", () => {
    expect(p.config.design).toBe("neon");
    expect(p.config.style).toBe("neon");
    expect(validateConfig(p.config)).toEqual({});
    expect(p.landing.layout).toBe("split");
  });
  it("le prototype utilise les données et le design", () => {
    const d = prototypeData(p.config, "accueil", contenuOf(p));
    expect(d.rows).toEqual(p.contenu!.lignes);
    expect(d.dash).toBe("rings");
    expect(d.features.some(([a, b]) => `${a}${b}`.includes("{nom}"))).toBe(false);
    expect(renderPrototype(p.config, "accueil", p.contenu)).toContain("shell-top dash-rings anim-glow");
  });
  it("la landing utilise les textes remplis", () => {
    const html = renderLanding(p.config, p.landing, null, { inlineCss: true, contenu: p.contenu });
    expect(html).toContain("Coiffio");
    expect(html).not.toContain("{nom}");
  });
  it("chaque type de SaaS a un tableau de bord et une configuration valide", () => {
    for (const t of TEMPLATES) {
      const x = newProjectFromIdee({ idee: "test", type: t.id, secteur: "general", nom: "Test", design: "bento" });
      expect(validateConfig(x.config)).toEqual({});
      const pages = prototypeData(x.config).pages;
      // Architecture dédiée : un écran « app » (premier écran de l'espace utilisateur) à la place du tableau de bord générique.
      if (archOf(t.id).id !== "classic") expect(pages.filter((pg) => pg.id === "app").length).toBe(1);
      else expect(pages.filter((pg) => pg.kind === "dashboard").length).toBe(t.id === "liste-attente" ? 0 : 1);
    }
  });
  it("le contenu est ignoré si le modèle change", () => {
    expect(contenuOf({ ...p, config: { ...p.config, templateId: "crm" } })).toBeUndefined();
  });
  it("chaque design produit des classes différentes", () => {
    const classes = DESIGNS.map((d) => {
      const x = newProjectFromIdee({ idee: "boutique de bougies", type: "boutique", secteur: "artisanat", nom: "Bougie", design: d.id });
      return renderPrototype(x.config, "accueil", x.contenu).match(/class="(s-[^"]+)"/)![1];
    });
    expect(new Set(classes).size).toBe(10);
  });
  it("publication : le contenu passe la validation, un contenu modifié est refusé", () => {
    const v = validateSiteData(siteData(p));
    expect(v.ok && v.data.contenu?.lignes).toEqual(p.contenu!.lignes);
    const bad = { ...siteData(p), contenu: { ...p.contenu!, lignes: [["<script>"]] } };
    expect(validateSiteData(bad).ok).toBe(false);
    expect(validateSiteData({ ...siteData(p), config: { ...p.config, design: "x\" onload=\"" } }).ok).toBe(false);
  });
});
