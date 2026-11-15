import { beforeEach, describe, expect, it, vi } from "vitest";

// Étape 1 : lien compte Décollage <-> client Stripe. Stripe et Supabase sont SIMULÉS (aucun réseau, aucune vraie base, aucune clé).
const U = "00000000-0000-4000-8000-00000000000a";
const OTHER = "00000000-0000-4000-8000-00000000000b";
type Row = { id: string; plan: string; stripe_customer_id: string | null; stripe_subscription_id: string | null; subscription_status: string | null };
const h = vi.hoisted(() => ({
  rows: [] as Record<string, unknown>[],
  fail: {} as Record<string, boolean>,
  writes: [] as string[],
  user: { id: "00000000-0000-4000-8000-00000000000a", email: "a@exemple.fr" } as { id: string; email: string } | null,
  stripe: { retrieve: vi.fn(), constructEvent: vi.fn(), customersRetrieve: vi.fn(), customersCreate: vi.fn(), sessionsCreate: vi.fn(), list: vi.fn(), itemDel: vi.fn() },
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/env", () => ({
  isCloudConfigured: () => true,
  isPaymentConfigured: () => true,
  stripePrices: () => ({ solo: "price_solo", pro: "price_pro", illimite: "price_ill" }),
  stripeBrandPrice: () => "price_brand",
  stripeLegacyPrices: () => ({}),
  stripeWebhookSecret: () => "whsec_test",
  appUrl: () => "https://app.test",
}));
vi.mock("@/lib/stripe", () => ({
  getStripe: () => ({
    subscriptions: { retrieve: h.stripe.retrieve, list: h.stripe.list },
    subscriptionItems: { del: h.stripe.itemDel },
    webhooks: { constructEvent: h.stripe.constructEvent },
    customers: { retrieve: h.stripe.customersRetrieve, create: h.stripe.customersCreate },
    checkout: { sessions: { create: h.stripe.sessionsCreate } },
  }),
}));
vi.mock("@/lib/legal-acceptance", async (orig) => ({ ...(await orig<typeof import("@/lib/legal-acceptance")>()), recordAcceptances: async () => true }));
vi.mock("@/lib/site-lifecycle", () => ({ isMissingSchema: () => false, syncPublicationsWithPlan: async () => ({ ok: true }) }));

function table(name: string) {
  const filters: [string, unknown, boolean][] = [];
  let op: "select" | "update" | "upsert" = "select";
  let vals: Record<string, unknown> = {};
  const q: Record<string, unknown> = {};
  const match = () => (name === "profiles" ? h.rows : []).filter((r) => filters.every(([c, v, isNull]) => (isNull ? r[c] == null : r[c] === v)));
  const run = () => {
    const key = `${name}:${op === "select" ? "read" : "write"}`;
    if (h.fail[key]) return { data: null, error: { message: "panne simulée" } };
    if (op === "update") { match().forEach((r) => Object.assign(r, vals)); h.writes.push(`update ${JSON.stringify(vals)}`); return { data: null, error: null }; }
    if (op === "upsert") { h.writes.push(`upsert ${JSON.stringify(vals)}`); return { data: null, error: null }; }
    return { data: match(), error: null };
  };
  q.select = () => q;
  q.eq = (c: string, v: unknown) => { filters.push([c, v, false]); return q; };
  q.is = (c: string) => { filters.push([c, null, true]); return q; };
  q.update = (v: Record<string, unknown>) => { op = "update"; vals = v; return q; };
  q.upsert = (v: Record<string, unknown>) => { op = "upsert"; vals = v; return q; };
  q.insert = () => q;
  q.maybeSingle = async () => { const r = run(); return { data: (r.data as unknown[] | null)?.[0] ?? null, error: r.error }; };
  q.then = (ok: (v: unknown) => unknown, ko?: (e: unknown) => unknown) => Promise.resolve(run()).then(ok, ko);
  return q;
}
const client = () => ({ from: table });
vi.mock("@/lib/supabase/server", () => ({ getUser: async () => ({ supabase: client(), user: h.user }), createAdminClient: () => client() }));

