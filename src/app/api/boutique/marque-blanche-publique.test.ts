import { beforeEach, describe, expect, it, vi } from "vitest";

// Marque blanche des boutiques publiées : la mention « Créé avec Décollage » suit la même règle que /api/brand.
// Base simulée en mémoire (même interface que supabase-js pour les appels utilisés) ; la vraie route et la vraie fonction de décision tournent.

type Row = Record<string, unknown>;
const h = vi.hoisted(() => ({
  db: {} as Record<string, Row[]>,
  failing: new Set<string>(),
  adminOk: true,
}));

class Query {
  private filters: [string, unknown][] = [];
  private cols: string[] | null = null;
  constructor(private table: string, private admin: boolean) {}
  select(c: string) { this.cols = c === "*" ? null : c.split(",").map((s) => s.trim()); return this; }
  eq(c: string, v: unknown) { this.filters.push([c, v]); return this; }
  order() { return this; }
  private run(): { data: Row[] | null; error: { code: string } | null } {
    if (h.failing.has(this.table + (this.admin ? ":admin" : ""))) return { data: null, error: { code: "08006" } };
    const rows = (h.db[this.table] ?? []).filter((r) => this.filters.every(([c, v]) => r[c] === v));
    return { data: rows.map((r) => (this.cols ? Object.fromEntries(this.cols.filter((c) => c in r).map((c) => [c, r[c]])) : { ...r })), error: null };
  }
  maybeSingle() { const r = this.run(); return Promise.resolve({ data: r.data ? (r.data[0] ?? null) : null, error: r.error }); }
  then<T>(res: (v: { data: Row[] | null; error: { code: string } | null }) => T) { return Promise.resolve(this.run()).then(res); }
}

vi.mock("server-only", () => ({}));
vi.mock("@/lib/env", () => ({ isCloudConfigured: () => true, appUrl: () => "https://app.test" }));
vi.mock("@/lib/supabase/server", () => ({
  createAdminClient: () => { if (!h.adminOk) throw new Error("no key"); return { from: (t: string) => new Query(t, true) }; },
  createPublicClient: () => ({ from: (t: string) => new Query(t, false) }),
  getUser: async () => ({ supabase: { from: (t: string) => new Query(t, false) }, user: { id: "u-solo" } }),
}));

import { GET as catalogue } from "./catalogue/[slug]/route";
import { decideWhiteLabel } from "@/lib/brand/decision";
import { marqueBlancheBoutique } from "@/lib/brand/public";
import { authorize } from "@/lib/brand/api";

const ctx = (slug: string) => ({ params: Promise.resolve({ slug }) });
const get = (slug: string, url = `https://app.test/api/boutique/catalogue/${slug}`, headers: Record<string, string> = {}) =>
  catalogue(new Request(url, { headers }), ctx(slug));

const boutique = (slug: string, owner: string) => ({ id: `id-${slug}`, slug, nom: `Boutique ${slug}`, statut: "publiee", proprietaire_id: owner });
function setup(plan: string | null, ent?: boolean) {
  h.db = {
    boutiques: [boutique("chez-awa", "u-1")],
    categories: [], produits: [], variantes_publiques: [],
    profiles: plan === null ? [] : [{ id: "u-1", plan }],
    brand_entitlements: ent === undefined ? [] : [{ user_id: "u-1", enabled: ent }],
  };
}
const marque = async (url?: string, headers?: Record<string, string>) => (await (await get("chez-awa", url, headers)).json()).marque_blanche;

beforeEach(() => { h.failing.clear(); h.adminOk = true; setup("gratuit"); });

describe("règle : la mention est masquée seulement si marque_blanche === true", () => {
  it("Découverte (gratuit) : mention affichée, même avec un ancien droit", async () => {
    expect(await marque()).toBe(false);
    setup("gratuit", true);
    expect(await marque()).toBe(false);
  });
  it("Solo sans option, ou option désactivée : affichée", async () => {
    setup("solo");
    expect(await marque()).toBe(false);
    setup("solo", false);
    expect(await marque()).toBe(false);
  });
  it("Solo avec option activée : masquée", async () => {
    setup("solo", true);
    expect(await marque()).toBe(true);
  });
  it("Pro et Illimité : masquée sans ligne brand_entitlements", async () => {
    setup("pro");
    expect(await marque()).toBe(true);
    setup("illimite");
    expect(await marque()).toBe(true);
  });
  it("compte rétrogradé en Découverte avec ancien droit actif : affichée", async () => {
    setup("solo", true);
    expect(await marque()).toBe(true);
    h.db.profiles![0]!.plan = "gratuit"; // le webhook a abaissé la formule
    expect(await marque()).toBe(false);
  });
  it("formule inconnue ou profil absent : affichée", async () => {
    setup("n-importe-quoi", true);
    expect(await marque()).toBe(false);
    setup(null, true);
    expect(await marque()).toBe(false);
  });
});

