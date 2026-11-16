import { readFileSync } from "node:fs";
import { createElement } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

// Les SIX thèmes de boutique avec la marque du client : vraie route catalogue, vraie lecture (load.ts), vrai layout,
// vrai en-tête ; seule la base est simulée en mémoire. Le rendu visuel (pixels) n'est pas testé ici : ce sont des tests de HTML et de CSS.
type Row = Record<string, unknown>;
const h = vi.hoisted(() => ({ db: {} as Record<string, Row[]> }));

class Query {
  private filters: [string, unknown][] = [];
  private cols: string[] | null = null;
  select(c: string) { this.cols = c === "*" ? null : c.split(",").map((s) => s.trim()); return this; }
  eq(c: string, v: unknown) { this.filters.push([c, v]); return this; }
  order() { return this; }
  constructor(private table: string) {}
  private run() {
    const rows = (h.db[this.table] ?? []).filter((r) => this.filters.every(([c, v]) => r[c] === v));
    return { data: rows.map((r) => (this.cols ? Object.fromEntries(this.cols.filter((c) => c in r).map((c) => [c, r[c]])) : { ...r })), error: null };
  }
  maybeSingle() { const r = this.run(); return Promise.resolve({ data: r.data[0] ?? null, error: null }); }
  then<T>(res: (v: ReturnType<Query["run"]>) => T) { return Promise.resolve(this.run()).then(res); }
}

vi.mock("server-only", () => ({}));
vi.mock("@/lib/env", () => ({ isCloudConfigured: () => true, appUrl: () => "https://app.test" }));
vi.mock("@/lib/supabase/server", () => ({
  createAdminClient: () => ({ from: (t: string) => new Query(t) }),
  createPublicClient: () => ({ from: (t: string) => new Query(t) }),
}));
vi.mock("@/components/vitrine/vitrine.css", () => ({}));

import Layout, { generateMetadata } from "./layout";
import { THEMES } from "@/lib/boutique/themes";
import { appliquerMarque, orEcrin, type CataloguePub } from "@/components/vitrine/logic";
import { chargerCatalogue } from "@/components/vitrine/load";

const PNG = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==";
const brandRow = (over: Row = {}) => ({
  user_id: "u-1", name: "Atelier Lumière", color_primary: "#12ab34", color_secondary: "#223344", color_accent: "#aa5500",
  color_surface: "#f6f1e7", color_text: "#0b1330", logo_data: PNG, favicon_data: PNG, version: 1, updated_at: "2026-11-15T10:00:00Z", ...over,
});
function setup(theme: string, plan: string, ent: boolean | undefined, brand: Row | null = brandRow()) {
  h.db = {
    boutiques: [{ id: "b1", slug: "chez-awa", nom: "Chez Awa", description: "Chez Awa, des bougies.", couleur_principale: "#1f45e0", couleur_accent: "#ff6b4a", logo: null, adresse: "1 rue des Lilas", theme, statut: "publiee", proprietaire_id: "u-1" }],
    categories: [], produits: [], variantes_publiques: [],
    profiles: [{ id: "u-1", plan }],
    brand_entitlements: ent === undefined ? [] : [{ user_id: "u-1", enabled: ent }],
    brand_configs: brand ? [brand] : [],
  };
}
const params = Promise.resolve({ slug: "chez-awa" });
// Le cache de React (cache()) n'existe pas hors rendu serveur : chaque appel relit la base simulée.
const rendre = async () => renderToStaticMarkup(await Layout({ children: createElement("p", null, "contenu"), params }));

beforeEach(() => setup("classique", "pro", undefined));

describe.each(THEMES.map((t) => t.id))("thème %s avec la marque du client (droit actif)", (theme) => {
  beforeEach(() => setup(theme, "pro", undefined));
  it("couleurs, nom, logo et thème appliqués ; aucune mention ni lien Décollage", async () => {
    const html = await rendre();
    expect(html).toContain(`data-theme="${theme}"`);
    expect(html).toContain("--vt-main:#12ab34");
    expect(html).toContain("--vt-accent:#aa5500");
    expect(html).toContain("Atelier Lumière"); // en-tête et pied de page
    expect(html).toContain(`<img src="${PNG}"`); // logo de la marque
    expect(html).not.toContain("Chez Awa");
    expect(html).not.toContain("Créé avec");
    expect(html).not.toMatch(/d[ée]collage/i);
    expect(html).not.toContain('href="/"');
    expect(html).toContain("Suivre ma commande");
  });
  it("métadonnées : titre de la boutique, nom d'application, Open Graph et favicon du client", async () => {
    const m = await generateMetadata({ params });
    expect(m).toMatchObject({ title: { template: "%s · Atelier Lumière", default: "Atelier Lumière" }, applicationName: "Atelier Lumière", openGraph: { siteName: "Atelier Lumière" }, icons: { icon: PNG } });
  });
});

