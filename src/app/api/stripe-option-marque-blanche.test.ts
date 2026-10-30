import { beforeEach, describe, expect, it, vi } from "vitest";

// Option marque blanche Solo + les 4 tarifs Stripe : paiement, webhook, ajout/retrait, droits. Supabase et Stripe sont SIMULÉS
// (base en mémoire avec état) : aucun appel réseau, aucun vrai paiement, aucune vraie base. Le comportement SQL réel (limites,
// déclencheurs) est testé dans stripe-e2e-pglite.test.ts avec PGlite. Rien ici ne prouve le comportement réel de Stripe.
const P = {
  solo: "price_1UTOYlQl0aNnS3rPqmzoTBfH",
  brand: "price_1UWIsqQl0aNnS3rPe6swbnSW",
  pro: "price_1UTOZXQl0aNnS3rPwL7z8Gb5",
  illimite: "price_1UTOagQl0aNnS3rP9q3LLjc0",
  proLegacy: "price_ANCIEN_PRO_9_99",
};
const h = vi.hoisted(() => ({
  user: { id: "u-a", email: "a@exemple.fr" } as { id: string; email: string } | null,
  db: {} as Record<string, Record<string, unknown>[]>,
  errors: {} as Record<string, { code?: string; message?: string } | null>,
  log: [] as [string, string, unknown][],
  brandPrice: "price_1UWIsqQl0aNnS3rPe6swbnSW" as string | undefined,
  stripe: { retrieve: vi.fn(), constructEvent: vi.fn(), list: vi.fn(), sessionsCreate: vi.fn(), customersCreate: vi.fn(), update: vi.fn(), itemDel: vi.fn() },
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/env", () => ({
  isCloudConfigured: () => true,
  isPaymentConfigured: () => true,
  stripePrices: () => ({ solo: "price_1UTOYlQl0aNnS3rPqmzoTBfH", pro: "price_1UTOZXQl0aNnS3rPwL7z8Gb5", illimite: "price_1UTOagQl0aNnS3rP9q3LLjc0" }),
  stripeBrandPrice: () => h.brandPrice,
  stripeLegacyPrices: () => ({ pro: ["price_ANCIEN_PRO_9_99"] }),
  stripeWebhookSecret: () => "whsec_test",
  appUrl: () => "https://app.test",
}));
vi.mock("@/lib/stripe", () => ({
  getStripe: () => ({
    subscriptions: { retrieve: h.stripe.retrieve, list: h.stripe.list, update: h.stripe.update },
    subscriptionItems: { del: h.stripe.itemDel },
    webhooks: { constructEvent: h.stripe.constructEvent },
    checkout: { sessions: { create: h.stripe.sessionsCreate } },
    customers: { create: h.stripe.customersCreate },
  }),
}));

type Row = Record<string, unknown>;
function fakeTable(name: string) {
  let op = "select";
  let vals: unknown;
  const eqs: [string, unknown][] = [];
  const ins: [string, unknown[]][] = [];
  const q: Record<string, unknown> = {};
  const self = () => q;
  q.select = self; q.order = self; q.limit = self;
  q.eq = (c: string, v: unknown) => { eqs.push([c, v]); return q; };
  q.is = q.eq;
  q.in = (c: string, v: unknown[]) => { ins.push([c, v]); return q; };
  for (const m of ["update", "insert", "upsert", "delete"]) q[m] = (v: unknown) => { op = m; vals = v; h.log.push([name, m, v]); return q; };
  const table = () => (h.db[name] ??= []);
  const match = (r: Row) => eqs.every(([c, v]) => r[c] === v) && ins.every(([c, v]) => v.includes(r[c]));
  const run = (): { data: Row[] | null; error: { code?: string; message?: string } | null } => {
    const error = h.errors[op === "select" ? name : `${name}:write`] ?? null;
    if (error) return { data: null, error };
    if (op === "insert") table().push(...(Array.isArray(vals) ? (vals as Row[]) : [vals as Row]).map((r) => ({ ...r })));
    else if (op === "upsert") { const r = vals as Row; const i = table().findIndex((x) => x.id === r.id); if (i >= 0) Object.assign(table()[i]!, r); else table().push({ ...r }); }
    else if (op === "update") table().filter(match).forEach((r) => Object.assign(r, vals as Row));
    else if (op === "delete") h.db[name] = table().filter((r) => !match(r));
    return { data: table().filter(match), error: null };
  };
  q.maybeSingle = () => { const r = run(); return Promise.resolve({ data: r.data?.[0] ?? null, error: r.error }); };
  q.single = q.maybeSingle;
  q.then = (ok: (v: unknown) => unknown) => ok(run());
  return q;
}
const client = () => ({ from: (t: string) => fakeTable(t) });
vi.mock("@/lib/supabase/server", () => ({ getUser: async () => ({ supabase: client(), user: h.user }), createAdminClient: () => client(), createPublicClient: () => client() }));

