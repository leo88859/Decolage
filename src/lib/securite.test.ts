import { describe, expect, it } from "vitest";
import { cancelSubscriptionForDeletion } from "@/lib/account-deletion";
import { csvCell, waitlistCsv } from "@/lib/csv";
import { checkAcceptance, checkPurchaseConsent, currentVersion } from "@/lib/legal-acceptance";
import { buildLanding, renderLanding } from "@/lib/landing";
import { newProject } from "@/lib/project";
import { defaultPricing } from "@/lib/pricing";
import { PLANS, prixCourt } from "@/lib/plans";
import { siteData, validateSiteData } from "@/lib/publish";
import { safeNext } from "@/lib/safe-redirect";
import { splitSites } from "@/lib/site-lifecycle";
import type { Offer } from "@/lib/types";

// ─── C-1 : injection de code dans les pages publiées ─────────────────────
const PAYLOADS = [
  "</small><script>alert(document.cookie)</script>",
  '"><img src=x onerror=alert(1)>',
  "' onmouseover='alert(1)",
  "<svg/onload=alert(1)>",
  "javascript:alert(1)",
  "</style><script>alert(1)</script>",
];

/** Le seul script légitime d'une page est le nôtre (animations au défilement). */
const scripts = (html: string) => (html.match(/<script/gi) ?? []).length;
/** Aucune balise ou attribut fabriqué par une charge : les « < » et guillemets doivent être échappés. */
const dangerous = (html: string) => /<img src=x|<svg\/onload|<script>alert|onerror=alert\(1\)>|" onmouseover=|' onmouseover='/i.test(html);

function projectWith(offer: Partial<Omit<Offer, "periode">> & { periode: unknown }) {
  const p = newProject("crm");
  const pricing = defaultPricing(p.config);
  const o = { ...pricing.offres[0]!, ...offer } as Offer;
  return { p, offres: [o, ...pricing.offres.slice(1)] };
}

describe("C-1 : périodes d'offre (liste blanche)", () => {
  for (const payload of PAYLOADS) {
    it(`refuse la période « ${payload.slice(0, 30)} » à la publication`, () => {
      const { p, offres } = projectWith({ periode: payload });
      const pricing = { ...defaultPricing(p.config), offres };
      expect(validateSiteData({ ...siteData(p), pricing }).ok).toBe(false);
    });

    it(`n'insère jamais la période « ${payload.slice(0, 30)} » dans la page, même si des données anciennes la contiennent`, () => {
      const { p, offres } = projectWith({ periode: payload });
      const landing = buildLanding(p.config);
      const html = renderLanding(p.config, landing, { ...defaultPricing(p.config), offres }, { inlineCss: true });
      expect(html).not.toContain(payload);
      expect(dangerous(html)).toBe(false);
      expect(scripts(html)).toBe(1);
    });
  }

  it("accepte les trois périodes prévues", () => {
    for (const periode of ["mois", "an", "unique"] as const) {
      const { p, offres } = projectWith({ periode });
      expect(validateSiteData({ ...siteData(p), pricing: { ...defaultPricing(p.config), offres } }).ok).toBe(true);
    }
  });

  it("affiche chaque période correctement", () => {
    const html = (periode: Offer["periode"]) => {
      const { p, offres } = projectWith({ periode, prix: 12 });
      return renderLanding(p.config, buildLanding(p.config), { ...defaultPricing(p.config), offres }, { inlineCss: true });
    };
    expect(html("mois")).toContain("<small> / mois</small>");
    expect(html("an")).toContain("<small> / an</small>");
    expect(html("unique")).toContain("<small> une fois</small>");
  });

  it("refuse des offres ou sections de forme inattendue sans planter", () => {
    const p = newProject("crm");
    const base = siteData(p);
    const bad = (patch: object) => validateSiteData({ ...base, ...patch }).ok;
    expect(bad({ pricing: { ...defaultPricing(p.config), offres: [null] } })).toBe(false);
    expect(bad({ pricing: { ...defaultPricing(p.config), offres: [{ id: "a", nom: "x", prix: Number.NaN, periode: "mois", features: [] }] } })).toBe(false);
    expect(bad({ landing: { ...p.landing, sections: [{ ...p.landing.sections[0]!, type: "<script>" }] } })).toBe(false);
    expect(bad({ landing: { ...p.landing, sections: [null] } })).toBe(false);
    expect(bad({ config: { ...p.config, couleurs: null } })).toBe(false);
  });
});

