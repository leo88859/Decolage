import { beforeEach, describe, expect, it, vi } from "vitest";

// Marque blanche des sites publiés : vraies routes /s/[slug] et /s/[slug]/app, vraie décision de droit,
// base simulée en mémoire. Aucun navigateur : ce sont des tests de HTML produit (le rendu visuel mobile n'est PAS testé ici).

type Row = Record<string, unknown>;
const h = vi.hoisted(() => ({ db: {} as Record<string, Row[]>, failing: new Set<string>(), adminOk: true }));

class Query {
  private filters: [string, unknown][] = [];
  private cols: string[] | null = null;
  constructor(private table: string, private admin: boolean) {}
  select(c: string) { this.cols = c === "*" ? null : c.split(",").map((s) => s.trim()); return this; }
  eq(c: string, v: unknown) { this.filters.push([c, v]); return this; }
  private run(): { data: Row[] | null; error: { code: string } | null } {
    if (h.failing.has(this.table + (this.admin ? ":admin" : ""))) return { data: null, error: { code: "08006" } };
    const rows = (h.db[this.table] ?? []).filter((r) => this.filters.every(([c, v]) => r[c] === v));
    return { data: rows.map((r) => (this.cols ? Object.fromEntries(this.cols.filter((c) => c in r).map((c) => [c, r[c]])) : { ...r })), error: null };
  }
  maybeSingle() { const r = this.run(); return Promise.resolve({ data: r.data ? (r.data[0] ?? null) : null, error: r.error }); }
}

vi.mock("server-only", () => ({}));
vi.mock("@/lib/env", () => ({ isCloudConfigured: () => true, appUrl: () => "https://app.test" }));
vi.mock("@/lib/supabase/server", () => ({
  createAdminClient: () => { if (!h.adminOk) throw new Error("no key"); return { from: (t: string) => new Query(t, true) }; },
  createPublicClient: () => ({ from: (t: string) => new Query(t, false) }),
}));

import { GET as landingRoute } from "./[slug]/route";
import { GET as appRoute } from "./[slug]/app/route";
import { NextRequest } from "next/server";
import { renderLanding } from "@/lib/landing";
import { newProjectFromIdee } from "@/lib/project";
import { LANDING_LAYOUTS } from "@/lib/types";
import { computeEffectiveBrand } from "@/lib/brand/effective";
import { applyBrandToConfig, siteBrandFrom } from "@/lib/brand/site-brand";

const PNG = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==";
const projet = (nom: string) => newProjectFromIdee({ idee: "boutique de bougies artisanales", type: "boutique", secteur: "artisanat", nom, design: "vitrine" });

function siteRow(slug: string, owner: string, nom: string, layout?: string) {
  const x = projet(nom);
  return { slug, user_id: owner, suspended_at: null, data: { config: x.config, landing: layout ? { ...x.landing, layout } : x.landing, pricing: null, contenu: x.contenu } };
}
const brandRow = (owner: string, over: Row = {}) => ({
  user_id: owner, name: "Atelier Lumière", color_primary: "#12ab34", color_secondary: "#223344", color_accent: "#aa5500",
  color_surface: "#f6f1e7", color_text: "#0b1330", logo_data: null, favicon_data: null, version: 1, updated_at: "2026-11-15T10:00:00Z", ...over,
});

function setup(plan: string, ent: boolean | undefined, row: Row | null, layout?: string) {
  h.db = {
    sites: [siteRow("bougie-lune", "u-1", "Bougie Lune", layout), siteRow("autre-site", "u-2", "Autre Site")],
    profiles: [{ id: "u-1", plan }, { id: "u-2", plan: "pro" }],
    brand_entitlements: ent === undefined ? [] : [{ user_id: "u-1", enabled: ent }],
    brand_configs: [...(row ? [row] : []), brandRow("u-2", { name: "Deuxième Maison", color_primary: "#990000" })],
  };
}
const ctx = (slug: string) => ({ params: Promise.resolve({ slug }) });
const page = async (slug = "bougie-lune") => (await landingRoute(new NextRequest(`https://app.test/s/${slug}`), ctx(slug) as never)).text();
const demo = async (slug = "bougie-lune") => (await appRoute(new NextRequest(`https://app.test/s/${slug}/app`), ctx(slug) as never)).text();

