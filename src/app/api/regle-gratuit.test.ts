import { beforeEach, describe, expect, it, vi } from "vitest";

// Règle Gratuit / publication, côté routes serveur, avec Supabase et Stripe simulés (jamais de vraie base ni de vrai paiement).
// Le comportement SQL réel (déclencheurs, RLS) est testé dans src/lib/regle-gratuit.test.ts avec PGlite.
const h = vi.hoisted(() => ({
  user: { id: "u-a", email: "a@exemple.fr" } as { id: string; email: string } | null,
  rows: {} as Record<string, unknown[]>,
  errors: {} as Record<string, { code?: string; message?: string; hint?: string } | null>,
  log: [] as [string, string, unknown][],
  stripe: { retrieve: vi.fn(), constructEvent: vi.fn() },
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/env", () => ({
  isCloudConfigured: () => true,
  isPaymentConfigured: () => true,
  stripePrices: () => ({ solo: "price_solo", pro: "price_pro", illimite: "price_ill" }),
  stripeBrandPrice: () => "price_brand",
  stripeWebhookSecret: () => "whsec_test",
  appUrl: () => "https://app.test",
}));
vi.mock("@/lib/stripe", () => ({ getStripe: () => ({ subscriptions: { retrieve: h.stripe.retrieve }, webhooks: { constructEvent: h.stripe.constructEvent } }) }));

function fakeTable(name: string) {
  const q: Record<string, unknown> = {};
  const self = () => q;
  let w = false; // après update/insert : l'erreur simulée est celle de l'ÉCRITURE (clé « table:write »)
  const err = () => h.errors[w ? name + ":write" : name] ?? null;
  const res = () => ({ data: h.rows[name] ?? [], error: err() });
  for (const m of ["select", "eq", "in", "is", "order", "limit"]) q[m] = self;
  q.update = (v: unknown) => { w = true; h.log.push([name, "update", v]); return q; };
  q.insert = (v: unknown) => { w = true; h.log.push([name, "insert", v]); return q; };
  q.delete = () => { h.log.push([name, "delete", null]); return q; };
  q.maybeSingle = () => Promise.resolve({ data: (h.rows[name] ?? [])[0] ?? null, error: err() });
  q.single = q.maybeSingle;
  q.then = (ok: (v: unknown) => unknown) => ok(res());
  return q;
}
const client = () => ({ from: (t: string) => fakeTable(t) });
vi.mock("@/lib/supabase/server", () => ({
  getUser: async () => ({ supabase: client(), user: h.user }),
  createAdminClient: () => client(),
  createPublicClient: () => client(),
}));

import { POST as publier } from "@/app/api/sites/route";
import { PATCH as patchBoutique } from "@/app/api/boutique/[id]/route";
import { GET as catalogue } from "@/app/api/boutique/catalogue/[slug]/route";
import { POST as webhook } from "@/app/api/stripe/webhook/route";
import { newProject } from "@/lib/project";
import { siteData } from "@/lib/publish";

const post = (url: string, body: unknown, headers: Record<string, string> = {}) =>
  new Request(`https://app.test${url}`, { method: "POST", headers: { "content-type": "application/json", origin: "https://app.test", ...headers }, body: typeof body === "string" ? body : JSON.stringify(body) });
const publishBody = (projectId = "proja1", slug = "mon-site") => ({ projectId, slug, data: siteData(newProject("crm")) });
const writes = (table: string, op?: string) => h.log.filter(([t, o]) => t === table && (op ? o === op : o === "insert" || o === "update"));
const ID = "11111111-1111-4111-8111-111111111111";
const sitesN = (n: number) => Array.from({ length: n }, (_, i) => ({ slug: `site-${i}`, project_id: `proj${i}x` }));

