import { beforeEach, describe, expect, it, vi } from "vitest";

// Routes testées avec Supabase et Stripe simulés : on vérifie l'ordre des opérations et les refus,
// jamais de vraie base ni de vrai paiement.
const h = vi.hoisted(() => {
  const state = {
    user: { id: "u-a", email: "a@exemple.fr" } as { id: string; email: string } | null,
    rows: {} as Record<string, unknown[]>,
    failInsert: false,
    log: [] as [string, string, unknown][],
    stripe: {
      cancel: vi.fn(),
      retrieve: vi.fn(),
      customersCreate: vi.fn(),
      sessionsCreate: vi.fn(),
      eventRetrieve: vi.fn(),
      constructEvent: vi.fn(),
    },
    deleteUser: vi.fn(async () => ({ error: null as { message: string } | null })),
  };
  return state;
});

vi.mock("server-only", () => ({}));
vi.mock("@/lib/env", () => ({
  isCloudConfigured: () => true,
  isPaymentConfigured: () => true,
  stripePrices: () => ({ solo: "price_solo", pro: "price_pro", illimite: "price_ill" }),
  stripeWebhookSecret: () => "whsec_test",
  appUrl: () => "https://decollage.test",
}));
vi.mock("@/lib/stripe", () => ({
  getStripe: () => ({
    subscriptions: { cancel: h.stripe.cancel, retrieve: h.stripe.retrieve },
    customers: { create: h.stripe.customersCreate },
    checkout: { sessions: { create: h.stripe.sessionsCreate } },
    webhooks: { constructEvent: h.stripe.constructEvent },
  }),
}));

function fakeTable(name: string) {
  const q: Record<string, unknown> = {};
  const self = () => q;
  q.select = self;
  q.eq = self;
  q.in = self;
  q.update = (v: unknown) => { h.log.push([name, "update", v]); return q; };
  q.upsert = (v: unknown) => { h.log.push([name, "upsert", v]); return Promise.resolve({ error: null }); };
  q.insert = (v: unknown) => { h.log.push([name, "insert", v]); return Promise.resolve({ error: h.failInsert ? { message: "x" } : null }); };
  q.delete = (v: unknown) => { h.log.push([name, "delete", v]); return q; };
  q.maybeSingle = () => Promise.resolve({ data: (h.rows[name] ?? [])[0] ?? null, error: null });
  q.then = (res: (v: unknown) => unknown) => res({ data: h.rows[name] ?? [], error: null });
  return q;
}
const fakeClient = () => ({ from: (t: string) => fakeTable(t), auth: { admin: { deleteUser: h.deleteUser }, getUser: async () => ({ data: { user: h.user } }) } });

vi.mock("@/lib/supabase/server", () => ({
  getUser: async () => ({ supabase: fakeClient(), user: h.user }),
  createAdminClient: () => fakeClient(),
  createPublicClient: () => fakeClient(),
}));

import { VERSIONS } from "@/data/legal";
import { DELETE as deleteAccount } from "@/app/api/account/route";
import { GET as exportAccount } from "@/app/api/account/export/route";
import { POST as accept } from "@/app/api/legal/accept/route";
import { POST as checkout } from "@/app/api/stripe/checkout/route";
import { POST as webhook } from "@/app/api/stripe/webhook/route";
import { POST as publish } from "@/app/api/sites/route";
import { newProject } from "@/lib/project";
import { siteData } from "@/lib/publish";

const post = (url: string, body: unknown, headers: Record<string, string> = {}) => new Request(`https://decollage.test${url}`, { method: "POST", headers: { "content-type": "application/json", ...headers }, body: typeof body === "string" ? body : JSON.stringify(body) });
const CONSENT = { acceptCgv: true, renonciation: true, cgvVersion: VERSIONS.cgv };