beforeEach(() => { h.failing.clear(); h.adminOk = true; setup("solo", true, brandRow("u-1")); });

describe("site publié AVEC droit", () => {
  it("nom, couleur, titre, og:site_name ; aucune mention Décollage", async () => {
    const html = await page();
    expect(html).toContain("<title>Atelier Lumière</title>");
    expect(html).toContain('<meta property="og:title" content="Atelier Lumière">');
    expect(html).toContain('<meta property="og:site_name" content="Atelier Lumière">');
    expect(html).toContain("--brand-primary:#12ab34");
    expect(html).toContain("#12ab34");
    expect(html).toContain("</span>Atelier Lumière</div>"); // en-tête visible
    expect(html).not.toContain("Bougie Lune");
    expect(html).not.toMatch(/Décollage|decollage/i);
  });
  it("Pro : droit sans option ; la démo de l'application porte aussi le nom", async () => {
    setup("pro", undefined, brandRow("u-1"));
    expect(await page()).toContain("<title>Atelier Lumière</title>");
    expect(await demo()).toContain("Atelier Lumière — prototype");
  });
  it.each(LANDING_LAYOUTS)("variante « %s » : la marque s'applique et la structure responsive reste", async (layout) => {
    setup("solo", true, brandRow("u-1", { logo_data: PNG, favicon_data: PNG }), layout);
    const html = await page();
    expect(html).toContain("<title>Atelier Lumière</title>");
    expect(html).toContain("#12ab34");
    expect(html).toContain(`<img src="${PNG}" alt="">`);
    expect(html).toContain('name="viewport" content="width=device-width, initial-scale=1"');
    expect(html).toContain("@media(max-width:"); // règles mobiles toujours présentes (rendu réel : test navigateur à faire)
    expect(html).toContain(`<link rel="icon" type="image/png" href="${PNG}">`);
    expect(html).not.toMatch(/Décollage/);
  });
  it("favicon absent : aucune balise icon", async () => {
    expect(await page()).not.toContain('rel="icon"');
  });
});

describe("site publié SANS droit", () => {
  it("Solo sans option : aucune identité imposée, mention Décollage conservée", async () => {
    setup("solo", false, brandRow("u-1", { logo_data: PNG, favicon_data: PNG }));
    const html = await page();
    expect(html).toContain("<title>Bougie Lune</title>");
    expect(html).toContain("de Décollage, qui héberge ce site");
    expect(html).not.toContain("Atelier Lumière");
    expect(html).not.toContain("--brand-primary");
    expect(html).not.toContain("og:site_name");
    expect(html).not.toContain('rel="icon"');
    expect(html).not.toContain(PNG);
  });
  it("Gratuit : idem, même avec un ancien droit en base", async () => {
    setup("gratuit", true, brandRow("u-1"));
    const html = await page();
    expect(html).toContain("<title>Bougie Lune</title>");
    expect(html).not.toContain("Atelier Lumière");
  });
  it("perte du droit : retour au rendu sans droit, identité conservée en base", async () => {
    expect(await page()).toContain("Atelier Lumière");
    setup("solo", false, brandRow("u-1")); // option retirée : la ligne brand_configs reste
    const html = await page();
    expect(html).toContain("<title>Bougie Lune</title>");
    expect(html).not.toContain("Atelier Lumière");
    expect(h.db.brand_configs.find((r) => r.user_id === "u-1")?.name).toBe("Atelier Lumière");
  });
  it("lecture du droit en échec ou clé absente : fail-closed, rendu sans droit", async () => {
    h.failing.add("brand_configs:admin");
    expect(await page()).toContain("<title>Bougie Lune</title>");
    h.failing.clear(); h.adminOk = false;
    expect(await page()).toContain("<title>Bougie Lune</title>");
  });
  it("le droit ne vient jamais de l'URL ni des en-têtes", async () => {
    setup("solo", false, brandRow("u-1"));
    const req = new NextRequest("https://app.test/s/bougie-lune?marque=1&entitled=true&plan=pro", { headers: { "x-plan": "pro", "x-white-label": "1" } });
    expect(await (await landingRoute(req, ctx("bougie-lune") as never)).text()).toContain("<title>Bougie Lune</title>");
  });
});

