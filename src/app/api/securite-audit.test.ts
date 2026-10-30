import { beforeEach, describe, expect, it, vi } from "vitest";

// Correctifs de l'audit d'octobre 2026 : contrôle d'origine (CSRF), webhook Stripe rejouable, double facturation,
// sites suspendus et limite. Supabase et Stripe sont SIMULÉS (aucune vraie base, aucun vrai paiement).
type DbErr = { code?: string; message?: string } | null;
const h = vi.hoisted(() => ({
  user: { id: "u-a", email: "a@exemple.fr" } as { id: string; email: string } | null,
  rows: {} as Record<string, unknown[]>,
  errors: {} as Record<string, { code?: string; message?: string } | null>,
  log: [] as [string, string, unknown][],
  stripe: { retrieve: vi.fn(), constructEvent: vi.fn(), list: vi.fn(), sessionsCreate: vi.fn(), cancel: vi.fn(), portal: vi.fn(), customersCreate: vi.fn() },
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
vi.mock("@/lib/stripe", () => ({
  getStripe: () => ({
    subscriptions: { retrieve: h.stripe.retrieve, list: h.stripe.list, cancel: h.stripe.cancel },
    webhooks: { constructEvent: h.stripe.constructEvent },
    checkout: { sessions: { create: h.stripe.sessionsCreate } },
    billingPortal: { sessions: { create: h.stripe.portal } },
    customers: { create: h.stripe.customersCreate },
  }),
}));

function fakeTable(name: string) {
  const q: Record<string, unknown> = {};
  const self = () => q;
  let w = false;
  const err = (): DbErr => h.errors[w ? name + ":write" : name] ?? null;
  for (const m of ["select", "eq", "in", "order", "limit"]) q[m] = self;
  q.is = (...a: unknown[]) => { h.log.push([name, "is", a]); return q; };
  q.update = (v: unknown) => { w = true; h.log.push([name, "update", v]); return q; };
  q.insert = (v: unknown) => { w = true; h.log.push([name, "insert", v]); return q; };
  q.upsert = (v: unknown) => { w = true; h.log.push([name, "upsert", v]); return q; };
  q.delete = () => { w = true; h.log.push([name, "delete", null]); return q; };
  q.maybeSingle = () => Promise.resolve({ data: (h.rows[name] ?? [])[0] ?? null, error: err() });
  q.single = q.maybeSingle;
  q.then = (ok: (v: unknown) => unknown) => ok({ data: h.rows[name] ?? [], error: err() });
  return q;
}
const client = () => ({ from: (t: string) => fakeTable(t), auth: { admin: { deleteUser: async () => ({ error: null }) } } });
vi.mock("@/lib/supabase/server", () => ({ getUser: async () => ({ supabase: client(), user: h.user }), createAdminClient: () => client(), createPublicClient: () => client() }));

import { VERSIONS } from "@/data/legal";
import { DELETE as deleteAccount } from "@/app/api/account/route";
import { POST as accept, GET as acceptGet } from "@/app/api/legal/accept/route";
import { POST as checkout } from "@/app/api/stripe/checkout/route";
import { POST as portal } from "@/app/api/stripe/portal/route";
import { POST as webhook } from "@/app/api/stripe/webhook/route";
import { POST as publish, DELETE as unpublish, GET as siteStatus } from "@/app/api/sites/route";
import { originGuard, originOk } from "@/lib/origin";
import { subscriptionBlocksCheckout } from "@/lib/billing";
import { isMissingSchema } from "@/lib/site-lifecycle";
import { newProject } from "@/lib/project";
import { siteData } from "@/lib/publish";

const APP = "https://app.test";
const req = (method: string, path: string, headers: Record<string, string> = {}, body?: unknown) =>
  new Request(`${APP}${path}`, { method, headers: { "content-type": "application/json", ...headers }, body: body === undefined ? undefined : JSON.stringify(body) });
const CONSENT = { acceptCgv: true, renonciation: true, cgvVersion: VERSIONS.cgv };
const siteBody = { projectId: "proja1", slug: "mon-site", data: siteData(newProject("crm")) };
const writes = (table: string) => h.log.filter(([t, o]) => t === table && ["insert", "update", "upsert", "delete"].includes(o));

beforeEach(() => {
  h.user = { id: "u-a", email: "a@exemple.fr" };
  h.rows = { profiles: [{ id: "u-a", plan: "gratuit", stripe_customer_id: "cus_1", stripe_subscription_id: null, subscription_status: null }], sites: [], boutiques: [], brand_entitlements: [] };
  h.errors = {};
  h.log = [];
  Object.values(h.stripe).forEach((f) => f.mockReset());
  h.stripe.list.mockResolvedValue({ data: [], has_more: false });
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
});

// ─── A. Contrôle d'origine ───────────────────────────────────────────────────────────────────────
describe("A. contrôle d'origine : chaque route d'écriture", () => {
  const routes: [string, (headers: Record<string, string>) => Promise<Response>][] = [
    ["DELETE /api/account", (hd) => deleteAccount(req("DELETE", "/api/account", hd))],
    ["POST /api/sites", (hd) => publish(req("POST", "/api/sites", hd, siteBody))],
    ["DELETE /api/sites", (hd) => unpublish(req("DELETE", "/api/sites?projectId=proja1", hd))],
    ["POST /api/stripe/checkout", (hd) => checkout(req("POST", "/api/stripe/checkout", hd, { plan: "solo", ...CONSENT }))],
    ["POST /api/stripe/portal", (hd) => portal(req("POST", "/api/stripe/portal", hd))],
    ["POST /api/legal/accept", (hd) => accept(req("POST", "/api/legal/accept", hd, { documents: [{ document: "cgu", version: VERSIONS.cgu }] }))],
  ];
  for (const [name, call] of routes) {
    it(`${name} : origine absente, étrangère, « null » ou Referer étranger => 403 sans aucun effet`, async () => {
      for (const hd of [{} as Record<string, string>, { origin: "https://pirate.test" }, { origin: "null" }, { origin: "https://app.test.pirate.test" }, { referer: "https://pirate.test/page" }, { origin: "https://pirate.test", referer: "https://app.test/x" }]) {
        const r = await call(hd);
        expect(r.status, JSON.stringify(hd)).toBe(403);
        expect((await r.json()).code).toBe("origin");
      }
      expect(h.log).toHaveLength(0);
      expect(h.stripe.sessionsCreate).not.toHaveBeenCalled();
      expect(h.stripe.cancel).not.toHaveBeenCalled();
      expect(h.stripe.portal).not.toHaveBeenCalled();
    });
    it(`${name} : l'origine de l'application est acceptée (jamais bloquée par le contrôle)`, async () => {
      h.rows.profiles = [{ id: "u-a", plan: "solo", stripe_customer_id: "cus_1", stripe_subscription_id: "sub_1", subscription_status: "active" }];
      h.stripe.portal.mockResolvedValue({ url: "https://portal.test" });
      h.stripe.cancel.mockResolvedValue({});
      for (const hd of [{ origin: APP } as Record<string, string>, { referer: `${APP}/parametres` }]) expect((await call(hd)).status, JSON.stringify(hd)).not.toBe(403);
    });
  }

  it("le portail Stripe s'ouvre avec une origine valide (adresse Stripe renvoyée pour la redirection)", async () => {
    h.rows.profiles = [{ id: "u-a", plan: "solo", stripe_customer_id: "cus_1" }];
    h.stripe.portal.mockResolvedValue({ url: "https://portal.test/x" });
    const r = await portal(req("POST", "/api/stripe/portal", { origin: APP }));
    expect(r.status).toBe(200);
    expect(await r.json()).toEqual({ url: "https://portal.test/x" });
  });

  it("les lectures (GET) ne sont pas soumises au contrôle", async () => {
    expect(originGuard(req("GET", "/api/sites"))).toBeNull();
    expect((await siteStatus(req("GET", "/api/sites?projectId=proja1"))).status).toBe(200);
    expect((await acceptGet()).status).toBe(200);
  });

  it("webhook Stripe : exclu du contrôle d'origine (la signature suffit)", async () => {
    h.stripe.constructEvent.mockReturnValue({ id: "evt", type: "invoice.paid", data: { object: {} } });
    const r = await webhook(req("POST", "/api/stripe/webhook", { "stripe-signature": "t=1,v1=x" }, {}));
    expect(r.status).toBe(200);
  });

  it("originOk : adresse configurée acceptée même si l'hôte de la requête diffère ; schéma ou port différents refusés", () => {
    const r = (origin: string) => new Request("https://interne.test/api/x", { method: "POST", headers: { origin } });
    expect(originOk(r("https://app.test"))).toBe(true);
    expect(originOk(r("https://interne.test"))).toBe(true);
    expect(originOk(r("http://app.test"))).toBe(false);
    expect(originOk(r("https://app.test:8443"))).toBe(false);
    expect(originOk(new Request("https://app.test/x", { method: "POST" }))).toBe(false);
  });
});

// ─── B. Webhook Stripe ───────────────────────────────────────────────────────────────────────────
describe("B. webhook Stripe : jamais 200 si la mise à jour échoue, rejeu idempotent", () => {
  const event = { id: "evt_1", type: "customer.subscription.updated", data: { object: { id: "sub_1" } } };
  const sub = (status: string, items = ["price_solo"]) => ({ id: "sub_1", customer: "cus_1", status, items: { data: items.map((id) => ({ price: { id } })) }, metadata: {} });
  const call = () => webhook(req("POST", "/api/stripe/webhook", { "stripe-signature": "t=1,v1=x" }, {}));
  const setup = (status: string, plan = "solo") => {
    h.rows.profiles = [{ id: "u-a", plan, stripe_customer_id: "cus_1", stripe_subscription_id: "sub_1" }];
    h.rows.sites = [{ slug: "s1", published_at: "2026-01-01" }, { slug: "s2", published_at: "2026-02-01" }];
    h.stripe.constructEvent.mockReturnValue(event);
    h.stripe.retrieve.mockResolvedValue(sub(status));
  };
  const plan = () => (writes("profiles")[0]?.[2] as { plan?: string } | undefined)?.plan;
  const suspended = () => writes("sites").filter(([, , v]) => typeof (v as { suspended_at: unknown }).suspended_at === "string");
  const normalized = () => JSON.stringify(h.log.filter(([, o]) => o !== "is").map(([t, o, v]) => {
    const x = { ...(v as Record<string, unknown>) };
    if ("updated_at" in x) x.updated_at = "T";
    if (typeof x.suspended_at === "string") x.suspended_at = "T";
    return [t, o, x];
  }));

  it("l'écriture de la suspension échoue => 500 (Stripe rejouera), puis le rejeu complète la suspension manquante", async () => {
    setup("canceled", "pro");
    h.errors["sites:write"] = { code: "08006", message: "connexion perdue" };
    const r1 = await call();
    expect(r1.status).toBe(500);
    expect(plan()).toBe("gratuit"); // formule écrite, mais l'événement n'est pas acquitté
    h.errors = {};
    h.log = [];
    const r2 = await call(); // rejeu
    expect(r2.status).toBe(200);
    expect(plan()).toBe("gratuit");
    expect(suspended()).toHaveLength(1);
    expect(h.stripe.retrieve).toHaveBeenCalledTimes(2); // Stripe relu à chaque fois : source de vérité
  });

  it("la lecture des sites échoue => 500", async () => {
    setup("canceled", "pro");
    h.errors["sites"] = { code: "08006", message: "panne" };
    expect((await call()).status).toBe(500);
  });

  it("lecture des boutiques en panne passagère => 500 ; table absente (migration non exécutée) => 200", async () => {
    setup("canceled", "pro");
    h.errors["boutiques"] = { code: "08006", message: "panne" };
    expect((await call()).status).toBe(500);
    h.errors["boutiques"] = { code: "42P01", message: 'relation "boutiques" does not exist' };
    expect((await call()).status).toBe(200);
  });

  it("l'écriture du plan échoue => 500 et aucune suspension tentée", async () => {
    setup("canceled", "pro");
    h.errors["profiles:write"] = { message: "refus" };
    expect((await call()).status).toBe(500);
    expect(writes("sites")).toHaveLength(0);
  });

  it("la lecture du profil échoue => 500 (jamais un 200 « client inconnu »)", async () => {
    setup("active");
    h.errors["profiles"] = { message: "panne" };
    expect((await call()).status).toBe(500);
  });

  it("option marque blanche : panne de base => 500 ; migration absente => 200", async () => {
    setup("active");
    h.stripe.retrieve.mockResolvedValue(sub("active", ["price_solo", "price_brand"]));
    h.errors["brand_entitlements:write"] = { code: "08006", message: "panne" };
    expect((await call()).status).toBe(500);
    h.errors["brand_entitlements:write"] = { code: "42703", message: 'column "source" of relation "brand_entitlements" does not exist' };
    expect((await call()).status).toBe(200);
  });

  it("rejeu idempotent : deux livraisons du même événement donnent exactement les mêmes écritures", async () => {
    setup("canceled", "pro");
    expect((await call()).status).toBe(200);
    const first = normalized();
    h.log = [];
    expect((await call()).status).toBe(200);
    expect(normalized()).toBe(first);
  });

  it("statuts sans accès (unpaid, canceled, incomplete_expired, paused, incomplete) => Gratuit + suspension", async () => {
    for (const status of ["unpaid", "canceled", "incomplete_expired", "paused", "incomplete"]) {
      h.log = [];
      setup(status, "pro");
      expect((await call()).status, status).toBe(200);
      expect(plan(), status).toBe("gratuit");
      expect(suspended(), status).toHaveLength(1); // les deux sites passent à suspended_at (une seule écriture groupée)
    }
  });

  it("past_due : accès gardé (formule conservée, rien de suspendu)", async () => {
    setup("past_due", "solo");
    h.rows.sites = [{ slug: "s1", published_at: "2026-01-01" }];
    expect((await call()).status).toBe(200);
    expect(plan()).toBe("solo");
    expect(suspended()).toHaveLength(0);
  });

  it("événement non géré : ignoré proprement en 200 (jamais 500), sans écriture", async () => {
    h.stripe.constructEvent.mockReturnValue({ id: "evt", type: "charge.refunded", data: { object: { id: "ch_1" } } });
    const r = await call();
    expect(r.status).toBe(200);
    expect(await r.json()).toMatchObject({ ignored: true });
    expect(h.log).toHaveLength(0);
  });

  it("isMissingSchema distingue migration absente et panne", () => {
    expect(isMissingSchema({ code: "42P01" })).toBe(true);
    expect(isMissingSchema({ message: "Could not find the table 'x' in the schema cache" })).toBe(true);
    expect(isMissingSchema({ code: "08006", message: "connexion perdue" })).toBe(false);
    expect(isMissingSchema(null)).toBe(false);
  });
});

// ─── C. Double facturation ───────────────────────────────────────────────────────────────────────
describe("C. checkout : jamais de second abonnement dans le doute", () => {
  const go = () => checkout(req("POST", "/api/stripe/checkout", { origin: APP }, { plan: "pro", ...CONSENT }));
  const refused = async (status: number, code: string) => {
    const r = await go();
    expect(r.status).toBe(status);
    const b = await r.json();
    expect(b.code).toBe(code);
    expect(b.url).toBeUndefined();
    expect(h.stripe.sessionsCreate).not.toHaveBeenCalled();
    expect(h.stripe.customersCreate).not.toHaveBeenCalled();
    expect(writes("legal_acceptances")).toHaveLength(0);
    return b as { error: string };
  };

  it("cas nominal : aucun abonnement chez Stripe (ou seulement terminés) => la session est créée", async () => {
    h.stripe.list.mockResolvedValue({ data: [{ status: "canceled" }, { status: "incomplete_expired" }], has_more: false });
    h.stripe.sessionsCreate.mockResolvedValue({ url: "https://checkout.test/s" });
    const r = await go();
    expect(r.status).toBe(200);
    expect(await r.json()).toEqual({ url: "https://checkout.test/s" });
    expect(h.stripe.list).toHaveBeenCalledWith(expect.objectContaining({ customer: "cus_1", status: "all" }));
  });

  it("la base dit déjà payant => 409 avec renvoi au portail", async () => {
    h.rows.profiles = [{ plan: "solo", stripe_customer_id: "cus_1", stripe_subscription_id: "sub_1", subscription_status: "active" }];
    expect((await refused(409, "abonnement_existant")).error).toMatch(/portail/);
  });

  it("base = Gratuit mais abonnement non terminé enregistré (statut inconnu ou absent inclus) => 409", async () => {
    for (const st of ["active", "past_due", "unpaid", "paused", "incomplete", "statut_futur_inconnu", null]) {
      h.rows.profiles = [{ plan: "gratuit", stripe_customer_id: "cus_1", stripe_subscription_id: "sub_1", subscription_status: st }];
      await refused(409, "abonnement_existant");
    }
  });

  it("base en retard (Gratuit, rien d'enregistré) mais Stripe a un abonnement => 409 « abonnement existe déjà »", async () => {
    for (const st of ["active", "trialing", "past_due", "unpaid", "incomplete", "paused", "statut_futur_inconnu"]) {
      h.stripe.list.mockResolvedValue({ data: [{ status: "canceled" }, { status: st }], has_more: false });
      expect((await refused(409, "abonnement_existant")).error).toMatch(/abonnement existe déjà/);
    }
  });

  it("erreur de lecture Stripe => refus 503 (une erreur ne prouve pas l'absence), message clair, rien d'enregistré", async () => {
    h.stripe.list.mockRejectedValue(Object.assign(new Error("réseau"), { type: "StripeConnectionError" }));
    expect((await refused(503, "verification_impossible")).error).toMatch(/pas pu vérifier/);
  });

  it("réponse Stripe incomplète (plus de 100 abonnements, ou format inattendu) => refus", async () => {
    h.stripe.list.mockResolvedValue({ data: [{ status: "canceled" }], has_more: true });
    await refused(503, "verification_impossible");
    h.stripe.list.mockResolvedValue({});
    await refused(503, "verification_impossible");
  });

  it("lecture du profil en erreur => refus 503", async () => {
    h.errors["profiles"] = { message: "panne" };
    await refused(503, "verification_impossible");
  });

  it("subscriptionBlocksCheckout : seuls canceled et incomplete_expired libèrent", () => {
    expect(["canceled", "incomplete_expired"].map(subscriptionBlocksCheckout)).toEqual([false, false]);
    for (const s of ["active", "trialing", "past_due", "unpaid", "incomplete", "paused", "inconnu", "", null, undefined]) expect(subscriptionBlocksCheckout(s as string)).toBe(true);
  });
});

// ─── D. Sites suspendus et limite ────────────────────────────────────────────────────────────────
describe("D. un site suspendu ne compte pas dans la limite de publication", () => {
  const publishNew = () => publish(req("POST", "/api/sites", { origin: APP }, { ...siteBody, projectId: "projb2x", slug: "nouveau" }));

  it("Solo avec un seul site suspendu : on peut publier un nouveau site", async () => {
    h.rows.profiles = [{ plan: "solo" }];
    h.rows.sites = [{ slug: "vieux", project_id: "proja1", suspended_at: "2026-05-01" }];
    const r = await publishNew();
    expect(r.status).toBe(200);
    expect(writes("sites").filter(([, o]) => o === "insert")).toHaveLength(1);
  });

  it("Solo avec un site en ligne : toujours refusé (limite_sites)", async () => {
    h.rows.profiles = [{ plan: "solo" }];
    h.rows.sites = [{ slug: "actif", project_id: "proja1", suspended_at: null }];
    const r = await publishNew();
    expect(r.status).toBe(403);
    expect((await r.json()).code).toBe("limite_sites");
  });

  it("les boutiques suspendues sont exclues du décompte (la base est interrogée avec suspended_at nul)", async () => {
    h.rows.profiles = [{ plan: "solo" }];
    await publishNew();
    expect(h.log.some(([t, o, a]) => t === "boutiques" && o === "is" && JSON.stringify(a) === JSON.stringify(["suspended_at", null]))).toBe(true);
  });

  it("mettre à jour un site suspendu ne le réactive jamais (suspended_at n'est pas écrit) et le signale", async () => {
    h.rows.profiles = [{ plan: "solo" }];
    h.rows.sites = [{ slug: "vieux", project_id: "proja1", suspended_at: "2026-05-01" }];
    const r = await publish(req("POST", "/api/sites", { origin: APP }, siteBody));
    expect(r.status).toBe(200);
    expect((await r.json()).suspended).toBe(true);
    const upd = writes("sites").find(([, o]) => o === "update")![2] as Record<string, unknown>;
    expect(upd).not.toHaveProperty("suspended_at");
  });

  it("Gratuit : toujours refusé, suspendu ou non", async () => {
    h.rows.profiles = [{ plan: "gratuit" }];
    h.rows.sites = [{ slug: "vieux", project_id: "proja1", suspended_at: "2026-05-01" }];
    expect((await publishNew()).status).toBe(403);
  });
});