import { VERSIONS } from "@/data/legal";
import { GET as optionGet, POST as optionPost } from "@/app/api/stripe/option/route";
import { POST as checkout } from "@/app/api/stripe/checkout/route";
import { POST as webhook } from "@/app/api/stripe/webhook/route";
import { analyzeSubscription, brandEntitlementAction, buildCheckoutLines, brandItemsToDrop, brandRightWanted } from "@/lib/billing";
import { BRAND_OPTION_PRIX, brandOptionTotalSolo, PLANS, whiteLabelAllowed } from "@/lib/plans";
import { decideWhiteLabel } from "@/lib/brand/decision";

const APP = "https://app.test";
const post = (path: string, body?: unknown, headers: Record<string, string> = {}) =>
  new Request(`${APP}${path}`, { method: "POST", headers: { "content-type": "application/json", origin: APP, ...headers }, body: body === undefined ? undefined : JSON.stringify(body) });
const CONSENT = { acceptCgv: true, renonciation: true, cgvVersion: VERSIONS.cgv };
const buy = (plan: string, extra: Record<string, unknown> = {}) => checkout(post("/api/stripe/checkout", { plan, ...CONSENT, ...extra }));
const opt = (action: string, extra: Record<string, unknown> = {}) => optionPost(post("/api/stripe/option", { action, ...(action === "add" ? CONSENT : {}), ...extra }));
const writes = (table: string) => h.log.filter(([t, o]) => t === table && ["insert", "update", "upsert", "delete"].includes(o));

const item = (price: string) => ({ id: `si_${price}`, price: { id: price } });
const sub = (status: string, prices: string[], extra: Record<string, unknown> = {}) => ({ id: "sub_1", customer: "cus_1", status, metadata: { user_id: "u-a" }, items: { data: prices.map(item) }, ...extra });
const SOLO = [P.solo], SOLO_OPT = [P.solo, P.brand];

function profile(over: Row = {}) {
  return { id: "u-a", plan: "gratuit", stripe_customer_id: "cus_1", stripe_subscription_id: null, subscription_status: null, ...over };
}
const ent = () => h.db.brand_entitlements![0] as { enabled: boolean; source: string } | undefined;
const planNow = () => h.db.profiles![0]!.plan;

/** Rejoue un événement Stripe : l'abonnement lu chez Stripe est `s`. */
async function event(s: ReturnType<typeof sub>, type = "customer.subscription.updated") {
  h.stripe.retrieve.mockResolvedValue(s);
  h.stripe.constructEvent.mockReturnValue({ id: "evt_1", type, data: { object: { id: s.id } } });
  return webhook(new Request(`${APP}/api/stripe/webhook`, { method: "POST", headers: { "stripe-signature": "t=1,v1=x" }, body: "{}" }));
}

beforeEach(() => {
  h.user = { id: "u-a", email: "a@exemple.fr" };
  h.db = { profiles: [profile()], sites: [], boutiques: [], brand_entitlements: [], legal_acceptances: [] };
  h.errors = {};
  h.log = [];
  h.brandPrice = P.brand;
  Object.values(h.stripe).forEach((f) => f.mockReset());
  h.stripe.list.mockResolvedValue({ data: [], has_more: false });
  h.stripe.sessionsCreate.mockResolvedValue({ url: "https://checkout.stripe.test/s" });
  h.stripe.customersCreate.mockResolvedValue({ id: "cus_1" });
  h.stripe.update.mockResolvedValue({});
  h.stripe.itemDel.mockResolvedValue({});
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
});

describe("les 4 tarifs : table de configuration", () => {
  const prices = { solo: P.solo, pro: P.pro, illimite: P.illimite };
  it("montants affichés = montants attendus (centimes) : 299 / 499 / 1299 / 2999, total Solo + option 798", () => {
    expect(Math.round(PLANS.solo.prix * 100)).toBe(299);
    expect(Math.round(BRAND_OPTION_PRIX * 100)).toBe(499);
    expect(Math.round(PLANS.pro.prix * 100)).toBe(1299);
    expect(Math.round(PLANS.illimite.prix * 100)).toBe(2999);
    expect(Math.round(brandOptionTotalSolo() * 100)).toBe(798);
  });
  it("chaque identifiant donne la bonne formule ; l'option donne l'option et aucune formule", () => {
    const a = (ids: string[]) => analyzeSubscription("active", ids, prices, P.brand, { pro: [P.proLegacy] });
    expect(a([P.solo])).toMatchObject({ plan: "solo", brandOption: false });
    expect(a([P.pro])).toMatchObject({ plan: "pro", brandOption: false });
    expect(a([P.illimite])).toMatchObject({ plan: "illimite", brandOption: false });
    expect(a([P.solo, P.brand])).toMatchObject({ plan: "solo", brandOption: true, unknownPrices: [] });
    expect(a([P.brand])).toMatchObject({ plan: null, brandOption: true });
  });
  it("prix inconnu = rien (jamais une formule supérieure) ; ancien prix Pro = Pro", () => {
    const a = (ids: string[]) => analyzeSubscription("active", ids, prices, P.brand, { pro: [P.proLegacy] });
    expect(a(["price_inconnu"])).toMatchObject({ plan: null, brandOption: false, unknownPrices: ["price_inconnu"] });
    expect(a([P.solo, "price_inconnu"])).toMatchObject({ plan: "solo", unknownPrices: ["price_inconnu"] });
    expect(a([P.proLegacy])).toMatchObject({ plan: "pro" });
  });
  it("variable d'option absente : la ligne option devient un prix inconnu (aucun droit)", () => {
    expect(analyzeSubscription("active", [P.solo, P.brand], prices, undefined)).toMatchObject({ plan: "solo", brandOption: false, unknownPrices: [P.brand] });
  });
});