import { POST as checkout } from "@/app/api/stripe/checkout/route";
import { POST as webhook } from "@/app/api/stripe/webhook/route";
import { resolveProfileLink } from "@/lib/billing";
import { VERSIONS } from "@/data/legal";

const profile = (): Row => h.rows[0] as Row;
const pay = () => checkout(new Request("https://app.test/api/stripe/checkout", { method: "POST", headers: { "content-type": "application/json", origin: "https://app.test" }, body: JSON.stringify({ plan: "solo", acceptCgv: true, renonciation: true, cgvVersion: VERSIONS.cgv }) }));
function hook(sub: { metadata?: Record<string, string> } = { metadata: { user_id: U } }, customer: unknown = { id: "cus_1", metadata: { user_id: U } }) {
  h.stripe.retrieve.mockResolvedValue({ id: "sub_1", customer: "cus_1", status: "active", ...sub, items: { data: [{ id: "si_1", price: { id: "price_solo" } }] } });
  h.stripe.customersRetrieve.mockResolvedValue(customer);
  h.stripe.constructEvent.mockReturnValue({ id: "evt_1", type: "customer.subscription.updated", data: { object: { id: "sub_1" } } });
  return webhook(new Request("https://app.test/api/stripe/webhook", { method: "POST", headers: { "stripe-signature": "x" }, body: "{}" }));
}

beforeEach(() => {
  h.rows = [{ id: U, plan: "gratuit", stripe_customer_id: null, stripe_subscription_id: null, subscription_status: null }];
  h.fail = {};
  h.writes = [];
  h.user = { id: U, email: "a@exemple.fr" };
  Object.values(h.stripe).forEach((f) => f.mockReset());
  h.stripe.list.mockResolvedValue({ data: [], has_more: false });
  h.stripe.customersCreate.mockResolvedValue({ id: "cus_1" });
  h.stripe.sessionsCreate.mockResolvedValue({ url: "https://checkout.test/s" });
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
});

describe("checkout : le lien client Stripe doit être enregistré avant tout paiement", () => {
  it("(1)(2) upsert échoué -> 503 et AUCUNE session de paiement", async () => {
    h.fail["profiles:write"] = true;
    const r = await pay();
    expect(r.status).toBe(503);
    expect(h.stripe.sessionsCreate).not.toHaveBeenCalled();
  });
  it("nouvelle tentative : même clé d'idempotence (aucun doublon de client), puis session ouverte", async () => {
    h.fail["profiles:write"] = true;
    await pay();
    h.fail = {};
    const r = await pay();
    expect(r.status).toBe(200);
    expect(h.stripe.customersCreate).toHaveBeenCalledTimes(2);
    for (const c of h.stripe.customersCreate.mock.calls) expect(c[1]).toEqual({ idempotencyKey: `decollage-customer-${U}` });
    expect(h.stripe.sessionsCreate).toHaveBeenCalledTimes(1);
  });
});