describe("C-1 : tous les textes publiés sont échappés", () => {
  it("nom, titres, textes, éléments, fonctionnalités et offres avec des charges d'injection", () => {
    let rendered = 0;
    for (const payload of PAYLOADS) {
      const p = newProject("crm");
      const config = { ...p.config, nom: payload.slice(0, 40), description: payload.slice(0, 200) };
      const landing = {
        ...p.landing,
        boutonPrincipal: payload.slice(0, 60),
        boutonSecondaire: payload.slice(0, 60),
        sections: p.landing.sections.map((s) => ({ ...s, titre: payload, texte: payload, items: s.items.map(() => ({ titre: payload, texte: payload })) })),
      };
      const pr = defaultPricing(config);
      const pricing = { ...pr, offres: pr.offres.map((o) => ({ ...o, nom: payload.slice(0, 60), features: [payload] })) };
      const v = validateSiteData({ config, landing, pricing });
      // Les textes libres sont acceptés (longueur limitée) : c'est leur affichage qui doit être sûr.
      expect(v.ok, payload).toBe(true);
      if (!v.ok) continue;
      const html = renderLanding(v.data.config, v.data.landing, v.data.pricing, { inlineCss: true, waitlist: { action: "/api/waitlist/x" } });
      expect(dangerous(html), payload).toBe(false);
      expect(scripts(html), payload).toBe(1);
      rendered++;
    }
    expect(rendered).toBe(PAYLOADS.length);
  });

  it("le logo doit être une image en data: et reste échappé dans l'attribut", () => {
    const p = newProject("crm");
    expect(validateSiteData({ ...siteData(p), config: { ...p.config, logo: "javascript:alert(1)" } }).ok).toBe(false);
    const v = validateSiteData({ ...siteData(p), config: { ...p.config, logo: 'data:image/png;base64,AAAA" onerror="alert(1)' } });
    if (v.ok) expect(renderLanding(v.data.config, v.data.landing, null, { inlineCss: true })).not.toMatch(/onerror="alert/);
  });
});

// ─── I-3 : mention RGPD du formulaire ────────────────────────────────────
describe("I-3 : formulaire d'inscription des sites générés", () => {
  it("affiche la mention et le lien vers la politique de confidentialité", () => {
    const p = newProject("liste-attente");
    const html = renderLanding(p.config, buildLanding(p.config), null, { inlineCss: true, waitlist: { action: "/api/waitlist/mon-saas" } });
    expect(html).toContain('href="/confidentialite"');
    expect(html).toContain("sert uniquement à te prévenir du lancement");
  });
});

// ─── M-1 : redirection ouverte ───────────────────────────────────────────
describe("M-1 : safeNext", () => {
  it("garde les chemins internes", () => {
    expect(safeNext("/projets/abc?onglet=enligne")).toBe("/projets/abc?onglet=enligne");
    expect(safeNext("/parametres#formule")).toBe("/parametres#formule");
  });
  it("refuse tout ce qui peut quitter le site", () => {
    const mauvais: unknown[] = ["//evil.fr", "/\\evil.fr", "/\t/evil.fr", "/\n/evil.fr", "/\r/evil.fr", "/\u0000/evil.fr", "https://evil.fr", "http://evil.fr", "javascript:alert(1)", "evil.fr", "", null, undefined, 12, ["/x"]];
    for (const bad of mauvais) expect(safeNext(bad, "/ok"), String(bad)).toBe("/ok");
  });
  it("une URL résolue reste sur notre origine", () => {
    for (const s of ["/a", "/a/b?c=d", "/%2F/evil.fr", "/a//b"]) expect(new URL(safeNext(s), "https://decollage.test").origin).toBe("https://decollage.test");
  });
});

// ─── M-3 : injection de formule dans le CSV ──────────────────────────────
describe("M-3 : export CSV", () => {
  it("neutralise les débuts de formule", () => {
    for (const v of ["=1+1@exemple.fr", "+33@exemple.fr", "-2@exemple.fr", "@SUM(A1)@exemple.fr", "\tx@exemple.fr", '=HYPERLINK("http://evil")@x.fr']) {
      expect(csvCell(v).replace(/^"/, "")).toMatch(/^'/);
    }
  });
  it("laisse les adresses normales intactes et protège séparateurs et guillemets", () => {
    expect(csvCell("marie@exemple.fr")).toBe("marie@exemple.fr");
    expect(csvCell('a;b"c@x.fr')).toBe('"a;b""c@x.fr"');
  });
  it("produit un fichier avec BOM, en-tête et lignes sûres", () => {
    const csv = waitlistCsv([{ email: "=cmd@x.fr", created_at: "2026-10-29T10:00:00Z" }, { email: "ok@x.fr", created_at: "2026-10-29T11:00:00Z" }]);
    expect(csv.startsWith("﻿email;date\n")).toBe(true);
    expect(csv.split("\n")[1]).toBe("'=cmd@x.fr;2026-10-29T10:00:00Z");
  });
});

// ─── M-7 : prix ──────────────────────────────────────────────────────────
describe("M-7 : prix", () => {
  it("le prix affiché vient de PLANS", () => {
    expect(prixCourt("solo")).toBe(`${PLANS.solo.prix.toLocaleString("fr-FR", { minimumFractionDigits: 2 })} €`);
  });
});

// ─── Preuve d'acceptation ────────────────────────────────────────────────
describe("acceptation des documents légaux", () => {
  it("accepte les versions en vigueur", () => {
    const r = checkAcceptance({ documents: [{ document: "cgu", version: currentVersion("cgu") }, { document: "confidentialite", version: currentVersion("confidentialite") }] });
    expect(r.ok).toBe(true);
  });
  it("refuse version périmée, document inconnu, doublon, forme invalide", () => {
    const v = currentVersion("cgu");
    expect(checkAcceptance({ documents: [{ document: "cgu", version: "1999-01-01" }] })).toMatchObject({ ok: false, status: 409 });
    expect(checkAcceptance({ documents: [{ document: "mentions", version: v }] })).toMatchObject({ ok: false, status: 400 });
    expect(checkAcceptance({ documents: [{ document: "cgu", version: v }, { document: "cgu", version: v }] })).toMatchObject({ ok: false, status: 400 });
    for (const bad of [null, {}, { documents: [] }, { documents: "cgu" }, { documents: [null] }]) expect(checkAcceptance(bad)).toMatchObject({ ok: false });
  });
  it("la route d'inscription n'accepte pas les CGV (réservées à l'achat)", () => {
    expect(checkAcceptance({ documents: [{ document: "cgv", version: currentVersion("cgv") }] }, ["cgu", "confidentialite"])).toMatchObject({ ok: false });
  });
  it("l'achat exige CGV, renonciation et version à jour", () => {
    const ok = { acceptCgv: true, renonciation: true, cgvVersion: currentVersion("cgv") };
    expect(checkPurchaseConsent(ok).ok).toBe(true);
    expect(checkPurchaseConsent({ ...ok, acceptCgv: false })).toMatchObject({ ok: false, status: 400 });
    expect(checkPurchaseConsent({ ...ok, acceptCgv: "true" })).toMatchObject({ ok: false });
    expect(checkPurchaseConsent({ ...ok, renonciation: undefined })).toMatchObject({ ok: false, status: 400 });
    expect(checkPurchaseConsent({ ...ok, cgvVersion: "old" })).toMatchObject({ ok: false, status: 409 });
    expect(checkPurchaseConsent({})).toMatchObject({ ok: false });
  });
});

// ─── I-5 : résiliation avant suppression du compte ───────────────────────
describe("I-5 : résiliation de l'abonnement à la suppression du compte", () => {
  const api = (cancel: () => Promise<unknown>, retrieve: () => Promise<{ status?: string }> = async () => ({ status: "active" })) => ({ cancel, retrieve });
  const err = (code: string) => Object.assign(new Error("x"), { code });
  it("annule un abonnement actif", async () => {
    expect(await cancelSubscriptionForDeletion(api(async () => ({})), "sub_1", "active")).toBe("annule");
  });
  it("ne bloque pas si l'abonnement est déjà terminé ou introuvable", async () => {
    let called = 0;
    expect(await cancelSubscriptionForDeletion(api(async () => { called++; }), "sub_1", "canceled")).toBe("deja_termine");
    expect(called).toBe(0);
    expect(await cancelSubscriptionForDeletion(api(async () => { throw err("resource_missing"); }), "sub_1", "active")).toBe("introuvable");
    expect(await cancelSubscriptionForDeletion(api(async () => { throw new Error("non annulable"); }, async () => ({ status: "incomplete_expired" })), "sub_1", "past_due")).toBe("deja_termine");
    expect(await cancelSubscriptionForDeletion(api(async () => { throw new Error("x"); }, async () => { throw err("resource_missing"); }), "sub_1", null)).toBe("introuvable");
  });
  it("signale un vrai échec (Stripe injoignable) au lieu de continuer", async () => {
    expect(await cancelSubscriptionForDeletion(api(async () => { throw new Error("réseau"); }, async () => { throw new Error("réseau"); }), "sub_1", "active")).toBe("echec");
    expect(await cancelSubscriptionForDeletion(api(async () => { throw new Error("refus"); }, async () => ({ status: "active" })), "sub_1", "active")).toBe("echec");
  });
});

// ─── I-7 : suspension des sites ──────────────────────────────────────────
describe("I-7 : sites conservés selon la formule", () => {
  const sites = [
    { slug: "c", published_at: "2026-03-01T00:00:00Z" },
    { slug: "a", published_at: "2026-01-01T00:00:00Z" },
    { slug: "b", published_at: "2026-02-01T00:00:00Z" },
  ];
  it("garde les plus anciens dans la limite, suspend les autres", () => {
    expect(splitSites(sites, 1)).toEqual({ keep: ["a"], suspend: ["b", "c"] });
    expect(splitSites(sites, 0)).toEqual({ keep: [], suspend: ["a", "b", "c"] });
    expect(splitSites(sites, 5)).toEqual({ keep: ["a", "b", "c"], suspend: [] });
    expect(splitSites(sites, Infinity).suspend).toEqual([]);
    expect(splitSites(sites, PLANS.gratuit.maxSites).keep).toEqual([]);
  });
});