describe("paiement : lignes envoyées à Stripe", () => {
  it("Solo seul : une ligne, le prix Solo à 2,99 €", async () => {
    const r = await buy("solo");
    expect(r.status).toBe(200);
    expect(h.stripe.sessionsCreate.mock.calls[0]![0].line_items).toEqual([{ price: P.solo, quantity: 1 }]);
    expect(h.stripe.sessionsCreate.mock.calls[0]![0].mode).toBe("subscription");
  });
  it("Solo + option : DEUX lignes dans UNE session d'abonnement (Solo puis option)", async () => {
    const r = await buy("solo", { brandOption: true });
    expect(r.status).toBe(200);
    expect(h.stripe.sessionsCreate).toHaveBeenCalledTimes(1);
    expect(h.stripe.sessionsCreate.mock.calls[0]![0].line_items).toEqual([{ price: P.solo, quantity: 1 }, { price: P.brand, quantity: 1 }]);
  });
  it.each([["pro", P.pro], ["illimite", P.illimite]])("%s : une ligne, le prix de la formule", async (plan, price) => {
    expect((await buy(plan)).status).toBe(200);
    expect(h.stripe.sessionsCreate.mock.calls[0]![0].line_items).toEqual([{ price, quantity: 1 }]);
  });
  it.each(["pro", "illimite"])("%s + option : refusé 400, aucun paiement ouvert (déjà incluse)", async (plan) => {
    const r = await buy(plan, { brandOption: true });
    expect(r.status).toBe(400);
    expect(h.stripe.sessionsCreate).not.toHaveBeenCalled();
    expect(h.stripe.customersCreate).not.toHaveBeenCalled();
  });
  it.each([["true", "oui"], ["nombre", 1], ["liste (deux fois)", ["brand", "brand"]], ["objet", { n: 2 }]])("valeur d'option invalide (%s) : 400, aucun paiement", async (_n, v) => {
    expect((await buy("solo", { brandOption: v })).status).toBe(400);
    expect(h.stripe.sessionsCreate).not.toHaveBeenCalled();
  });
  it("brandOption false ou absent : Solo seul", async () => {
    await buy("solo", { brandOption: false });
    expect(h.stripe.sessionsCreate.mock.calls[0]![0].line_items).toHaveLength(1);
  });
  it("prix d'option non configuré : l'option est refusée (503), Solo seul reste possible", async () => {
    h.brandPrice = undefined;
    const r = await buy("solo", { brandOption: true });
    expect(r.status).toBe(503);
    expect(h.stripe.sessionsCreate).not.toHaveBeenCalled();
    expect((await buy("solo")).status).toBe(200);
  });
  it("prix d'option identique à un prix de formule (erreur de configuration) : refus", () => {
    const r = buildCheckoutLines("solo", true, { solo: "p1", pro: "p2", illimite: "p3" }, "p2");
    expect(r.ok).toBe(false);
  });
  it("clé d'idempotence : Solo et Solo+option ont des clés différentes ; deux clics identiques = même clé", async () => {
    await buy("solo"); await buy("solo"); await buy("solo", { brandOption: true }); await buy("solo", { brandOption: true });
    const k = h.stripe.sessionsCreate.mock.calls.map((a) => a[1].idempotencyKey as string);
    expect(k[0]).toBe(k[1]);
    expect(k[2]).toBe(k[3]);
    expect(k[0]).not.toBe(k[2]);
    expect(k[2]).toContain("+brand");
    expect(k[2]).toContain(P.brand);
  });
  it("la session porte l'option dans ses métadonnées, sans autre abonnement créé", async () => {
    await buy("solo", { brandOption: true });
    const arg = h.stripe.sessionsCreate.mock.calls[0]![0];
    expect(arg.subscription_data.metadata).toMatchObject({ user_id: "u-a", plan: "solo", brand_option: "1" });
  });
  it("abonnement existant : refus prudent même avec l'option, aucune session", async () => {
    h.db.profiles = [profile({ plan: "solo", stripe_subscription_id: "sub_1", subscription_status: "active" })];
    const r = await buy("solo", { brandOption: true });
    expect(r.status).toBe(409);
    expect(h.stripe.sessionsCreate).not.toHaveBeenCalled();
  });
  it("CGV non cochées : refus, même avec l'option", async () => {
    const r = await checkout(post("/api/stripe/checkout", { plan: "solo", brandOption: true, acceptCgv: false, renonciation: true, cgvVersion: VERSIONS.cgv }));
    expect(r.status).toBe(400);
    expect(h.stripe.sessionsCreate).not.toHaveBeenCalled();
  });
  it("preuve d'acceptation enregistrée pour la formule solo", async () => {
    await buy("solo", { brandOption: true });
    expect(writes("legal_acceptances")[0]![2]).toMatchObject([{ formule: "solo", document: "cgv", contexte: "achat" }]);
  });
});