describe("webhook : récupération du compte sans lien", () => {
  it("(3)(4) métadonnées valides, compte sans identifiant Stripe -> lien réparé et formule accordée", async () => {
    const r = await hook();
    expect(r.status).toBe(200);
    expect(profile()).toMatchObject({ stripe_customer_id: "cus_1", plan: "solo", stripe_subscription_id: "sub_1" });
    expect(h.stripe.customersRetrieve).toHaveBeenCalledWith("cus_1");
  });
  it("(5) métadonnées client et abonnement différentes -> aucune écriture", async () => {
    const r = await hook({ metadata: { user_id: U } }, { id: "cus_1", metadata: { user_id: OTHER } });
    expect(r.status).toBe(200);
    expect(h.writes).toHaveLength(0);
    expect(profile().plan).toBe("gratuit");
  });
  it("client supprimé chez Stripe -> aucune écriture", async () => {
    await hook({ metadata: { user_id: U } }, { id: "cus_1", deleted: true });
    expect(h.writes).toHaveLength(0);
  });
  it("(6) compte déjà lié à un autre client -> rien modifié, alerte journalisée sans e-mail", async () => {
    profile().stripe_customer_id = "cus_AUTRE";
    const r = await hook();
    expect(r.status).toBe(200);
    expect(h.writes).toHaveLength(0);
    expect(profile()).toMatchObject({ stripe_customer_id: "cus_AUTRE", plan: "gratuit" });
    const logs = JSON.stringify(vi.mocked(console.error).mock.calls);
    expect(logs).toContain("ALERTE réconciliation manuelle");
    expect(logs).not.toContain("@");
  });
  it("(7) métadonnées absentes -> ignoré, aucun appel client, aucune écriture", async () => {
    const r = await hook({ metadata: {} });
    expect(r.status).toBe(200);
    expect(await r.json()).toMatchObject({ ignored: true });
    expect(h.stripe.customersRetrieve).not.toHaveBeenCalled();
    expect(h.writes).toHaveLength(0);
  });
  it("(8) métadonnées invalides (non UUID) -> ignoré", async () => {
    const r = await hook({ metadata: { user_id: "x' or 1=1" } });
    expect(await r.json()).toMatchObject({ ignored: true });
    expect(h.stripe.customersRetrieve).not.toHaveBeenCalled();
    expect(h.writes).toHaveLength(0);
  });
  it("(9) erreur Supabase pendant la récupération -> 500 (Stripe rejouera)", async () => {
    h.fail["profiles:read"] = true;
    expect((await hook()).status).toBe(500);
    expect(h.writes).toHaveLength(0);
  });
  it("(9b) erreur Supabase pendant la réparation du lien -> 500", async () => {
    h.fail["profiles:write"] = true;
    expect((await hook()).status).toBe(500);
  });
  it("(10) rejeu du même événement -> une seule réparation du lien, même résultat", async () => {
    expect((await hook()).status).toBe(200);
    const after = JSON.stringify({ ...profile(), updated_at: undefined });
    expect((await hook()).status).toBe(200);
    expect(JSON.stringify({ ...profile(), updated_at: undefined })).toBe(after);
    expect(h.writes.filter((w) => w.includes("stripe_customer_id"))).toHaveLength(1);
  });
  it("(11) compte supprimé -> ignoré sans erreur permanente (200)", async () => {
    h.rows = [];
    const r = await hook();
    expect(r.status).toBe(200);
    expect(await r.json()).toMatchObject({ ignored: true });
  });
  it("compte déjà lié au bon client : chemin normal, sans appel de secours", async () => {
    profile().stripe_customer_id = "cus_1";
    expect((await hook()).status).toBe(200);
    expect(h.stripe.customersRetrieve).not.toHaveBeenCalled();
    expect(profile().plan).toBe("solo");
  });
});

describe("resolveProfileLink (fonction pure)", () => {
  const base = { customerId: "cus_1", subUserId: U, customerUserId: U, profile: { id: U, stripe_customer_id: null as string | null } };
  it("décisions", () => {
    expect(resolveProfileLink(base)).toEqual({ action: "reparer", userId: U });
    expect(resolveProfileLink({ ...base, profile: { id: U, stripe_customer_id: "cus_1" } })).toEqual({ action: "lier_deja", userId: U });
    expect(resolveProfileLink({ ...base, profile: { id: U, stripe_customer_id: "cus_2" } })).toEqual({ action: "alerter_autre_lien", userId: U });
    expect(resolveProfileLink({ ...base, subUserId: undefined })).toEqual({ action: "ignorer", reason: "metadonnees_absentes" });
    expect(resolveProfileLink({ ...base, subUserId: "abc" })).toEqual({ action: "ignorer", reason: "metadonnees_invalides" });
    expect(resolveProfileLink({ ...base, customerUserId: OTHER })).toEqual({ action: "ignorer", reason: "client_incoherent" });
    expect(resolveProfileLink({ ...base, customerUserId: null })).toEqual({ action: "ignorer", reason: "client_incoherent" });
    expect(resolveProfileLink({ ...base, profile: null })).toEqual({ action: "ignorer", reason: "compte_absent" });
  });
});