describe("marque sans favicon, ou sans droit", () => {
  it("sans favicon : icône aux initiales et à la couleur de la marque (jamais l'icône Décollage)", async () => {
    setup("atelier", "pro", undefined, brandRow({ favicon_data: null, logo_data: null }));
    const m = await generateMetadata({ params });
    const icon = (m.icons as { icon: string }).icon;
    expect(icon).toMatch(/^data:image\/svg\+xml,/);
    expect(decodeURIComponent(icon)).toContain("#12ab34");
    expect(decodeURIComponent(icon)).toContain(">AL<");
  });
  it.each([["solo", false], ["solo", undefined], ["gratuit", true]])("%s (option %s) : boutique d'origine, mention conservée", async (plan, ent) => {
    setup("ecrin", plan, ent);
    const html = await rendre();
    expect(html).toContain("Chez Awa");
    expect(html).toContain("--vt-main:#1f45e0");
    expect(html).not.toContain("Atelier Lumière");
    expect(html).not.toContain(PNG);
    expect(html).toContain("Créé avec");
    expect(await generateMetadata({ params })).toEqual({});
  });
  it("Solo AVEC option : marque appliquée", async () => {
    setup("street", "solo", true);
    expect(await rendre()).toContain("Atelier Lumière");
  });
  it("droit actif mais aucune marque enregistrée : mention masquée, boutique d'origine (couleurs et nom du commerçant)", async () => {
    setup("marche", "pro", undefined, null);
    const html = await rendre();
    expect(html).not.toContain("Créé avec");
    expect(html).toContain("Chez Awa");
    expect(html).toContain("--vt-main:#1f45e0");
  });
});

describe("Écrin : l'or suit l'accent de la marque s'il reste lisible", () => {
  it("accent clair : variable --vt-gold à la couleur de la marque", async () => {
    setup("ecrin", "pro", undefined, brandRow({ color_accent: "#e08a00" }));
    expect(await rendre()).toContain("--vt-gold:#e08a00");
  });
  it("accent sombre (illisible sur noir) : repli sur l'or d'origine", () => {
    expect(orEcrin("#222222")).toBe("#e6cf8a");
    expect(orEcrin("#ffd700")).toBe("#ffd700");
  });
});

describe("appliquerMarque (pure)", () => {
  const base = (over: Partial<CataloguePub> = {}): CataloguePub => ({
    boutique: { id: "b", slug: "chez-awa", nom: "Chez Awa", description: "Bienvenue chez Awa. Chez Awa, des bougies.", couleur_principale: "#1f45e0", couleur_accent: "#ff6b4a", logo: null, adresse: "", whatsapp: null, email: null, telephone: null, modes: [], published_at: null },
    categories: [], produits: [], ...over,
  });
  it("sans marque ou sans droit : même objet", () => {
    const d = base();
    expect(appliquerMarque(d)).toBe(d);
    const e = base({ marque: { nom: "X", couleur_principale: "#111111", couleur_accent: null, logo: null, icone: PNG } });
    expect(appliquerMarque(e)).toBe(e); // marque_blanche absent : jamais appliquée
  });
  it("couleur ou logo invalides : repli sur ceux de la boutique", () => {
    const d = appliquerMarque(base({ marque_blanche: true, marque: { nom: "Atelier", couleur_principale: "rouge;}</style>", couleur_accent: null, logo: "data:image/svg+xml;base64,PHN2Zz4=", icone: PNG } }));
    expect(d.boutique.couleur_principale).toBe("#1f45e0");
    expect(d.boutique.couleur_accent).toBe("#ff6b4a");
    expect(d.boutique.logo).toBeNull();
    expect(d.boutique.nom).toBe("Atelier");
    expect(d.boutique.description).toBe("Bienvenue chez Awa. Atelier, des bougies.");
  });
});

describe("les six thèmes : feuille de style", () => {
  const css = readFileSync("src/components/vitrine/vitrine.css", "utf8");
  it("chaque thème a son bloc de mise en page ; les couleurs de la marque restent des variables", () => {
    for (const t of THEMES) if (t.id !== "classique") expect(css).toContain(`.vt[data-theme="${t.id}"]`);
    expect(css).toMatch(/\.vt-btn[^{]*\{[^}]*var\(--vt-main\)/);
    expect(css).toMatch(/data-theme="street"\] \.vt-head[^{]*\{[^}]*var\(--vt-accent\)/);
    expect(css).toMatch(/data-theme="marche"\] \.vt-head[^{]*\{[^}]*var\(--vt-accent\)/);
    expect(css).toMatch(/data-theme="vitrine"\] \.vt-count[^{]*\{[^}]*var\(--vt-main\)/);
    expect(css).toMatch(/data-theme="atelier"\] \.vt-chip\[aria-pressed="true"\][^{]*\{[^}]*var\(--vt-main\)/);
  });
  it("Écrin : l'or n'est plus écrit en dur (variable --vt-gold avec l'or d'origine en repli)", () => {
    const ecrin = css.split("\n").filter((l) => l.includes('data-theme="ecrin"'));
    expect(ecrin.length).toBeGreaterThan(5);
    for (const l of ecrin) expect(l.replace(/var\(--vt-gold, #e6cf8a\)/g, "")).not.toContain("#e6cf8a");
  });
  it("la barre et le pied de page de Décollage sont absents du HTML des boutiques (garde client + CSS de secours)", () => {
    const racine = readFileSync("src/app/layout.tsx", "utf8");
    expect(racine).toMatch(/<HorsVitrine><Nav \/><\/HorsVitrine>/);
    expect(racine).toMatch(/<HorsVitrine><Footer \/><\/HorsVitrine>/);
    expect(css).toContain("body > header.nav, body > footer.site-footer { display: none !important; }");
  });
});

// chargerCatalogue est importé pour garantir que le module réel (et non un mock) est celui testé.
it("load.ts applique la marque au catalogue lu par la vraie route", async () => {
  setup("vitrine", "pro", undefined);
  const r = await chargerCatalogue("chez-awa");
  expect(r.etat).toBe("ok");
  if (r.etat === "ok") expect(r.data.boutique).toMatchObject({ nom: "Atelier Lumière", couleur_principale: "#12ab34", logo: PNG });
});
