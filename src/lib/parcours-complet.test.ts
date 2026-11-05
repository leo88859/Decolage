import { describe, expect, it } from "vitest";
import { generateNextProject } from "@/lib/codegen";
import { validateConfig } from "@/lib/config";
import { renderLanding } from "@/lib/landing";
import { newProjectFromIdee } from "@/lib/project";
import { siteData, slugError, suggestSlug, validateSiteData } from "@/lib/publish";
import { analyse } from "@/lib/remplissage";
import { defaultPricing } from "@/lib/pricing";
import { zip } from "@/lib/zip";

// Parcours complet sans réseau : idée -> noms -> design -> génération -> page de lancement -> projet Next.js (zip).
describe("parcours de création et de publication d'un SaaS", () => {
  const idee = "un logiciel de réservation pour mon salon de coiffure";

  it("va de l'idée au zip Next.js, de façon reproductible", () => {
    const a = analyse(idee);
    expect(a.noms.length).toBeGreaterThan(0);
    expect(a.design).toBeTruthy();
    const mk = () => newProjectFromIdee({ idee, type: a.type, secteur: a.secteur.id, nom: a.noms[0]!, design: a.design, fonctions: a.fonctions }, new Date("2026-01-01T09:00:00Z"));
    const p = mk();
    // Même idée = même résultat (pas d'IA).
    expect(analyse(idee).noms).toEqual(a.noms);
    expect({ ...mk(), id: "" }).toEqual({ ...p, id: "" });
    expect(validateConfig(p.config)).toEqual({});

    // Page de lancement publiable.
    const slug = suggestSlug(p.config.nom);
    expect(slugError(slug)).toBeNull();
    const v = validateSiteData(siteData(p));
    expect(v.ok).toBe(true);
    const html = renderLanding(p.config, p.landing, defaultPricing(p.config), { inlineCss: true, waitlist: { action: `/api/waitlist/${slug}`, merci: true } });
    expect(html).toContain(p.config.nom.replace(/&/g, "&amp;"));
    expect(html).toContain(`action="/api/waitlist/${slug}"`);

    // Projet Next.js téléchargeable (zip valide : signature locale, fichiers clés).
    const files = generateNextProject(p);
    const names = files.map((f) => f.name);
    expect(names).toEqual(expect.arrayContaining(["package.json", "README.md", "lib/config.ts"]));
    const z = zip(files);
    expect(Array.from(z.slice(0, 4))).toEqual([0x50, 0x4b, 0x03, 0x04]);
    expect(z.length).toBeGreaterThan(1000);
  });
});
