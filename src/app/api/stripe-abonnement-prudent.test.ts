import { beforeEach, describe, expect, it, vi } from "vitest";

// Abonnements Stripe : approche prudente (docs/STRIPE-ABONNEMENT-PRUDENT.md). Supabase et Stripe sont SIMULÉS : aucune vraie base,
// aucun vrai paiement, aucun appel réseau.
const h = vi.hoisted(() => ({
  user: { id: "u-a", email: "a@exemple.fr" } as { id: string; email: string } | null,
  rows: {} as Record<string, unknown[]>,
  errors: {} as Record<string, { code?: string; message?: string } | null>,
  log: [] as [string, string, unknown][],
  stripe: { retrieve: vi.fn(), constructEvent: vi.fn(), list: vi.fn(), sessionsCreate: vi.fn(), portal: vi.fn(), customersCreate: vi.fn() },
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
    subscriptions: { retrieve: h.stripe.retrieve, list: h.stripe.list },
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
  const err = () => h.errors[w ? name + ":write" : name] ?? null;
  for (const m of ["select", "eq", "in", "order", "limit", "is"]) q[m] = self;
  for (const m of ["update", "insert", "upsert", "delete"]) q[m] = (v: unknown) => { w = true; h.log.push([name, m, v]); return q; };
  q.maybeSingle = () => Promise.resolve({ data: (h.rows[name] ?? [])[0] ?? null, error: err() });
  q.single = q.maybeSingle;
  q.then = (ok: (v: unknown) => unknown) => ok({ data: h.rows[name] ?? [], error: err() });
  return q;
}
const client = () => ({ from: (t: string) => fakeTable(t), auth: { admin: { deleteUser: async () => ({ error: null }) } } });
vi.mock("@/lib/supabase/server", () => ({ getUser: async () => ({ supabase: client(), user: h.user }), createAdminClient: () => client(), createPublicClient: () => client() }));

import { VERSIONS } from "@/data/legal";
import { POST as checkout } from "@/app/api/stripe/checkout/route";
import { POST as portal } from "@/app/api/stripe/portal/route";
import { POST as webhook } from "@/app/api/stripe/webhook/route";
import { blockingStatus, existingSubscriptionRefusal, refusalButtons, subscriptionBlocksCheckout, verificationRefusal } from "@/lib/billing";

const APP = "https://app.test";
const req = (path: string, body?: unknown, headers: Record<string, string> = {}) =>
  new Request(`${APP}${path}`, { method: "POST", headers: { "content-type": "application/json", origin: APP, ...headers }, body: body === undefined ? undefined : JSON.stringify(body) });
const CONSENT = { acceptCgv: true, renonciation: true, cgvVersion: VERSIONS.cgv };
const go = (plan = "pro") => checkout(req("/api/stripe/checkout", { plan, ...CONSENT }));
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

// Table de décision : statut -> (checkout autorisé ?, action, texte clé)
const TABLE: { status: string | null; blocks: boolean; action?: "portail" | "contact"; mot?: RegExp }[] = [
  { status: "active", blocks: true, action: "portail", mot: /est actif/ },
  { status: "trialing", blocks: true, action: "portail", mot: /est actif/ },
  { status: "past_due", blocks: true, action: "portail", mot: /dernier paiement a échoué/ },
  { status: "unpaid", blocks: true, action: "portail", mot: /impayé/ },
  { status: "paused", blocks: true, action: "portail", mot: /en pause/ },
  { status: "incomplete", blocks: true, action: "contact", mot: /pas été finalisé/ },
  { status: "incomplete_expired", blocks: false },
  { status: "canceled", blocks: false },
  { status: "statut_futur_inconnu", blocks: true, action: "contact", mot: /ne reconnaissons pas/ },
  { status: null, blocks: true, action: "contact", mot: /ne reconnaissons pas/ },
];

describe("table de décision : message et action pour chaque statut (logique pure)", () => {
  for (const row of TABLE.filter((r) => r.blocks)) {
    it(`statut ${String(row.status)} : refus, action ${row.action}, jamais de second abonnement`, () => {
      const r = existingSubscriptionRefusal(row.status, true);
      expect(r.code).toBe("abonnement_existant");
      expect(r.action).toBe(row.action);
      expect(r.error).toMatch(row.mot!);
      expect(r.error).toMatch(/abonnement existe déjà/);
      expect(r.error).toMatch(/pas facturé deux fois/);
      expect(r.error).toMatch(/second abonnement/);
      // Jamais de promesse que le portail règle un cas incertain.
      if (["unpaid", "paused", "incomplete"].includes(row.status as string)) expect(r.error).toMatch(/contacte-nous/);
    });
    it(`statut ${String(row.status)} sans client Stripe connu : le portail n'est jamais proposé`, () => {
      expect(existingSubscriptionRefusal(row.status, false).action).toBe("contact");
    });
  }
  it("statut terminé : le paiement n'est pas bloqué", () => {
    for (const row of TABLE.filter((r) => !r.blocks)) expect(subscriptionBlocksCheckout(row.status)).toBe(false);
  });
  it("plusieurs abonnements : le statut le plus significatif est retenu ; les terminés sont ignorés ; un inconnu bloque", () => {
    expect(blockingStatus(["canceled", "incomplete_expired"])).toBeUndefined();
    expect(blockingStatus([])).toBeUndefined();
    expect(blockingStatus(["canceled", "incomplete", "past_due"])).toBe("past_due");
    expect(blockingStatus(["incomplete", "active"])).toBe("active");
    expect(blockingStatus(["canceled", "bizarre"])).toBeNull();
    expect(blockingStatus(["incomplete", "bizarre"])).toBe("incomplete");
  });
  it("vérification impossible : « réessayer », aucune promesse de portail, rappel de non-double facturation", () => {
    const r = verificationRefusal();
    expect(r).toMatchObject({ code: "verification_impossible", action: "reessayer" });
    expect(r.error).toMatch(/pas pu vérifier/);
    expect(r.error).toMatch(/pas facturé deux fois/);
  });
  it("boutons de la page Paramètres selon le refus", () => {
    expect(refusalButtons({ code: "abonnement_existant", action: "portail" })).toEqual({ portail: true, reessayer: false, contact: true });
    expect(refusalButtons({ code: "abonnement_existant", action: "contact" })).toEqual({ portail: false, reessayer: false, contact: true });
    expect(refusalButtons({ code: "verification_impossible", action: "reessayer" })).toEqual({ portail: true, reessayer: true, contact: false });
    expect(refusalButtons({})).toEqual({ portail: false, reessayer: false, contact: true });
  });
});

describe("API checkout (Stripe simulé) : chaque statut", () => {
  const nothingCreated = () => {
    expect(h.stripe.sessionsCreate).not.toHaveBeenCalled();
    expect(h.stripe.customersCreate).not.toHaveBeenCalled();
    expect(writes("legal_acceptances")).toHaveLength(0);
  };

  for (const row of TABLE) {
    if (row.blocks) {
      it(`statut ${String(row.status)} enregistré chez nous => 409 avec message et action`, async () => {
        h.rows.profiles = [{ id: "u-a", plan: "gratuit", stripe_customer_id: "cus_1", stripe_subscription_id: "sub_1", subscription_status: row.status }];
        const r = await go();
        expect(r.status).toBe(409);
        const b = await r.json();
        expect(b).toMatchObject({ code: "abonnement_existant", action: row.action });
        expect(b.error).toMatch(row.mot!);
        expect(b.url).toBeUndefined();
        nothingCreated();
      });
      it(`statut ${String(row.status)} vu seulement chez Stripe (base en retard) => 409 identique`, async () => {
        h.stripe.list.mockResolvedValue({ data: [{ status: "canceled" }, { status: row.status }], has_more: false });
        const r = await go();
        expect(r.status).toBe(409);
        expect(await r.json()).toMatchObject({ code: "abonnement_existant", action: row.action });
        nothingCreated();
      });
    } else {
      it(`statut ${String(row.status)} (terminé) => la session de paiement est ouverte`, async () => {
        h.rows.profiles = [{ id: "u-a", plan: "gratuit", stripe_customer_id: "cus_1", stripe_subscription_id: "sub_1", subscription_status: row.status }];
        h.stripe.list.mockResolvedValue({ data: [{ status: row.status }], has_more: false });
        h.stripe.sessionsCreate.mockResolvedValue({ url: "https://checkout.test/s" });
        const r = await go();
        expect(r.status).toBe(200);
        expect(await r.json()).toEqual({ url: "https://checkout.test/s" });
      });
    }
  }

  it("formule payante en base (active) => 409 portail, même sans lecture Stripe", async () => {
    h.rows.profiles = [{ id: "u-a", plan: "solo", stripe_customer_id: "cus_1", stripe_subscription_id: "sub_1", subscription_status: "active" }];
    const r = await go();
    expect(r.status).toBe(409);
    expect((await r.json()).action).toBe("portail");
    expect(h.stripe.list).not.toHaveBeenCalled();
  });

  it("incomplete : aucune promesse de portail, contact proposé", async () => {
    h.rows.profiles = [{ id: "u-a", plan: "gratuit", stripe_customer_id: "cus_1", stripe_subscription_id: "sub_1", subscription_status: "incomplete" }];
    const b = await (await go()).json();
    expect(b.action).toBe("contact");
    expect(b.error).not.toMatch(/portail/);
  });

  it("vérification impossible (Stripe en panne, plus de 100 abonnements, base en panne) => 503, action « réessayer », rien créé", async () => {
    h.stripe.list.mockRejectedValue(Object.assign(new Error("réseau"), { type: "StripeConnectionError" }));
    let r = await go();
    expect(r.status).toBe(503);
    expect(await r.json()).toMatchObject({ code: "verification_impossible", action: "reessayer" });
    h.stripe.list.mockResolvedValue({ data: [], has_more: true });
    r = await go();
    expect(r.status).toBe(503);
    h.stripe.list.mockResolvedValue({ data: [], has_more: false });
    h.errors["profiles"] = { message: "panne" };
    r = await go();
    expect(r.status).toBe(503);
    expect((await r.json()).action).toBe("reessayer");
    nothingCreated();
  });

  it("deux clics simultanés : mêmes clés d'idempotence Stripe (même session, même client)", async () => {
    h.rows.profiles = [{ id: "u-a", plan: "gratuit", stripe_customer_id: null, stripe_subscription_id: null, subscription_status: null }];
    h.stripe.customersCreate.mockResolvedValue({ id: "cus_new" });
    h.stripe.sessionsCreate.mockResolvedValue({ url: "https://checkout.test/s" });
    await Promise.all([go(), go()]);
    expect(h.stripe.customersCreate).toHaveBeenCalledTimes(2);
    const c = h.stripe.customersCreate.mock.calls.map((a) => a[1]);
    expect(c[0]).toEqual(c[1]);
    expect(c[0].idempotencyKey).toMatch(/^decollage-customer-u-a$/);
    const s = h.stripe.sessionsCreate.mock.calls.map((a) => a[1]);
    expect(s[0]).toEqual(s[1]);
    expect(s[0].idempotencyKey).toMatch(/^decollage-checkout-u-a-pro-price_pro-/);
  });

  it("formules différentes : clés distinctes (limite connue, documentée)", async () => {
    h.stripe.sessionsCreate.mockResolvedValue({ url: "https://checkout.test/s" });
    await go("solo");
    await go("pro");
    const k = h.stripe.sessionsCreate.mock.calls.map((a) => a[1].idempotencyKey);
    expect(k[0]).not.toBe(k[1]);
  });
});

describe("API portail : client Stripe connu même si l'abonnement n'est pas reconnu", () => {
  it("ouvre le portail dès qu'un client Stripe existe, quel que soit le statut enregistré", async () => {
    h.stripe.portal.mockResolvedValue({ url: "https://portal.test/x" });
    for (const st of [null, "incomplete", "unpaid", "paused", "statut_futur_inconnu"]) {
      h.rows.profiles = [{ id: "u-a", plan: "gratuit", stripe_customer_id: "cus_1", stripe_subscription_id: "sub_1", subscription_status: st }];
      const r = await portal(req("/api/stripe/portal"));
      expect(r.status, String(st)).toBe(200);
      expect(await r.json()).toEqual({ url: "https://portal.test/x" });
    }
    expect(h.stripe.portal).toHaveBeenCalledWith(expect.objectContaining({ customer: "cus_1" }));
  });
  it("sans client Stripe : 400 explicite, rien d'appelé", async () => {
    h.rows.profiles = [{ id: "u-a", plan: "gratuit", stripe_customer_id: null }];
    const r = await portal(req("/api/stripe/portal"));
    expect(r.status).toBe(400);
    expect(h.stripe.portal).not.toHaveBeenCalled();
  });
  it("panne Stripe : message propre (pas d'erreur 500 brute) avec renvoi vers Contact", async () => {
    h.stripe.portal.mockRejectedValue(Object.assign(new Error("secret"), { type: "StripeConnectionError" }));
    const r = await portal(req("/api/stripe/portal"));
    expect(r.status).toBe(502);
    const b = await r.json();
    expect(b.error).toMatch(/Contact/);
    expect(JSON.stringify(b)).not.toMatch(/secret/);
  });
});

describe("webhook : rattrape un abonnement non reconnu sans en créer ni le doubler", () => {
  const event = { id: "evt_1", type: "customer.subscription.updated", data: { object: { id: "sub_2" } } };
  const sub = (status: string, items: string[]) => ({ id: "sub_2", customer: "cus_1", status, items: { data: items.map((id) => ({ price: { id } })) }, metadata: {} });
  const call = () => webhook(req("/api/stripe/webhook", {}, { "stripe-signature": "t=1,v1=x", origin: "" }));
  const profile = (v: Record<string, unknown>) => { h.rows.profiles = [{ id: "u-a", plan: "gratuit", stripe_customer_id: "cus_1", stripe_subscription_id: null, subscription_status: null, ...v }]; };
  const written = () => writes("profiles")[0]?.[2] as { plan?: string; stripe_subscription_id?: string; subscription_status?: string } | undefined;
  beforeEach(() => h.stripe.constructEvent.mockReturnValue(event));

  it("abonnement actif au prix connu mais base en retard : formule correcte enregistrée, identifiant et statut mémorisés (le checkout se bloque ensuite)", async () => {
    h.stripe.retrieve.mockResolvedValue(sub("active", ["price_pro"]));
    profile({});
    expect((await call()).status).toBe(200);
    expect(written()).toMatchObject({ plan: "pro", stripe_subscription_id: "sub_2", subscription_status: "active" });
    expect(h.stripe.sessionsCreate).not.toHaveBeenCalled();
    expect(h.stripe.customersCreate).not.toHaveBeenCalled();
  });
  it("prix inconnu : jamais de formule payante accordée, mais l'abonnement est mémorisé (checkout bloqué, portail utilisable)", async () => {
    h.stripe.retrieve.mockResolvedValue(sub("active", ["price_inconnu"]));
    profile({});
    expect((await call()).status).toBe(200);
    expect(written()).toMatchObject({ plan: "gratuit", stripe_subscription_id: "sub_2", subscription_status: "active" });
    h.log = [];
    profile({ stripe_subscription_id: "sub_2", subscription_status: "active" });
    expect((await go()).status).toBe(409);
  });
  it("incomplete : Gratuit, statut mémorisé ; incomplete_expired ensuite : le paiement est de nouveau possible", async () => {
    h.stripe.retrieve.mockResolvedValue(sub("incomplete", ["price_pro"]));
    profile({});
    await call();
    expect(written()).toMatchObject({ plan: "gratuit", subscription_status: "incomplete" });
    h.stripe.retrieve.mockResolvedValue(sub("incomplete_expired", ["price_pro"]));
    h.log = [];
    profile({ stripe_subscription_id: "sub_2", subscription_status: "incomplete" });
    await call();
    expect(written()).toMatchObject({ plan: "gratuit", subscription_status: "incomplete_expired" });
    h.stripe.list.mockResolvedValue({ data: [{ status: "incomplete_expired" }], has_more: false });
    h.stripe.sessionsCreate.mockResolvedValue({ url: "https://checkout.test/s" });
    profile({ stripe_subscription_id: "sub_2", subscription_status: "incomplete_expired" });
    expect((await go()).status).toBe(200);
  });
  it("rejeu du même événement : mêmes écritures (pas de doublon)", async () => {
    h.stripe.retrieve.mockResolvedValue(sub("active", ["price_pro"]));
    profile({});
    await call();
    const first = JSON.stringify(writes("profiles").map(([, , v]) => ({ ...(v as object), updated_at: 0 })));
    h.log = [];
    profile({ plan: "pro", stripe_subscription_id: "sub_2", subscription_status: "active" });
    await call();
    expect(JSON.stringify(writes("profiles").map(([, , v]) => ({ ...(v as object), updated_at: 0 })))).toBe(first);
  });
  it("un second abonnement actif alors qu'un autre l'est déjà : alerte dans les journaux, aucune résiliation automatique", async () => {
    h.stripe.retrieve.mockResolvedValue(sub("active", ["price_pro"]));
    profile({ plan: "solo", stripe_subscription_id: "sub_1", subscription_status: "active" });
    expect((await call()).status).toBe(200);
    expect((console.error as unknown as ReturnType<typeof vi.fn>).mock.calls.some((c) => String(c[0]).includes("ALERTE double abonnement"))).toBe(true);
  });
  it("un ancien abonnement qui se termine ne retire pas l'accès du plus récent", async () => {
    h.stripe.retrieve.mockResolvedValue({ ...sub("canceled", ["price_solo"]), id: "sub_old" });
    h.stripe.constructEvent.mockReturnValue({ ...event, data: { object: { id: "sub_old" } } });
    profile({ plan: "pro", stripe_subscription_id: "sub_2", subscription_status: "active" });
    const r = await call();
    expect(await r.json()).toMatchObject({ ignored: true });
    expect(writes("profiles")).toHaveLength(0);
  });
});