describe("webhook : formule + droit marque blanche (scénarios de changement)", () => {
  it("Solo seul : formule solo, aucun droit marque blanche créé", async () => {
    expect((await event(sub("active", SOLO))).status).toBe(200);
    expect(planNow()).toBe("solo");
    expect(ent()).toBeUndefined();
    expect(h.stripe.itemDel).not.toHaveBeenCalled();
  });
  it("Solo -> Solo + option : droit activé, source 'stripe'", async () => {
    await event(sub("active", SOLO));
    await event(sub("active", SOLO_OPT));
    expect(planNow()).toBe("solo");
    expect(ent()).toMatchObject({ enabled: true, source: "stripe" });
    expect(decideWhiteLabel(planNow(), ent()?.enabled)).toBe(true);
  });
  it("Solo + option -> Solo : droit stripe désactivé, la mention redevient affichée", async () => {
    await event(sub("active", SOLO_OPT));
    await event(sub("active", SOLO));
    expect(planNow()).toBe("solo");
    expect(ent()).toMatchObject({ enabled: false, source: "stripe" });
    expect(decideWhiteLabel(planNow(), ent()?.enabled)).toBe(false);
  });
  it("rejeu du même événement : même résultat, une seule ligne de droit, aucune écriture de droit en trop", async () => {
    const s = sub("active", SOLO_OPT);
    await event(s); await event(s); await event(s);
    expect(h.db.brand_entitlements).toHaveLength(1);
    expect(ent()).toMatchObject({ enabled: true, source: "stripe" });
    expect(writes("brand_entitlements").filter(([, o]) => o === "insert")).toHaveLength(1);
    expect(writes("brand_entitlements").filter(([, o]) => o === "update")).toHaveLength(0);
  });
  it("rejeu après retrait : un seul 'disable', puis plus rien", async () => {
    await event(sub("active", SOLO_OPT));
    await event(sub("active", SOLO)); await event(sub("active", SOLO));
    expect(writes("brand_entitlements").filter(([, o]) => o === "update")).toHaveLength(1);
  });
  it("Solo + option -> Pro : plan pro, droit stripe désactivé (inclus par la formule), la ligne option est RETIRÉE de l'abonnement (pas de double facturation)", async () => {
    await event(sub("active", SOLO_OPT));
    await event(sub("active", [P.pro, P.brand]));
    expect(planNow()).toBe("pro");
    expect(ent()?.enabled).toBe(false);
    expect(whiteLabelAllowed("pro", false)).toBe(true);
    expect(decideWhiteLabel(planNow(), ent()?.enabled)).toBe(true); // droit par la formule
    expect(h.stripe.itemDel).toHaveBeenCalledTimes(1);
    expect(h.stripe.itemDel.mock.calls[0]![0]).toBe(`si_${P.brand}`);
    expect(h.stripe.itemDel.mock.calls[0]![1]).toEqual({ proration_behavior: "create_prorations" });
  });
  it("Solo + option -> Illimité : idem ; l'élément de la formule n'est JAMAIS retiré", async () => {
    await event(sub("active", [P.illimite, P.brand]));
    expect(planNow()).toBe("illimite");
    expect(h.stripe.itemDel.mock.calls.map((c) => c[0])).toEqual([`si_${P.brand}`]);
  });
  it("ancien prix Pro + option : Pro conservé, option retirée", async () => {
    await event(sub("active", [P.proLegacy, P.brand]));
    expect(planNow()).toBe("pro");
    expect(h.stripe.itemDel.mock.calls.map((c) => c[0])).toEqual([`si_${P.brand}`]);
  });
  it("Pro / Illimité sans option : rien à retirer, aucun droit stripe créé", async () => {
    await event(sub("active", [P.pro])); await event(sub("active", [P.illimite]));
    expect(h.stripe.itemDel).not.toHaveBeenCalled();
    expect(ent()).toBeUndefined();
  });
  it("Pro -> Solo : option absente par défaut, mention affichée", async () => {
    await event(sub("active", [P.pro]));
    await event(sub("active", SOLO));
    expect(planNow()).toBe("solo");
    expect(decideWhiteLabel(planNow(), ent()?.enabled)).toBe(false);
  });
  it("Solo+option -> Illimité -> Solo : retour sans option, droit stripe désactivé", async () => {
    await event(sub("active", SOLO_OPT));
    await event(sub("active", [P.illimite, P.brand]));
    await event(sub("active", SOLO));
    expect(planNow()).toBe("solo");
    expect(ent()).toMatchObject({ enabled: false, source: "stripe" });
    expect(decideWhiteLabel(planNow(), ent()?.enabled)).toBe(false);
  });
  it("Illimité -> Solo + option (nouvelle ligne option) : droit réactivé", async () => {
    await event(sub("active", [P.illimite]));
    await event(sub("active", SOLO_OPT));
    expect(planNow()).toBe("solo");
    expect(ent()).toMatchObject({ enabled: true, source: "stripe" });
  });
  it("droit réactivé après un retrait (ligne stripe désactivée -> activée)", async () => {
    await event(sub("active", SOLO_OPT)); await event(sub("active", SOLO)); await event(sub("active", SOLO_OPT));
    expect(ent()).toMatchObject({ enabled: true, source: "stripe" });
    expect(h.db.brand_entitlements).toHaveLength(1);
  });

  describe("statuts d'échec de paiement ou d'annulation", () => {
    it("past_due : accès gardé (formule et option), l'option n'est pas touchée chez Stripe", async () => {
      await event(sub("active", SOLO_OPT));
      await event(sub("past_due", SOLO_OPT));
      expect(planNow()).toBe("solo");
      expect(ent()?.enabled).toBe(true);
      await event(sub("past_due", [P.pro, P.brand]));
      expect(h.stripe.itemDel).not.toHaveBeenCalled(); // on ne modifie pas un abonnement en échec de paiement
    });
    it.each(["canceled", "unpaid", "paused", "incomplete_expired", "incomplete"])("%s : retour à Découverte et droit stripe désactivé", async (status) => {
      await event(sub("active", SOLO_OPT));
      await event(sub(status, SOLO_OPT), status === "canceled" ? "customer.subscription.deleted" : "customer.subscription.updated");
      expect(planNow()).toBe("gratuit");
      expect(ent()?.enabled).toBe(false);
      expect(decideWhiteLabel(planNow(), ent()?.enabled)).toBe(false);
      expect(h.stripe.itemDel).not.toHaveBeenCalled();
    });
    it("reprise après impayé (unpaid -> active) : formule et droit rétablis", async () => {
      await event(sub("active", SOLO_OPT)); await event(sub("unpaid", SOLO_OPT)); await event(sub("active", SOLO_OPT));
      expect(planNow()).toBe("solo");
      expect(ent()?.enabled).toBe(true);
    });
  });

  describe("un droit accordé à la main n'est jamais touché", () => {
    const manual = (enabled: boolean) => { h.db.brand_entitlements = [{ user_id: "u-a", enabled, source: "manuel" }]; };
    it.each([
      ["Solo sans option", sub("active", SOLO)],
      ["Solo + option", sub("active", SOLO_OPT)],
      ["Pro", sub("active", [P.pro])],
      ["annulé", sub("canceled", SOLO_OPT)],
      ["impayé", sub("unpaid", SOLO_OPT)],
    ])("droit manuel activé conservé : %s", async (_n, s) => {
      manual(true);
      expect((await event(s)).status).toBe(200);
      expect(ent()).toEqual({ user_id: "u-a", enabled: true, source: "manuel" });
      expect(writes("brand_entitlements")).toHaveLength(0);
    });
    it("droit manuel désactivé + option payée : non modifié, signalé dans les journaux", async () => {
      manual(false);
      await event(sub("active", SOLO_OPT));
      expect(ent()).toEqual({ user_id: "u-a", enabled: false, source: "manuel" });
      expect(writes("brand_entitlements")).toHaveLength(0);
      expect(console.error).toHaveBeenCalledWith(expect.stringContaining("« manuel »"));
    });
  });

  describe("éléments inconnus", () => {
    it("Solo + prix inconnu : Solo, rien d'autre accordé", async () => {
      await event(sub("active", [P.solo, "price_inconnu"]));
      expect(planNow()).toBe("solo");
      expect(ent()).toBeUndefined();
    });
    it("Solo + option + prix inconnu : l'option reste reconnue, l'inconnu n'accorde rien", async () => {
      await event(sub("active", [P.solo, P.brand, "price_inconnu"]));
      expect(planNow()).toBe("solo");
      expect(ent()?.enabled).toBe(true);
    });
    it("option seule ou prix inconnu seul sur un nouvel abonnement : Découverte, aucun droit", async () => {
      await event(sub("active", [P.brand]));
      expect(planNow()).toBe("gratuit");
      expect(ent()).toBeUndefined();
      await event(sub("active", ["price_inconnu"]));
      expect(planNow()).toBe("gratuit");
    });
    it("Pro + prix inconnu : Pro, l'inconnu n'est pas retiré", async () => {
      await event(sub("active", [P.pro, "price_inconnu"]));
      expect(planNow()).toBe("pro");
      expect(h.stripe.itemDel).not.toHaveBeenCalled();
    });
  });

  describe("pannes : erreur 5xx pour que Stripe rejoue, jamais un faux succès", () => {
    it("lecture du profil impossible : 500", async () => {
      h.errors.profiles = { message: "panne" };
      expect((await event(sub("active", SOLO_OPT))).status).toBe(500);
    });
    it("écriture du profil impossible : 500, aucun droit accordé", async () => {
      h.errors["profiles:write"] = { message: "panne" };
      expect((await event(sub("active", SOLO_OPT))).status).toBe(500);
      expect(ent()).toBeUndefined();
    });
    it("lecture du droit impossible : 500", async () => {
      h.errors.brand_entitlements = { message: "panne", code: "08006" };
      expect((await event(sub("active", SOLO_OPT))).status).toBe(500);
    });
    it("écriture du droit impossible : 500 ; le rejeu réussit ensuite", async () => {
      h.errors["brand_entitlements:write"] = { message: "panne", code: "08006" };
      expect((await event(sub("active", SOLO_OPT))).status).toBe(500);
      h.errors = {};
      expect((await event(sub("active", SOLO_OPT))).status).toBe(200);
      expect(ent()).toMatchObject({ enabled: true, source: "stripe" });
    });
    it("retrait du droit impossible : 500", async () => {
      await event(sub("active", SOLO_OPT));
      h.errors["brand_entitlements:write"] = { message: "panne", code: "08006" };
      expect((await event(sub("active", SOLO))).status).toBe(500);
    });
    it("migration 0006 absente (colonne source manquante) : 200, formule appliquée, droit non accordé, journalisé", async () => {
      h.errors.brand_entitlements = { message: 'column "source" does not exist', code: "42703" };
      expect((await event(sub("active", SOLO_OPT))).status).toBe(200);
      expect(planNow()).toBe("solo");
      expect(ent()).toBeUndefined();
      expect(decideWhiteLabel(planNow(), undefined)).toBe(false);
    });
    it("lecture de l'abonnement chez Stripe impossible : 500", async () => {
      h.stripe.retrieve.mockRejectedValue(new Error("réseau"));
      h.stripe.constructEvent.mockReturnValue({ id: "e", type: "customer.subscription.updated", data: { object: { id: "sub_1" } } });
      const r = await webhook(new Request(`${APP}/api/stripe/webhook`, { method: "POST", headers: { "stripe-signature": "x" }, body: "{}" }));
      expect(r.status).toBe(500);
    });
    it("retrait de la ligne option impossible chez Stripe : 500 (rejeu), puis succès au rejeu", async () => {
      h.stripe.itemDel.mockRejectedValueOnce(new Error("Stripe indisponible"));
      expect((await event(sub("active", [P.pro, P.brand]))).status).toBe(500);
      expect((await event(sub("active", [P.pro, P.brand]))).status).toBe(200);
      expect(h.stripe.itemDel).toHaveBeenCalledTimes(2);
      expect(h.stripe.itemDel.mock.calls[0]![2]).toEqual(h.stripe.itemDel.mock.calls[1]![2]); // même clé d'idempotence
    });
    it("rejeu après retrait réussi : l'abonnement relu n'a plus la ligne, rien n'est retiré", async () => {
      await event(sub("active", [P.pro, P.brand]));
      h.stripe.itemDel.mockClear();
      await event(sub("active", [P.pro]));
      expect(h.stripe.itemDel).not.toHaveBeenCalled();
    });
  });
});

