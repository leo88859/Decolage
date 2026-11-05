import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { defaultConfig, validateConfig } from "@/lib/config";
import { PLANS } from "@/lib/plans";
import robots from "./robots";
import sitemap from "./sitemap";

const lire = (p: string) => readFileSync(new URL(p, import.meta.url), "utf8");

describe("validateConfig : noms hérités d'Object refusés", () => {
  it("refuse constructor / toString comme style ou police", () => {
    const cfg = defaultConfig("abonnement");
    expect(validateConfig({ ...cfg, style: "constructor" as never }).style).toBeTruthy();
    expect(validateConfig({ ...cfg, police: "toString" as never }).police).toBeTruthy();
    expect(validateConfig(cfg).style).toBeUndefined();
  });
});

describe("robots.txt et sitemap.xml", () => {
  it("robots autorise le public, interdit l'API et l'espace connecté, et cite le sitemap", () => {
    const r = robots();
    const rule = Array.isArray(r.rules) ? r.rules[0]! : r.rules;
    expect(rule.allow).toBe("/");
    expect(rule.disallow).toEqual(expect.arrayContaining(["/api/", "/parametres"]));
    expect(String(r.sitemap)).toMatch(/\/sitemap\.xml$/);
  });
  it("sitemap liste l'accueil, le guide et les pages légales, sans l'espace connecté", () => {
    const urls = sitemap().map((s) => s.url);
    expect(urls).toContain("https://decollage.vercel.app");
    expect(urls).toContain("https://decollage.vercel.app/guide");
    expect(urls).toContain("https://decollage.vercel.app/cgv");
    expect(urls.some((u) => u.includes("/api") || u.includes("/parametres") || u.includes("/projets"))).toBe(false);
  });
});

describe("redirections /tarifs et /apprendre", () => {
  it("next.config redirige vers les offres et le guide", () => {
    const c = lire("../../next.config.ts");
    expect(c).toMatch(/source: "\/tarifs", destination: "\/#offres"/);
    expect(c).toMatch(/source: "\/apprendre", destination: "\/guide"/);
  });
});

describe("textes d'accueil et promesses", () => {
  const accueil = lire("./page.tsx");
  it("la ligne de réassurance est en haut et dit seulement des choses vraies", () => {
    expect(accueil).toContain("hero-assure");
    expect(accueil).toContain("la même idée donne toujours le même résultat");
    expect(accueil).toContain("sans engagement");
  });
  it("décrit ce qu'on obtient et ne promet pas d'application complète", () => {
    expect(accueil).toContain("démo cliquable");
    expect(accueil).toContain("projet Next.js");
    expect(accueil).not.toMatch(/application fonctionnelle/i);
  });
  it("les boutons Choisir mènent à la connexion puis aux formules", () => {
    expect(accueil).toContain("/connexion?next=/parametres%23formule");
    expect(accueil).not.toContain('href="/parametres#formule"');
  });
  it("les prix affichés restent ceux de plans.ts", () => {
    expect([PLANS.gratuit.prix, PLANS.solo.prix, PLANS.pro.prix, PLANS.illimite.prix]).toEqual([0, 2.99, 12.99, 29.99]);
  });
  it("aucune promesse de domaine personnalisé dans l'onglet En ligne", () => {
    const t = lire("../components/project/OnlineTab.tsx");
    expect(t).not.toContain("se branche à l&apos;étape");
    expect(t).toContain("ne propose pas de nom de domaine personnalisé");
    expect(lire("../components/project/Overview.tsx")).toContain("non fournis par Décollage");
  });
  it("le guide annonce cinq parcours", () => {
    expect(lire("./guide/page.tsx")).not.toContain("Quatre parcours");
  });
  it(".gitignore couvre .env.production", () => {
    expect(lire("../../.gitignore")).toContain(".env.production");
  });
});
