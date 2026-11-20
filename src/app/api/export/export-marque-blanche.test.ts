import { beforeEach, describe, expect, it, vi } from "vitest";

// Exports ZIP et marque blanche : vraie route POST /api/export, vraie décision de droit, base simulée en mémoire.
// Les archives sont des ZIP « stored » (non compressés) : on lit leur contenu texte tel quel.
type Row = Record<string, unknown>;
const h = vi.hoisted(() => ({ db: {} as Record<string, Row[]>, failing: new Set<string>() }));

class Query {
  private filters: [string, unknown][] = [];
  constructor(private table: string) {}
  select() { return this; }
  eq(c: string, v: unknown) { this.filters.push([c, v]); return this; }
  maybeSingle() {
    if (h.failing.has(this.table)) return Promise.resolve({ data: null, error: { code: "08006" } });
    const r = (h.db[this.table] ?? []).filter((x) => this.filters.every(([c, v]) => x[c] === v));
    return Promise.resolve({ data: r[0] ? { ...r[0] } : null, error: null });
  }
}
const client = () => ({ from: (t: string) => new Query(t), rpc: async () => ({ data: false, error: null }) });

vi.mock("server-only", () => ({}));
vi.mock("@/lib/env", () => ({ isCloudConfigured: () => true, appUrl: () => "https://app.test" }));
vi.mock("@/lib/supabase/server", () => ({ getUser: async () => ({ supabase: client(), user: { id: "u-1" } }), createAdminClient: () => client() }));

import { POST } from "@/app/api/export/route";
import { resetRateLimit } from "@/lib/boutique/api";
import { generateNextProject } from "@/lib/codegen";
import { parseImport, projectFiles, projectJson } from "@/lib/export";
import { newProject } from "@/lib/project";
import { siteBrandFrom, applyBrandToProject } from "@/lib/brand/site-brand";
import { computeEffectiveBrand } from "@/lib/brand/effective";

const PNG = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==";
const ORIGIN = "https://app.test";
const MARQUE = /d[ée]collage/gi;
/** Extraits autour de chaque mention de Décollage (liste vide attendue en marque blanche). */
/** Lit une archive ZIP « stored » : liste des fichiers (nom, texte). */
function lireZip(buf: Uint8Array): { name: string; content: string }[] {
  const v = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  const dec = new TextDecoder();
  const out: { name: string; content: string }[] = [];
  let p = 0;
  while (p + 30 <= buf.length && v.getUint32(p, true) === 0x04034b50) {
    const size = v.getUint32(p + 18, true), nl = v.getUint16(p + 26, true), el = v.getUint16(p + 28, true);
    out.push({ name: dec.decode(buf.slice(p + 30, p + 30 + nl)), content: dec.decode(buf.slice(p + 30 + nl + el, p + 30 + nl + el + size)) });
    p += 30 + nl + el + size;
  }
  return out;
}
/** Texte public d'une archive : tout sauf le manifeste technique decollage.json, dont le nom n'est pas une mention commerciale. */
const textePublic = (files: { name: string; content: string }[]) => files.filter((x) => x.name !== "decollage.json").map((x) => x.content).join("\n").split("decollage.json").join("");
const mentions = (t: string) => [...t.matchAll(MARQUE)].map((m) => t.slice(Math.max(0, m.index! - 40), m.index! + 30));
const brandRow = (over: Row = {}) => ({
  user_id: "u-1", name: "Atelier Lumière", color_primary: "#12ab34", color_secondary: "#223344", color_accent: "#aa5500",
  color_surface: "#f6f1e7", color_text: "#0b1330", logo_data: null, favicon_data: null, version: 1, updated_at: "2026-11-15T10:00:00Z", ...over,
});
function setup(plan: string, ent: boolean | undefined, row: Row | null = brandRow()) {
  h.db = { profiles: [{ id: "u-1", plan }], brand_entitlements: ent === undefined ? [] : [{ user_id: "u-1", enabled: ent }], brand_configs: row ? [row] : [] };
}
const req = (kind: string) => new Request(`${ORIGIN}/api/export`, { method: "POST", headers: { "content-type": "application/json", origin: ORIGIN }, body: JSON.stringify({ kind, project: projet }) });
const projet = newProject("crm");
const cache = new WeakMap<Response, Uint8Array>();
const octets = async (r: Response) => { if (!cache.has(r)) cache.set(r, new Uint8Array(await r.arrayBuffer())); return cache.get(r)!; };
const texte = async (res: Response) => new TextDecoder().decode(await octets(res));