describe("fonctions pures de décision", () => {
  it("brandEntitlementAction : table de vérité", () => {
    expect(brandEntitlementAction(true, null)).toEqual({ action: "insert" });
    expect(brandEntitlementAction(true, { enabled: false, source: "stripe" })).toEqual({ action: "enable" });
    expect(brandEntitlementAction(true, { enabled: true, source: "stripe" })).toEqual({ action: "none" });
    expect(brandEntitlementAction(true, { enabled: true, source: "manuel" })).toEqual({ action: "none", manualConflict: false });
    expect(brandEntitlementAction(true, { enabled: false, source: "manuel" })).toEqual({ action: "none", manualConflict: true });
    expect(brandEntitlementAction(false, null)).toEqual({ action: "none" });
    expect(brandEntitlementAction(false, { enabled: true, source: "stripe" })).toEqual({ action: "disable" });
    expect(brandEntitlementAction(false, { enabled: false, source: "stripe" })).toEqual({ action: "none" });
    expect(brandEntitlementAction(false, { enabled: true, source: "manuel" })).toEqual({ action: "none" });
    expect(brandEntitlementAction(false, { enabled: true, source: null })).toEqual({ action: "none" });
  });
  it("brandRightWanted : seulement Solo + option + abonnement actif (past_due compris)", () => {
    const a = (ids: string[], status = "active") => analyzeSubscription(status, ids, { solo: P.solo, pro: P.pro, illimite: P.illimite }, P.brand);
    expect(brandRightWanted("active", "solo", a(SOLO_OPT))).toBe(true);
    expect(brandRightWanted("past_due", "solo", a(SOLO_OPT, "past_due"))).toBe(true);
    expect(brandRightWanted("active", "solo", a(SOLO))).toBe(false);
    expect(brandRightWanted("active", "pro", a([P.pro, P.brand]))).toBe(false);
    expect(brandRightWanted("canceled", "solo", a(SOLO_OPT, "canceled"))).toBe(false);
    expect(brandRightWanted("unpaid", "solo", a(SOLO_OPT, "unpaid"))).toBe(false);
  });
  it("brandItemsToDrop : jamais sans formule Pro/Illimité reconnue, jamais hors statut actif/trialing", () => {
    const prices = { solo: P.solo, pro: P.pro, illimite: P.illimite };
    const items = (ids: string[]) => ids.map(item);
    const drop = (status: string, ids: string[]) => brandItemsToDrop(status, analyzeSubscription(status, ids, prices, P.brand), items(ids), P.brand);
    expect(drop("active", [P.pro, P.brand])).toEqual([`si_${P.brand}`]);
    expect(drop("trialing", [P.illimite, P.brand])).toEqual([`si_${P.brand}`]);
    expect(drop("active", SOLO_OPT)).toEqual([]);
    expect(drop("active", [P.brand])).toEqual([]);
    expect(drop("past_due", [P.pro, P.brand])).toEqual([]);
    expect(drop("unpaid", [P.pro, P.brand])).toEqual([]);
    expect(brandItemsToDrop("active", analyzeSubscription("active", [P.pro, P.brand], prices, P.brand), items([P.pro, P.brand]), undefined)).toEqual([]);
  });
});

