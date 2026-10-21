import { describe, expect, it } from "vitest";
import { planFromSubscription, subscriptionIdOf } from "@/lib/billing";
import { mergeProjects } from "@/lib/cloud";
import { defaultConfig, validateConfig } from "@/lib/config";
import { buildGuide, envTemplate, schemaSql } from "@/lib/guide";
import { buildLanding, renderLanding } from "@/lib/landing";
import { logoSvg } from "@/lib/logo";
import { newProject } from "@/lib/project";
import { prototypeData, renderPrototype } from "@/lib/prototype";
import { siteData, slugError, suggestSlug, validateSiteData } from "@/lib/publish";
import { defaultPricing } from "@/lib/pricing";

describe("publication", () => {
  it("valide les adresses de site", () => {
    expect(slugError("mon-saas")).toBeNull();
    expect(slugError("ab")).not.toBeNull();
    expect(slugError("-mauvais")).not.toBeNull();
    expect(slugError("Majuscules")).not.toBeNull();
    expect(slugError("admin")).toMatch(/réservée/);
    expect(suggestSlug("Rendez-vous Salon !")).toBe("rendez-vous-salon");
  });

  it("accepte les données d'un vrai projet", () => {
    const p = newProject("crm");
    expect(validateSiteData(siteData(p)).ok).toBe(true);
  });

  it("refuse des données trafiquées", () => {
    const p = newProject("crm");
    const bad = (patch: object) => validateSiteData({ ...siteData(p), ...patch }).ok;
    expect(bad({ config: { ...p.config, style: "<script>" } })).toBe(false);
    expect(bad({ config: { ...p.config, couleurs: { primaire: "red;}</style><script>", accent: "#000000" } } })).toBe(false);
    expect(bad({ landing: { ...p.landing, layout: "pirate" } })).toBe(false);
    expect(bad({ landing: { ...p.landing, sections: [{ ...p.landing.sections[0]!, titre: "x".repeat(5000) }] } })).toBe(false);
    expect(validateSiteData(null).ok).toBe(false);
  });

  it("génère un vrai formulaire de liste d'attente sur le site publié, et un aperçu inoffensif sinon", () => {
    const cfg = defaultConfig("liste-attente");
    const l = buildLanding(cfg);
    const live = renderLanding(cfg, l, null, { inlineCss: true, waitlist: { action: "/api/waitlist/mon-saas", merci: true } });
    expect(live).toContain('action="/api/waitlist/mon-saas"');
    expect(live).toContain('name="site"'); // champ piège anti-robots
    expect(live).toContain("Merci");
    const preview = renderLanding(cfg, l, null, { inlineCss: true, waitlist: { action: null } });
    expect(preview).not.toContain("action=");
    expect(renderLanding(cfg, l, null, { inlineCss: true })).not.toContain('class="wl"');
  });
});

describe("guide de mise en production", () => {
  it("s'adapte au modèle de revenus", () => {
    const free = defaultConfig("liste-attente");
    const paid = defaultConfig("abonnement");
    const ids = (c: ReturnType<typeof defaultConfig>) => buildGuide(c, defaultPricing(c)).map((s) => s.id);
    expect(ids(free)).not.toContain("stripe");
    expect(ids(paid)).toEqual(expect.arrayContaining(["stripe", "live", "auth"]));
  });

  it("génère le SQL des tables du projet avec des règles d'accès", () => {
    const sql = schemaSql(defaultConfig("crm"));
    expect(sql).toContain("create table public.contacts");
    expect(sql).toContain("entreprise text");
    expect(sql).toContain("enable row level security");
    expect(sql).toContain("auth.uid() = user_id");
  });

  it("liste une variable Stripe par offre payante", () => {
    const cfg = defaultConfig("abonnement");
    const env = envTemplate(cfg, defaultPricing(cfg));
    expect(env).toContain("STRIPE_PRICE_PRO=");
    expect(env).toContain("STRIPE_PRICE_EQUIPE=");
    expect(env).not.toContain("STRIPE_PRICE_GRATUIT");
  });
});