beforeEach(() => { h.failing.clear(); resetRateLimit(); setup("pro", undefined); });

describe("export AVEC droit (Pro, Illimité, Solo avec option)", () => {
  it.each([["pro", undefined], ["illimite", undefined], ["solo", true]])("%s : archive complète à la marque, aucune mention Décollage", async (plan, ent) => {
    setup(plan, ent, brandRow({ logo_data: PNG, favicon_data: PNG }));
    const res = await POST(req("archive"));
    expect(res.status).toBe(200);
    expect(res.headers.get("content-disposition")).toBe('attachment; filename="atelier-lumiere.zip"');
    const t = await texte(res);
    expect(t).toContain("# Atelier Lumière");
    expect(t).toContain("<title>Atelier Lumière</title>");
    expect(t).toContain("--brand-primary:#12ab34");
    expect(t).toContain(`<link rel="icon" type="image/png" href="${PNG}">`);
    expect(t).toContain("Atelier Lumière — prototype");
    // Le rendu public ne contient aucune mention, mais le manifeste technique decollage.json est bien présent.
    const files = lireZip(await octets(res));
    expect(files.map((x) => x.name)).toContain("decollage.json");
    expect(mentions(textePublic(files))).toEqual([]);
    expect(textePublic(files)).toContain("Atelier Lumière");
  });
  it("manifeste decollage.json en marque blanche : réimportable, paramètres conservés, aucun secret ni donnée de compte", async () => {
    setup("pro", undefined, brandRow({ logo_data: PNG, favicon_data: PNG }));
    const res = await POST(req("archive"));
    const man = lireZip(await octets(res)).find((x) => x.name === "decollage.json")!;
    const r = parseImport(man.content);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const p = r.projects[0]!;
    expect(p.config.nom).toBe("Atelier Lumière");
    expect(p.config.couleurs.primaire).toBe("#12ab34");
    expect(p.config.modules).toEqual(projet.config.modules);
    expect(p.config.templateId).toBe(projet.config.templateId);
    expect(p.config.revenu).toBe(projet.config.revenu);
    expect(p.landing.sections.length).toBe(projet.landing.sections.length);
    // Aucun secret ni donnée de compte : clés, jetons, identifiants Stripe/Supabase, e-mails du compte, identifiant utilisateur.
    expect(man.content.match(/sk_(live|test)_|pk_(live|test)_|whsec_|rk_(live|test)_|cus_[A-Za-z0-9]{6}|sub_[A-Za-z0-9]{6}|price_[A-Za-z0-9]{6}|eyJ[A-Za-z0-9_-]{10,}\.|service_role|api[_-]?key|secret|stripe/i)?.[0]).toBeUndefined();
    expect(man.content).not.toContain("u-1");
    expect(man.content).not.toContain("user_id");
    expect(man.content).not.toMatch(/[\w.+-]+@[\w-]+\.[\w.]+/);
  });
  it("landing seule : titre et favicon de la marque, sans Décollage", async () => {
    setup("pro", undefined, brandRow({ favicon_data: PNG }));
    const res = await POST(req("landing"));
    expect(res.headers.get("content-disposition")).toBe('attachment; filename="atelier-lumiere-landing.zip"');
    const t = await texte(res);
    expect(t).toContain("<title>Atelier Lumière</title>");
    expect(t).toContain('<meta property="og:site_name" content="Atelier Lumière">');
    expect(mentions(t)).toEqual([]);
  });
  it("projet Next.js : dossier, métadonnées, Open Graph, favicon, README et commentaires à la marque", async () => {
    setup("pro", undefined, brandRow({ favicon_data: PNG, logo_data: PNG }));
    const res = await POST(req("next"));
    expect(res.headers.get("content-disposition")).toBe('attachment; filename="atelier-lumiere-nextjs.zip"');
    const t = await texte(res);
    expect(t).toContain("atelier-lumiere/app/layout.tsx");
    expect(t).toContain('siteName: "Atelier Lumière"');
    expect(t).toContain(`icons: { icon: "${PNG}" }`);
    expect(t).toContain(`"logo": "${PNG}"`); // logo du client dans lib/config.ts
    expect(t).toContain("#12ab34"); // couleur de la marque dans la configuration et le CSS
    expect(t).toContain("# Atelier Lumière");
    expect(t).not.toContain("app/icon.svg"); // le favicon du client remplace l'icône générée
    expect(mentions(t)).toEqual([]);
  });
  it("sans favicon enregistré : icône aux initiales et à la couleur de la marque, jamais celle de Décollage", async () => {
    const files = generateNextProject(newProject("crm"), undefined, siteBrandFrom(computeEffectiveBrand({ plan: "pro", optionActive: false, row: brandRow() })));
    expect(files.find((f) => f.name === "app/layout.tsx")!.content).toMatch(/icons: \{ icon: "data:image\/svg\+xml,/);
    expect(files.find((f) => f.name === "app/layout.tsx")!.content).toContain("%2312ab34");
    expect(files.map((f) => f.content).join("\n")).not.toMatch(MARQUE);
  });
});

describe("export SANS droit : comportement habituel, mention conservée", () => {
  it.each([["solo", false], ["solo", undefined], ["gratuit", true]])("%s (option %s)", async (plan, ent) => {
    setup(plan, ent);
    const res = await POST(req("archive"));
    if (plan === "gratuit") { expect(res.status).toBe(403); return; } // Découverte : pas d'export du tout
    expect(res.status).toBe(200);
    const t = await texte(res);
    expect(t).toMatch(/Généré avec Décollage/);
    expect(t).toContain("decollage.json");
    expect(lireZip(await octets(res)).map((x) => x.name)).toContain("decollage.json");
    expect(t).not.toContain("Atelier Lumière");
    expect(res.headers.get("content-disposition")).toContain(`filename="`);
    expect(res.headers.get("content-disposition")).not.toContain("atelier-lumiere");
  });
  it("lecture du droit en échec : fail-closed (export habituel)", async () => {
    h.failing.add("brand_configs");
    const t = await texte(await POST(req("archive")));
    expect(t).toMatch(/Généré avec Décollage/);
    expect(t).not.toContain("Atelier Lumière");
  });
  it("droit accordé mais aucune marque enregistrée : export habituel", async () => {
    setup("pro", undefined, null);
    expect(await texte(await POST(req("archive")))).toMatch(/Généré avec Décollage/);
  });
  it("le droit ne vient jamais du corps de la requête", async () => {
    setup("solo", false);
    const r = new Request(`${ORIGIN}/api/export`, { method: "POST", headers: { "content-type": "application/json", origin: ORIGIN }, body: JSON.stringify({ kind: "archive", project: projet, marque: true }) });
    expect((await POST(r)).status).toBe(400);
  });
});

describe("fonctions pures", () => {
  it("sans marque : projet et fichiers inchangés (même objet)", () => {
    expect(applyBrandToProject(projet, null)).toBe(projet);
    expect(projectFiles(projet).map((f) => f.name)).toEqual(["index.html", "style.css", "prototype.html", "decollage.json", "README.md"]);
  });
  it("avec marque : l'ancien nom est remplacé partout (landing, tarifs, contenu, description), l'original reste intact", () => {
    const b = siteBrandFrom(computeEffectiveBrand({ plan: "pro", optionActive: false, row: brandRow() }))!;
    const nom = projet.config.nom;
    const p = applyBrandToProject(projet, b);
    expect(p.config.nom).toBe("Atelier Lumière");
    expect(JSON.stringify([p.landing, p.pricing, p.contenu, p.config.description])).not.toContain(nom);
    expect(projet.config.nom).toBe(nom);
    expect(projectFiles(projet, b).map((f) => f.name)).toEqual(["index.html", "style.css", "prototype.html", "decollage.json", "README.md"]);
  });
  it("décollage.json en marque blanche : export puis réimport, et un ancien export sans marque se réimporte toujours", () => {
    const b = siteBrandFrom(computeEffectiveBrand({ plan: "pro", optionActive: false, row: brandRow() }))!;
    const avec = projectFiles(projet, b).find((f) => f.name === "decollage.json")!.content;
    const sans = projectFiles(projet).find((f) => f.name === "decollage.json")!.content;
    const a = parseImport(avec), o = parseImport(sans);
    expect(a.ok && a.projects[0]!.config.nom).toBe("Atelier Lumière");
    expect(o.ok && o.projects[0]!.config.nom).toBe(projet.config.nom);
    expect(JSON.parse(avec).format).toBe(JSON.parse(sans).format); // même format : aucune rupture de compatibilité
    expect(JSON.parse(avec).version).toBe(JSON.parse(sans).version);
    expect(Object.keys(JSON.parse(avec)).sort()).toEqual(Object.keys(JSON.parse(projectJson(projet))).sort());
  });
});