describe("ajout / retrait de l'option sur un abonnement Solo existant", () => {
  const solo = (status = "active") => { h.db.profiles = [profile({ plan: "solo", stripe_subscription_id: "sub_1", subscription_status: status })]; };

  it("ajout : modifie le MÊME abonnement (une ligne option), facturée tout de suite, refusée si le paiement échoue ; n'écrit pas le droit", async () => {
    solo(); h.stripe.retrieve.mockResolvedValue(sub("active", SOLO));
    const r = await opt("add");
    expect(r.status).toBe(200);
    expect(h.stripe.update).toHaveBeenCalledTimes(1);
    const [id, params, o] = h.stripe.update.mock.calls[0]!;
    expect(id).toBe("sub_1");
    expect(params).toEqual({ items: [{ price: P.brand, quantity: 1 }], proration_behavior: "always_invoice", payment_behavior: "error_if_incomplete" });
    expect(o.idempotencyKey).toContain("decollage-option-add-sub_1-");
    expect(h.stripe.sessionsCreate).not.toHaveBeenCalled();
    expect(writes("brand_entitlements")).toHaveLength(0); // le droit n'est écrit que par le webhook
    expect(writes("legal_acceptances")).toHaveLength(1);
  });
  it("ajout idempotent : option déjà présente = succès sans modification", async () => {
    solo(); h.stripe.retrieve.mockResolvedValue(sub("active", SOLO_OPT));
    const r = await opt("add");
    expect(await r.json()).toEqual({ ok: true, already: true });
    expect(h.stripe.update).not.toHaveBeenCalled();
  });
  it("retrait : supprime seulement la ligne option, crédit au prorata ; la formule reste", async () => {
    solo(); h.stripe.retrieve.mockResolvedValue(sub("active", SOLO_OPT));
    expect((await opt("remove")).status).toBe(200);
    expect(h.stripe.itemDel).toHaveBeenCalledWith(`si_${P.brand}`, { proration_behavior: "create_prorations" }, { idempotencyKey: `decollage-option-remove-si_${P.brand}` });
    expect(h.stripe.itemDel).toHaveBeenCalledTimes(1);
  });
  it("retrait idempotent : option absente = succès sans rien faire", async () => {
    solo(); h.stripe.retrieve.mockResolvedValue(sub("active", SOLO));
    expect(await (await opt("remove")).json()).toEqual({ ok: true, already: true });
    expect(h.stripe.itemDel).not.toHaveBeenCalled();
  });
  it.each([["pro"], ["illimite"], ["gratuit"]])("formule %s en base : refus 409, Stripe non appelé", async (plan) => {
    h.db.profiles = [profile({ plan, stripe_subscription_id: plan === "gratuit" ? null : "sub_1", subscription_status: "active" })];
    expect((await opt("add")).status).toBe(409);
    expect(h.stripe.retrieve).not.toHaveBeenCalled();
    expect(h.stripe.update).not.toHaveBeenCalled();
  });
  it("base en retard : Stripe dit Pro alors que la base dit Solo -> refus, aucune modification", async () => {
    solo(); h.stripe.retrieve.mockResolvedValue(sub("active", [P.pro]));
    expect((await opt("add")).status).toBe(409);
    expect(h.stripe.update).not.toHaveBeenCalled();
  });
  it.each(["past_due", "unpaid", "paused", "canceled", "incomplete"])("abonnement %s chez Stripe : refus, aucune modification", async (status) => {
    solo(); h.stripe.retrieve.mockResolvedValue(sub(status, SOLO));
    expect((await opt("add")).status).toBe(409);
    expect((await opt("remove")).status).toBe(409);
    expect(h.stripe.update).not.toHaveBeenCalled();
    expect(h.stripe.itemDel).not.toHaveBeenCalled();
  });
  it("abonnement d'un autre client Stripe : refus", async () => {
    solo(); h.stripe.retrieve.mockResolvedValue(sub("active", SOLO, { customer: "cus_autre" }));
    expect((await opt("add")).status).toBe(409);
    expect(h.stripe.update).not.toHaveBeenCalled();
  });
  it("élément inconnu sur l'abonnement : on ne touche à rien", async () => {
    solo(); h.stripe.retrieve.mockResolvedValue(sub("active", [P.solo, "price_inconnu"]));
    expect((await opt("add")).status).toBe(409);
    expect(h.stripe.update).not.toHaveBeenCalled();
  });
  it("abonnement programmé pour se terminer : ajout refusé", async () => {
    solo(); h.stripe.retrieve.mockResolvedValue(sub("active", SOLO, { cancel_at_period_end: true }));
    expect((await opt("add")).status).toBe(409);
    expect(h.stripe.update).not.toHaveBeenCalled();
  });
  it("CGV non cochées : ajout refusé avant toute lecture ou modification", async () => {
    solo();
    const r = await optionPost(post("/api/stripe/option", { action: "add", acceptCgv: false, renonciation: true, cgvVersion: VERSIONS.cgv }));
    expect(r.status).toBe(400);
    expect(h.stripe.retrieve).not.toHaveBeenCalled();
    expect(h.stripe.update).not.toHaveBeenCalled();
  });
  it("preuve d'acceptation non enregistrée : ajout refusé (500), rien n'est modifié", async () => {
    solo(); h.stripe.retrieve.mockResolvedValue(sub("active", SOLO));
    h.errors["legal_acceptances:write"] = { message: "panne" };
    expect((await opt("add")).status).toBe(500);
    expect(h.stripe.update).not.toHaveBeenCalled();
  });
  it("paiement de l'option refusé par Stripe : erreur claire, pas de succès", async () => {
    solo(); h.stripe.retrieve.mockResolvedValue(sub("active", SOLO));
    h.stripe.update.mockRejectedValue(Object.assign(new Error("carte refusée"), { type: "StripeCardError", code: "card_declined" }));
    const r = await opt("add");
    expect(r.ok).toBe(false);
    expect((await r.json()).error).toMatch(/pas été modifiée/);
  });
  it("lecture de la base impossible : 503, rien de modifié", async () => {
    solo(); h.errors.profiles = { message: "panne" };
    expect((await opt("add")).status).toBe(503);
    expect(h.stripe.update).not.toHaveBeenCalled();
  });
  it("prix d'option non configuré : 503 ; action inconnue : 400 ; sans connexion : 401 ; origine étrangère : 403", async () => {
    solo();
    h.brandPrice = undefined;
    expect((await opt("add")).status).toBe(503);
    h.brandPrice = P.brand;
    expect((await opt("echanger")).status).toBe(400);
    expect((await optionPost(post("/api/stripe/option", { action: "remove" }, { origin: "https://evil.test" }))).status).toBe(403);
    h.user = null;
    expect((await opt("remove")).status).toBe(401);
  });
  it("GET : vendable seulement si le prix existe ; lit son propre droit", async () => {
    h.db.brand_entitlements = [{ user_id: "u-a", enabled: true, source: "stripe" }];
    expect(await (await optionGet()).json()).toEqual({ purchasable: true, enabled: true, source: "stripe" });
    h.brandPrice = undefined;
    expect((await (await optionGet()).json()).purchasable).toBe(false);
  });
});