describe("configuration incomplète ou hostile", () => {
  it("ligne vide : nom « Ma marque », pas de undefined ni de valeur vide", async () => {
    setup("pro", undefined, { user_id: "u-1", name: "", color_primary: null, color_secondary: "", color_accent: undefined, logo_data: null, favicon_data: null });
    const html = await page();
    expect(html).toContain("<title>Ma marque</title>");
    expect(html).toContain('og:site_name" content="Ma marque"');
    expect(html).not.toMatch(/undefined|content=""|href=""|src=""/);
    expect(html).toContain("--brand-primary:#2f5bff"); // couleur par défaut, jamais vide
  });
  it("aucune ligne brand_configs : rendu habituel du projet", async () => {
    setup("pro", undefined, null);
    expect(await page()).toContain("<title>Bougie Lune</title>");
  });
  it("couleur hostile : absente du HTML, couleur de repli", async () => {
    setup("pro", undefined, brandRow("u-1", { color_primary: "red;background:url(https://evil.example/x)", color_accent: "#fff}</style><script>alert(1)</script>" }));
    const html = await page();
    expect(html).not.toContain("evil.example");
    expect(html).not.toContain("background:url(https");
    expect(html).not.toContain("alert(1)");
    expect(html).toContain("--brand-primary:#2f5bff");
  });
  it("nom hostile : échappé", async () => {
    setup("pro", undefined, brandRow("u-1", { name: '<img src=x onerror=alert(1)>' }));
    const html = await page();
    expect(html).not.toContain("<img src=x");
  });
  it("logo invalide : aucune balise img cassée, on garde les initiales", async () => {
    setup("pro", undefined, brandRow("u-1", { logo_data: "https://evil.example/logo.png", favicon_data: "data:image/svg+xml;base64,PHN2Zz4=" }));
    const html = await page();
    expect(html).not.toContain("evil.example");
    expect(html).not.toContain("svg+xml");
    expect(html).not.toMatch(/<img src="(?!data:image\/(png|jpeg|webp);base64,)/);
    expect(html).not.toContain('rel="icon"');
    expect(html).toContain('<span class="mark">');
  });
});

describe("deux comptes", () => {
  it("chaque site porte SON identité", async () => {
    const a = await page("bougie-lune");
    const b = await page("autre-site");
    expect(a).toContain("<title>Atelier Lumière</title>");
    expect(a).not.toContain("Deuxième Maison");
    expect(b).toContain("<title>Deuxième Maison</title>");
    expect(b).toContain("#990000");
    expect(b).not.toContain("Atelier Lumière");
  });
});

describe("non-régression : sites sans marque blanche", () => {
  it.each(LANDING_LAYOUTS)("« %s » : marque null ou absente = même HTML, comme avant", (layout) => {
    const x = projet("Bougie Lune");
    const l = { ...x.landing, layout };
    const base = renderLanding(x.config, l, null, { inlineCss: true, contenu: x.contenu, waitlist: { action: "/api/waitlist/s" } });
    const nul = renderLanding(x.config, l, null, { inlineCss: true, contenu: x.contenu, waitlist: { action: "/api/waitlist/s" }, marque: null });
    expect(nul).toBe(base);
    expect(base).toContain("<title>Bougie Lune</title>");
    expect(base).toContain("de Décollage, qui héberge ce site");
    expect(base).not.toContain("og:site_name");
    expect(base).not.toContain("--brand-");
  });
  it("sans marque, la config est rendue telle quelle (même objet)", () => {
    const x = projet("Bougie Lune");
    expect(applyBrandToConfig(x.config, null)).toBe(x.config);
  });
  it("siteBrandFrom : droit refusé ou rien d'enregistré -> null", () => {
    expect(siteBrandFrom(null)).toBeNull();
    expect(siteBrandFrom(computeEffectiveBrand({ plan: "solo", optionActive: false, row: brandRow("u") }))).toBeNull();
    expect(siteBrandFrom(computeEffectiveBrand({ plan: "pro", optionActive: undefined, row: null }))).toBeNull();
  });
});
