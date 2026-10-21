import { describe, expect, it } from "vitest";
import { TEMPLATES } from "@/data/templates";
import { validateConfig } from "@/lib/config";
import { applyFonctions } from "@/lib/fonctions";
import { newProjectFromIdee } from "@/lib/project";
import { switchTemplate } from "@/lib/switch";

describe("changer de type de SaaS", () => {
  const p = newProjectFromIdee({ idee: "réservations coiffeur avec carte", type: "rendez-vous", secteur: "coiffure", nom: "Coiffio", design: "neon", fonctions: ["carte", "favoris"] });
  const cfg = { ...p.config, logo: "data:image/svg+xml;base64,AAAA", domaine: "coiffio.fr", couleurs: { primaire: "#123456", accent: "#abcdef" } };

  it("garde l'identité, l'apparence et les pages ajoutées", () => {
    const { config } = switchTemplate(cfg, "boutique");
    expect(config.templateId).toBe("boutique");
    expect(config.nom).toBe("Coiffio");
    expect(config.design).toBe("neon");
    expect(config.style).toBe(cfg.style);
    expect(config.couleurs).toEqual(cfg.couleurs);
    expect(config.logo).toBe(cfg.logo);
    expect(config.domaine).toBe("coiffio.fr");
    expect(config.extras).toEqual(["carte"]);
    expect(config.modules).toEqual(expect.arrayContaining(["favoris", "dashboard"]));
  });

  it("reste valide pour tous les couples de types", () => {
    for (const from of TEMPLATES) {
      const start = applyFonctions({ ...cfg, ...switchTemplate(cfg, from.id).config }, ["paiement", "stats", "export"]).config;
      for (const to of TEMPLATES) {
        const { config } = switchTemplate(start, to.id);
        expect(validateConfig(config), `${from.id} → ${to.id}`).toEqual({});
      }
    }
  });

  it("revenir au type de départ ne perd rien d'important", () => {
    const back = switchTemplate(switchTemplate(cfg, "crm").config, "rendez-vous").config;
    expect(back.nom).toBe(cfg.nom);
    expect(back.design).toBe(cfg.design);
    expect(back.modules).toEqual(expect.arrayContaining(cfg.modules));
  });
});