describe("fail-closed : une erreur ne masque jamais la mention", () => {
  it.each(["profiles:admin", "brand_entitlements:admin", "boutiques:admin"])("erreur de lecture %s", async (t) => {
    setup("pro");
    h.failing.add(t);
    const r = await get("chez-awa");
    expect(r.status).toBe(200); // la boutique reste servie
    expect((await r.json()).marque_blanche).toBe(false);
  });
  it("clé service_role absente : affichée, boutique servie", async () => {
    setup("pro");
    h.adminOk = false;
    const r = await get("chez-awa");
    expect(r.status).toBe(200);
    expect((await r.json()).marque_blanche).toBe(false);
  });
  it("slug invalide ou boutique brouillon : false", async () => {
    expect(await marqueBlancheBoutique("../x")).toBe(false);
    setup("pro");
    h.db.boutiques![0]!.statut = "brouillon";
    expect(await marqueBlancheBoutique("chez-awa")).toBe(false);
  });
});

describe("isolation et confidentialité", () => {
  it("la boutique d'un autre propriétaire ne reçoit pas le droit du premier", async () => {
    h.db = {
      boutiques: [boutique("chez-awa", "u-1"), boutique("chez-bob", "u-2")],
      categories: [], produits: [], variantes_publiques: [],
      profiles: [{ id: "u-1", plan: "solo" }, { id: "u-2", plan: "solo" }],
      brand_entitlements: [{ user_id: "u-1", enabled: true }],
    };
    expect((await (await get("chez-awa")).json()).marque_blanche).toBe(true);
    expect((await (await get("chez-bob")).json()).marque_blanche).toBe(false);
  });
  it("le booléen est le seul ajout : ni proprietaire_id ni formule dans la réponse publique", async () => {
    setup("pro", true);
    const raw = await (await get("chez-awa")).text();
    const body = JSON.parse(raw);
    expect(Object.keys(body).sort()).toEqual(["boutique", "categories", "marque_blanche", "produits"]);
    expect(typeof body.marque_blanche).toBe("boolean");
    expect(raw).not.toMatch(/proprietaire|u-1|"plan"|entitle|enabled/);
  });
  it("paramètre d'URL ou en-têtes : aucun effet sur la décision", async () => {
    setup("gratuit");
    const url = "https://app.test/api/boutique/catalogue/chez-awa?marque_blanche=1&plan=pro&white_label=true&hide=1";
    const headers = { "x-plan": "pro", "x-marque-blanche": "true", "x-user-id": "u-1", authorization: "Bearer x", cookie: "plan=pro" };
    expect(await marque(url, headers)).toBe(false);
    setup("pro");
    expect(await marque(url, { "x-marque-blanche": "false" })).toBe(true);
  });
});

describe("une seule source de vérité avec /api/brand", () => {
  const cas: [string | null, boolean | undefined][] = [
    ["gratuit", undefined], ["gratuit", true], ["solo", undefined], ["solo", false], ["solo", true], ["pro", undefined], ["illimite", undefined], ["premium", undefined], ["bidon", true], [null, true],
  ];
  it.each(cas)("plan=%s option=%s : /api/brand et la boutique publique donnent la même réponse", async (plan, ent) => {
    h.db = {
      boutiques: [boutique("chez-awa", "u-solo")],
      categories: [], produits: [], variantes_publiques: [],
      profiles: plan === null ? [] : [{ id: "u-solo", plan }],
      brand_entitlements: ent === undefined ? [] : [{ user_id: "u-solo", enabled: ent }],
    };
    const publique = (await (await get("chez-awa")).json()).marque_blanche === true;
    const res = await authorize(new Request("https://app.test/api/brand"), false);
    expect(!(res instanceof Response)).toBe(publique);
    expect(publique).toBe(decideWhiteLabel(plan, ent));
  });
});