beforeEach(() => {
  h.user = { id: "u-a", email: "a@exemple.fr" };
  h.rows = { profiles: [{ plan: "gratuit", stripe_customer_id: "cus_1", stripe_subscription_id: null, subscription_status: null }] };
  h.failInsert = false;
  h.log = [];
  Object.values(h.stripe).forEach((f) => f.mockReset());
  h.deleteUser.mockReset().mockResolvedValue({ error: null });
});

describe("POST /api/stripe/checkout : preuve avant paiement", () => {
  it("refuse sans les confirmations et n'appelle jamais Stripe", async () => {
    for (const body of [{ plan: "solo" }, { plan: "solo", ...CONSENT, acceptCgv: false }, { plan: "solo", ...CONSENT, renonciation: false }, { plan: "solo", ...CONSENT, cgvVersion: "ancienne" }]) {
      const r = await checkout(post("/api/stripe/checkout", body));
      expect(r.status).toBeGreaterThanOrEqual(400);
      expect(await r.json()).toHaveProperty("error");
    }
    expect(h.stripe.sessionsCreate).not.toHaveBeenCalled();
    expect(h.stripe.customersCreate).not.toHaveBeenCalled();
    expect(h.log.filter(([t, op]) => t === "legal_acceptances" && op === "insert")).toHaveLength(0);
  });

  it("refuse sans connexion", async () => {
    h.user = null;
    expect((await checkout(post("/api/stripe/checkout", { plan: "solo", ...CONSENT }))).status).toBe(401);
  });

  it("enregistre la preuve AVANT d'ouvrir le paiement, puis renvoie l'adresse Stripe", async () => {
    h.stripe.sessionsCreate.mockImplementation(async () => {
      expect(h.log.some(([t, op]) => t === "legal_acceptances" && op === "insert")).toBe(true); // déjà enregistrée
      return { url: "https://checkout.stripe.test/s" };
    });
    const r = await checkout(post("/api/stripe/checkout", { plan: "pro", ...CONSENT }));
    expect(r.status).toBe(200);
    expect(await r.json()).toEqual({ url: "https://checkout.stripe.test/s" });
    const row = (h.log.find(([t, op]) => t === "legal_acceptances" && op === "insert")![2] as Record<string, unknown>[])[0]!;
    expect(row).toMatchObject({ user_id: "u-a", document: "cgv", version: VERSIONS.cgv, contexte: "achat", renonciation_retractation: true, formule: "pro" });
    expect(row).not.toHaveProperty("ip");
  });

  it("si la preuve ne peut pas être enregistrée, le paiement n'est pas ouvert", async () => {
    h.failInsert = true;
    const r = await checkout(post("/api/stripe/checkout", { plan: "solo", ...CONSENT }));
    expect(r.status).toBe(500);
    expect(h.stripe.sessionsCreate).not.toHaveBeenCalled();
    expect(JSON.stringify(await r.json())).not.toContain("url");
  });

  it("un échec Stripe renvoie une erreur, jamais une adresse de paiement", async () => {
    h.stripe.sessionsCreate.mockRejectedValue(Object.assign(new Error("boom"), { type: "StripeConnectionError" }));
    const r = await checkout(post("/api/stripe/checkout", { plan: "solo", ...CONSENT }));
    expect(r.status).toBeGreaterThanOrEqual(500);
    const body = await r.json();
    expect(body.url).toBeUndefined();
    expect(body.error).toBeTruthy();
  });
});