beforeEach(() => {
  h.user = { id: "u-a", email: "a@exemple.fr" };
  h.rows = {};
  h.errors = {};
  h.log = [];
  h.stripe.retrieve.mockReset();
  h.stripe.constructEvent.mockReset();
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("publication d'un site : la formule est vérifiée côté serveur", () => {
  it("(2) Gratuit : refus 403 explicite par appel direct, sans aucune écriture (nouveau site)", async () => {
    h.rows = { profiles: [{ plan: "gratuit" }], sites: [], boutiques: [] };
    const r = await publier(post("/api/sites", publishBody()));
    expect(r.status).toBe(403);
    const body = await r.json();
    expect(body.code).toBe("publication_formule");
    expect(body.error).toMatch(/offres payantes/);
    expect(body.error).toMatch(/prévisualiser/);
    expect(writes("sites")).toHaveLength(0);
  });

  it("(2) formule envoyée par le navigateur : ignorée, seule la base compte (plan/user_id/maxSites dans le corps)", async () => {
    h.rows = { profiles: [{ plan: "gratuit" }], sites: [] };
    const r = await publier(post("/api/sites", { ...publishBody(), plan: "illimite", user_id: "autre", maxSites: 99 }));
    expect(r.status).toBe(403);
    expect(writes("sites")).toHaveLength(0);
  });

  it("(2) ancienne URL d'un utilisateur rétrogradé en Gratuit : mise à jour refusée aussi", async () => {
    h.rows = { profiles: [{ plan: "gratuit" }], sites: [{ slug: "ancien", project_id: "proja1" }] };
    const r = await publier(post("/api/sites", publishBody("proja1", "ancien")));
    expect(r.status).toBe(403);
    expect(writes("sites")).toHaveLength(0);
  });

  it("sans connexion : 401", async () => {
    h.user = null;
    expect((await publier(post("/api/sites", publishBody()))).status).toBe(401);
    expect(writes("sites")).toHaveLength(0);
  });

  it("(3) Solo peut publier son premier site", async () => {
    h.rows = { profiles: [{ plan: "solo" }], sites: [], boutiques: [] };
    const r = await publier(post("/api/sites", publishBody()));
    expect(r.status).toBe(200);
    expect(writes("sites", "insert")).toHaveLength(1);
  });

  it("(5) Solo : un deuxième site est refusé ; mettre à jour le sien reste permis", async () => {
    h.rows = { profiles: [{ plan: "solo" }], sites: [{ slug: "mon-site", project_id: "proja1" }], boutiques: [] };
    const r2 = await publier(post("/api/sites", publishBody("projb2x", "autre-site")));
    expect(r2.status).toBe(403);
    expect((await r2.json()).code).toBe("limite_sites");
    expect(writes("sites")).toHaveLength(0);
    const maj = await publier(post("/api/sites", publishBody("proja1", "mon-site")));
    expect(maj.status).toBe(200);
    expect(writes("sites", "update")).toHaveLength(1);
  });

  it("(5) une boutique publiée compte dans la même limite : Solo avec une boutique publiée ne publie pas de site", async () => {
    h.rows = { profiles: [{ plan: "solo" }], sites: [], boutiques: [{ id: ID }] };
    const r = await publier(post("/api/sites", publishBody()));
    expect(r.status).toBe(403);
    expect((await r.json()).code).toBe("limite_sites");
    expect(writes("sites")).toHaveLength(0);
  });

  it("(4) Pro : le 5e site passe, le 6e est refusé", async () => {
    h.rows = { profiles: [{ plan: "pro" }], sites: sitesN(4), boutiques: [] };
    expect((await publier(post("/api/sites", publishBody("proj9x", "cinquieme")))).status).toBe(200);
    h.log = [];
    h.rows = { profiles: [{ plan: "pro" }], sites: sitesN(5), boutiques: [] };
    expect((await publier(post("/api/sites", publishBody("proj9x", "sixieme")))).status).toBe(403);
    expect(writes("sites")).toHaveLength(0);
  });

  it("la garde de la base (migration 0006) qui refuse malgré tout devient un 403 clair, pas un 500 ni un message brut", async () => {
    h.rows = { profiles: [{ plan: "pro" }], sites: [], boutiques: [] };
    expect((await publier(post("/api/sites", publishBody()))).status).toBe(200); // témoin : sans erreur de base, ça passe
    h.errors["sites:write"] = { code: "P0001", message: "Limite de sites publiés atteinte pour ta formule", hint: "limite_sites" };
    const r2 = await publier(post("/api/sites", publishBody("projz9", "autre-adresse")));
    expect(r2.status).toBe(403);
    expect(JSON.stringify(await r2.json())).not.toContain("atteinte pour ta formule");
  });
});

describe("boutique : publication et vitrine publique", () => {
  const req = (method: string, body?: unknown) =>
    new Request("https://app.test/api/boutique/x", { method, headers: { "content-type": "application/json", origin: "https://app.test" }, body: body === undefined ? undefined : JSON.stringify(body) });
  const ctx = { params: Promise.resolve({ id: ID }) };

  it("(2) Gratuit : « Publier la boutique » refusé par la base devient un 403 publication_formule avec explication", async () => {
    h.rows = { boutiques: [{ id: ID }] };
    h.errors["boutiques:write"] = { code: "P0001", message: "interne", hint: "publication_formule" };
    const r = await patchBoutique(req("PATCH", { statut: "publiee" }), ctx);
    expect(r.status).toBe(403);
    const b = await r.json();
    expect(b.code).toBe("publication_formule");
    expect(b.error).toMatch(/Gratuit/);
    expect(b.error).toMatch(/Solo/);
    expect(JSON.stringify(b)).not.toContain("interne");
  });

  it("(2) Gratuit : traduction de l'erreur de publication de la base en 403 explicite", async () => {
    const { dbError } = await import("@/lib/boutique/api");
    const r = dbError({ code: "P0001", message: "interne", hint: "publication_formule" });
    expect(r.status).toBe(403);
    const b = await r.json();
    expect(b.code).toBe("publication_formule");
    expect(b.error).toMatch(/Gratuit/);
    expect(b.error).toMatch(/Solo/);
    expect(JSON.stringify(b)).not.toContain("interne");
  });

  it("(1) Gratuit : enregistrer / modifier son brouillon reste possible (aucun refus tant que la base accepte)", async () => {
    h.rows = { boutiques: [{ id: ID, statut: "brouillon" }] };
    const r = await patchBoutique(req("PATCH", { nom: "Ma boutique" }), ctx);
    expect(r.status).toBe(200);
    expect(writes("boutiques", "update")).toHaveLength(1);
  });

  it("route publique du catalogue : 404 si la base ne rend rien (brouillon, suspendue, propriétaire Gratuit : la RLS masque la ligne)", async () => {
    h.rows = { boutiques: [] };
    const r = await catalogue(new Request("https://app.test/api/boutique/catalogue/ma-boutique"), { params: Promise.resolve({ slug: "ma-boutique" }) });
    expect(r.status).toBe(404);
  });
});

describe("webhook Stripe : formule inconnue, plusieurs éléments, option marque blanche", () => {
  const event = { id: "evt_1", type: "customer.subscription.updated", data: { object: { id: "sub_1" } } };
  const sub = (items: string[], status = "active") => ({ id: "sub_1", customer: "cus_1", status, items: { data: items.map((id) => ({ price: { id } })) }, metadata: {} });
  const call = () => webhook(post("/api/stripe/webhook", "{}", { "stripe-signature": "t=1,v1=x" }));
  const run = (items: string[], status = "active", profile: Record<string, unknown> = { id: "u-a", plan: "gratuit", stripe_subscription_id: null }) => {
    h.rows = { profiles: [profile], sites: [], boutiques: [], brand_entitlements: [] };
    h.stripe.constructEvent.mockReturnValue(event);
    h.stripe.retrieve.mockResolvedValue(sub(items, status));
    return call();
  };
  const planWritten = () => (writes("profiles", "update")[0]?.[2] as { plan?: string } | undefined)?.plan;

  it("(7) un prix inconnu seul n'accorde JAMAIS Illimité ni aucune formule : Gratuit pour un nouvel abonnement", async () => {
    expect((await run(["price_inconnu"])).status).toBe(200);
    expect(planWritten()).toBe("gratuit");
  });

  it("(7) prix inconnu sur le même abonnement déjà connu : la formule précédente est conservée (pas de montée en gamme)", async () => {
    await run(["price_inconnu"], "active", { id: "u-a", plan: "solo", stripe_subscription_id: "sub_1" });
    expect(planWritten()).toBe("solo");
  });

  it("(7) prix inconnu sur un NOUVEL abonnement alors que le profil avait Pro (autre abonnement) : Gratuit, jamais Pro ni Illimité", async () => {
    await run(["price_inconnu"], "active", { id: "u-a", plan: "pro", stripe_subscription_id: "sub_ancien" });
    expect(planWritten()).toBe("gratuit");
  });

  it("(7) un supplément inconnu à côté de Solo reste Solo (TOUS les éléments sont analysés, pas seulement le premier)", async () => {
    await run(["price_supplement_inconnu", "price_solo"]);
    expect(planWritten()).toBe("solo");
  });

  it("(7) deux formules sur le même abonnement : la moins chère est retenue", async () => {
    await run(["price_ill", "price_solo"]);
    expect(planWritten()).toBe("solo");
  });

  it("(8) l'option marque blanche en premier élément ne change pas la formule : Solo + option = Solo, droit enregistré à part", async () => {
    await run(["price_brand", "price_solo"]);
    expect(planWritten()).toBe("solo");
    const ent = writes("brand_entitlements", "insert");
    expect(ent).toHaveLength(1);
    expect(ent[0]![2]).toMatchObject({ user_id: "u-a", enabled: true, source: "stripe" });
    expect(JSON.stringify(writes("profiles", "update"))).not.toContain("illimite");
  });

  it("(8) l'option marque blanche SEULE n'accorde aucune formule", async () => {
    await run(["price_brand"]);
    expect(planWritten()).toBe("gratuit");
  });

  it("(8) option retirée : le droit posé par Stripe est retiré, jamais un droit accordé à la main", async () => {
    h.rows = { profiles: [{ id: "u-a", plan: "solo", stripe_subscription_id: "sub_1" }], sites: [], boutiques: [], brand_entitlements: [{ enabled: true, source: "stripe" }] };
    h.stripe.constructEvent.mockReturnValue(event);
    h.stripe.retrieve.mockResolvedValue(sub(["price_solo"]));
    await call();
    expect(writes("brand_entitlements", "update")[0]![2]).toEqual({ enabled: false });
    h.log = [];
    h.rows.brand_entitlements = [{ enabled: true, source: "manuel" }];
    await call();
    expect(writes("brand_entitlements")).toHaveLength(0);
  });

  it("formules reconnues : Pro, Illimité", async () => {
    await run(["price_pro"]);
    expect(planWritten()).toBe("pro");
    h.log = [];
    await run(["price_ill"]);
    expect(planWritten()).toBe("illimite");
  });

  it("résiliation : Gratuit, aucune suppression de site ni de boutique (seulement une suspension)", async () => {
    h.rows = { profiles: [{ id: "u-a", plan: "pro", stripe_subscription_id: "sub_1" }], sites: [{ slug: "a", published_at: "2026-01-01T00:00:00Z" }], boutiques: [{ id: ID, published_at: "2026-02-01T00:00:00Z" }], brand_entitlements: [] };
    h.stripe.constructEvent.mockReturnValue(event);
    h.stripe.retrieve.mockResolvedValue(sub(["price_pro"], "canceled"));
    expect((await call()).status).toBe(200);
    expect(planWritten()).toBe("gratuit");
    expect(h.log.filter(([, op]) => op === "delete")).toHaveLength(0);
    const susp = h.log.filter(([t, op, v]) => op === "update" && (t === "sites" || t === "boutiques") && (v as { suspended_at?: unknown }).suspended_at);
    expect(susp.map(([t]) => t).sort()).toEqual(["boutiques", "sites"]);
  });
});