describe("abonnement Décollage", () => {
  const prices = { solo: "price_solo", pro: "price_pro", illimite: "price_illimite" };

  it("donne la formule correspondant au prix payé", () => {
    expect(planFromSubscription("active", "price_solo", prices)).toBe("solo");
    expect(planFromSubscription("trialing", "price_pro", prices)).toBe("pro");
    expect(planFromSubscription("past_due", "price_illimite", prices)).toBe("illimite");
  });

  it("retire l'accès seulement quand l'abonnement n'est plus actif", () => {
    expect(planFromSubscription("canceled", "price_pro", prices)).toBe("gratuit");
    expect(planFromSubscription("incomplete_expired", "price_solo", prices)).toBe("gratuit");
    expect(planFromSubscription(null, null, prices)).toBe("gratuit");
    // Prix inconnu sur un abonnement actif : on ne pénalise jamais un client qui paie.
    expect(planFromSubscription("active", "price_ancien", prices)).toBe("illimite");
  });

  it("retrouve l'abonnement concerné par un événement", () => {
    expect(subscriptionIdOf({ type: "customer.subscription.updated", data: { object: { id: "sub_1" } } })).toBe("sub_1");
    expect(subscriptionIdOf({ type: "checkout.session.completed", data: { object: { mode: "subscription", subscription: "sub_2" } } })).toBe("sub_2");
    expect(subscriptionIdOf({ type: "checkout.session.completed", data: { object: { mode: "payment" } } })).toBeNull();
  });
});

describe("synchronisation", () => {
  it("garde la version la plus récente de chaque projet", () => {
    const a = { ...newProject("crm"), updatedAt: "2026-10-10T10:00:00.000Z" };
    const aRemoteNewer = { ...a, updatedAt: "2026-10-12T10:00:00.000Z", config: { ...a.config, nom: "Distant" } };
    const b = newProject("taches");
    const { merged, toPush } = mergeProjects([a, b], [aRemoteNewer]);
    expect(merged.find((p) => p.id === a.id)!.config.nom).toBe("Distant");
    expect(toPush.map((p) => p.id)).toEqual([b.id]);
  });
});

describe("thèmes et logo", () => {
  it("accepte les nouveaux styles et polices, et refuse l'inconnu", () => {
    for (const style of ["neon", "pastel", "luxe"] as const) expect(validateConfig({ ...defaultConfig("crm"), style, police: "arrondie" })).toEqual({});
    expect(validateConfig({ ...defaultConfig("crm"), police: "comic" as never }).police).toBeDefined();
  });

  it("génère un logo SVG valide et sûr", () => {
    const logo = logoSvg("<b>", "#2f5bff", "#ff6b4a", "hexagone");
    expect(logo.startsWith("data:image/svg+xml")).toBe(true);
    expect(decodeURIComponent(logo)).not.toContain("<b>");
    expect(validateConfig({ ...defaultConfig("crm"), logo }).logo).toBeUndefined();
  });

  it("charge la police choisie dans le prototype et la landing", () => {
    const cfg = { ...defaultConfig("crm"), police: "arrondie" as const, style: "pastel" as const };
    expect(renderPrototype(cfg)).toContain("family=Nunito");
    expect(renderLanding(cfg, buildLanding(cfg), null, { inlineCss: true })).toContain("family=Nunito");
  });

  it("embarque les nouvelles pages des modèles", () => {
    expect(prototypeData(defaultConfig("annuaire")).pages.map((p) => p.kind)).toContain("carte");
    // Types à architecture dédiée : leurs écrans propres remplacent les pages génériques.
    expect(prototypeData(defaultConfig("boutique")).pages.map((p) => p.kind)).toEqual(expect.arrayContaining(["co-products", "co-orders", "co-sales"]));
    expect(prototypeData(defaultConfig("tickets")).pages.map((p) => p.kind)).toEqual(expect.arrayContaining(["crm-split", "crm-pipeline"]));
  });
});