describe("DELETE /api/account : ordre sûr", () => {
  it("si la résiliation échoue vraiment, le compte n'est PAS supprimé et le message est clair", async () => {
    h.rows.profiles = [{ stripe_subscription_id: "sub_1", subscription_status: "active" }];
    h.stripe.cancel.mockRejectedValue(new Error("réseau"));
    h.stripe.retrieve.mockRejectedValue(new Error("réseau"));
    const r = await deleteAccount();
    expect(r.status).toBe(502);
    expect((await r.json()).error).toMatch(/n'a PAS été supprimé/);
    expect(h.deleteUser).not.toHaveBeenCalled();
  });

  it("un abonnement déjà terminé chez Stripe ne bloque pas l'effacement", async () => {
    h.rows.profiles = [{ stripe_subscription_id: "sub_1", subscription_status: "past_due" }];
    h.stripe.cancel.mockRejectedValue(new Error("non annulable"));
    h.stripe.retrieve.mockResolvedValue({ status: "incomplete_expired" });
    expect((await deleteAccount()).status).toBe(200);
    expect(h.deleteUser).toHaveBeenCalledWith("u-a");
  });

  it("résilie puis supprime, sans jamais toucher au client ni aux factures Stripe", async () => {
    h.rows.profiles = [{ stripe_subscription_id: "sub_1", subscription_status: "active" }];
    h.stripe.cancel.mockResolvedValue({});
    expect((await deleteAccount()).status).toBe(200);
    expect(h.stripe.cancel).toHaveBeenCalledWith("sub_1");
    expect(h.deleteUser).toHaveBeenCalledWith("u-a");
  });

  it("refuse sans connexion", async () => {
    h.user = null;
    expect((await deleteAccount()).status).toBe(401);
    expect(h.deleteUser).not.toHaveBeenCalled();
  });
});

describe("POST /api/stripe/webhook : client supprimé (I-4)", () => {
  it("répond 200 sans erreur pour un client inconnu, sans rien écrire ni journaliser de donnée personnelle", async () => {
    h.rows.profiles = [];
    h.stripe.constructEvent.mockReturnValue({ id: "evt_1", type: "customer.subscription.deleted", data: { object: { id: "sub_1" } } });
    h.stripe.retrieve.mockResolvedValue({ id: "sub_1", customer: "cus_supprime", status: "canceled", items: { data: [] }, metadata: {} });
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    const r = await webhook(post("/api/stripe/webhook", "{}", { "stripe-signature": "t=1,v1=x" }));
    expect(r.status).toBe(200);
    expect(await r.json()).toMatchObject({ received: true, ignored: true });
    expect(err).not.toHaveBeenCalled();
    expect(JSON.stringify(warn.mock.calls)).not.toMatch(/cus_|sub_|@/);
    expect(h.log.filter(([, op]) => op === "update")).toHaveLength(0);
    warn.mockRestore();
    err.mockRestore();
  });

  it("une signature invalide reste refusée", async () => {
    h.stripe.constructEvent.mockImplementation(() => { throw new Error("bad"); });
    expect((await webhook(post("/api/stripe/webhook", "{}", { "stripe-signature": "x" }))).status).toBe(400);
  });
});

describe("POST /api/legal/accept", () => {
  it("refuse sans connexion, avec une version périmée, ou pour les CGV", async () => {
    h.user = null;
    expect((await accept(post("/api/legal/accept", { documents: [{ document: "cgu", version: VERSIONS.cgu }] }))).status).toBe(401);
    h.user = { id: "u-a", email: "a@exemple.fr" };
    expect((await accept(post("/api/legal/accept", { documents: [{ document: "cgu", version: "1999-01-01" }] }))).status).toBe(409);
    expect((await accept(post("/api/legal/accept", { documents: [{ document: "cgv", version: VERSIONS.cgv }] }))).status).toBe(400);
    expect((await accept(post("/api/legal/accept", "pas du json"))).status).toBe(400);
    expect(h.log.filter(([, op]) => op === "insert")).toHaveLength(0);
  });

  it("enregistre pour l'utilisateur de la session, jamais celui du corps de la requête", async () => {
    const r = await accept(post("/api/legal/accept", { user_id: "u-pirate", documents: [{ document: "cgu", version: VERSIONS.cgu }, { document: "confidentialite", version: VERSIONS.confidentialite }] }));
    expect(r.status).toBe(200);
    const rows = h.log.find(([t, op]) => t === "legal_acceptances" && op === "insert")![2] as { user_id: string; contexte: string }[];
    expect(rows).toHaveLength(2);
    expect(rows.every((x) => x.user_id === "u-a" && x.contexte === "inscription")).toBe(true);
  });

  it("une base qui refuse l'écriture ne produit pas de fausse confirmation", async () => {
    h.failInsert = true;
    const r = await accept(post("/api/legal/accept", { documents: [{ document: "cgu", version: VERSIONS.cgu }] }));
    expect(r.status).toBe(500);
    expect((await r.json()).ok).toBeUndefined();
  });
});

describe("GET /api/account/export", () => {
  it("refuse sans connexion", async () => {
    h.user = null;
    expect((await exportAccount()).status).toBe(401);
  });

  it("renvoie les données du compte sans secret Stripe", async () => {
    h.rows = {
      profiles: [{ plan: "solo", favorites: ["i1"], subscription_status: "active", created_at: "2026-01-01", updated_at: "2026-02-01", stripe_customer_id: "cus_SECRET", stripe_subscription_id: "sub_SECRET" }],
      projects: [{ id: "proja1", data: { x: 1 }, updated_at: "2026-02-01", user_id: "u-a" }],
      sites: [{ slug: "mon-site", user_id: "u-a", project_id: "proja1", data: {}, published_at: "2026-02-01", updated_at: "2026-02-01" }],
      legal_acceptances: [{ document: "cgu", version: "2026-10-29", accepted_at: "2026-10-29", contexte: "inscription", renonciation_retractation: false, formule: null, user_id: "u-a" }],
    };
    const r = await exportAccount();
    expect(r.status).toBe(200);
    expect(r.headers.get("content-disposition")).toMatch(/attachment/);
    expect(r.headers.get("cache-control")).toBe("no-store");
    const text = await r.text();
    expect(text).not.toMatch(/SECRET|cus_|sub_/);
    const j = JSON.parse(text);
    expect(j.compte).toMatchObject({ id: "u-a", email: "a@exemple.fr" });
    expect(j.profil).toMatchObject({ plan: "solo", favorites: ["i1"] });
    expect(j.projets).toHaveLength(1);
    expect(j.sites_publies[0]).toMatchObject({ slug: "mon-site" });
    expect(j.sites_publies[0]).not.toHaveProperty("user_id");
    expect(j.acceptations_des_conditions).toHaveLength(1);
  });
});

describe("POST /api/sites : écritures par le serveur", () => {
  it("refuse une période piégée et n'écrit rien", async () => {
    h.rows = { profiles: [{ plan: "pro" }], sites: [] };
    const p = newProject("crm");
    const d = siteData(p);
    const bad = { ...d, pricing: { ...(d.pricing ?? { modele: "abonnement", calc: { clients: 1, fraisPct: 0, fraisFixe: 0, hebergement: 0, autres: 0 } }), offres: [{ id: "a", nom: "Pro", prix: 9, periode: "</small><script>alert(1)</script>", features: [] }] } };
    const r = await publish(post("/api/sites", { projectId: "proja1", slug: "mon-site", data: bad }));
    expect(r.status).toBe(400);
    expect(h.log.filter(([, op]) => op === "insert" || op === "update")).toHaveLength(0);
  });

  it("publie un site valide (formule payante) via le client serveur", async () => {
    h.rows = { profiles: [{ plan: "pro" }], sites: [] };
    const r = await publish(post("/api/sites", { projectId: "proja1", slug: "mon-site", data: siteData(newProject("crm")) }));
    expect(r.status).toBe(200);
    expect(h.log.filter(([t, op]) => t === "sites" && op === "insert")).toHaveLength(1);
  });

  it("refuse la mise en ligne en formule gratuite (y compris la mise à jour d'un ancien site)", async () => {
    h.rows = { profiles: [{ plan: "gratuit" }], sites: [{ slug: "ancien", project_id: "proja1" }] };
    const r = await publish(post("/api/sites", { projectId: "proja1", slug: "ancien", data: siteData(newProject("crm")) }));
    expect(r.status).toBe(403);
    expect(h.log.filter(([, op]) => op === "insert" || op === "update")).toHaveLength(0);
  });
});
