import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/env", () => ({ appUrl: () => "https://app.test" }));

import { matchesPreview, originGuard, originOk, parseAllowedOrigins, parsePreviewPattern } from "@/lib/origin";

const post = (headers: Record<string, string>, url = "https://app.test/api/x") => new Request(url, { method: "POST", headers });
const ok = (origin: string, o: { referer?: boolean } = {}) => originOk(post({ origin }), o);

beforeEach(() => {
  delete process.env.ALLOWED_ORIGINS;
  delete process.env.ALLOWED_VERCEL_PREVIEW;
  vi.spyOn(console, "warn").mockImplementation(() => {});
});
afterEach(() => {
  delete process.env.ALLOWED_ORIGINS;
  delete process.env.ALLOWED_VERCEL_PREVIEW;
});

describe("contrôle d'origine unique : comportement par défaut (sans variable)", () => {
  it("origine exacte de l'application ou de la requête : acceptée", () => {
    expect(ok("https://app.test")).toBe(true);
    expect(originOk(post({ origin: "https://interne.test" }, "https://interne.test/x"))).toBe(true);
  });
  it("sous-domaine voisin, hôte plus long, autre domaine : refusés", () => {
    for (const o of ["https://www.app.test", "https://app.test.pirate.test", "https://pirate-app.test", "https://pirate.test", "https://xapp.test"]) expect(ok(o), o).toBe(false);
  });
  it("schéma http, port différent : refusés", () => {
    expect(ok("http://app.test")).toBe(false);
    expect(ok("https://app.test:8443")).toBe(false);
  });
  it("Origin « null », vide, illisible, avec chemin ou « / » final : refusés", () => {
    for (const o of ["null", "", "n'importe quoi", "https://app.test/", "https://app.test/page", "https://app.test?x=1"]) expect(ok(o), JSON.stringify(o)).toBe(false);
  });
  it("sans Origin : repli sur le Referer (par défaut), refus avec referer:false ; un Referer étranger ou « null » est refusé", () => {
    const withRef = post({ referer: "https://app.test/parametres" });
    expect(originOk(withRef)).toBe(true);
    expect(originOk(withRef, { referer: false })).toBe(false);
    expect(originOk(post({ referer: "https://pirate.test/x" }))).toBe(false);
    expect(originOk(post({ referer: "null" }))).toBe(false);
    expect(originOk(post({}))).toBe(false);
  });
  it("un Origin étranger n'est jamais « sauvé » par un Referer valide", () => {
    expect(originOk(post({ origin: "https://pirate.test", referer: "https://app.test/x" }))).toBe(false);
    expect(originOk(post({ origin: "null", referer: "https://app.test/x" }))).toBe(false);
  });
  it("originGuard : seules les méthodes non sûres sont contrôlées", async () => {
    expect(originGuard(new Request("https://app.test/x", { method: "GET" }))).toBeNull();
    const r = originGuard(post({ origin: "https://pirate.test" }));
    expect(r?.status).toBe(403);
    expect((await r!.json()).code).toBe("origin");
  });
});

describe("ALLOWED_ORIGINS : liste blanche d'origines exactes", () => {
  it("analyse : https exact, http seulement en local, rien d'autre", () => {
    const r = parseAllowedOrigins(" https://exemple.fr , https://www.exemple.fr:8443,http://localhost:3000,http://exemple.fr,*,https://*.exemple.fr,https://exemple.fr/chemin,https://u:p@exemple.fr,,ftp://x.fr,exemple.fr ");
    expect(r.origins).toEqual(["https://exemple.fr", "https://www.exemple.fr:8443", "http://localhost:3000"]);
    expect(r.ignored).toEqual(["http://exemple.fr", "*", "https://*.exemple.fr", "https://exemple.fr/chemin", "https://u:p@exemple.fr", "ftp://x.fr", "exemple.fr"]);
  });
  it("valeurs vides ou absentes : aucune origine ajoutée", () => {
    for (const v of [undefined, null, "", "   ", ",,,"]) expect(parseAllowedOrigins(v).origins).toEqual([]);
    process.env.ALLOWED_ORIGINS = "  ,  ";
    expect(ok("https://exemple.fr")).toBe(false);
  });
  it("origine listée : acceptée ; voisine, port, schéma, sous-domaine : refusés", () => {
    process.env.ALLOWED_ORIGINS = "https://exemple.fr";
    expect(ok("https://exemple.fr")).toBe(true);
    for (const o of ["https://www.exemple.fr", "https://exemple.fr:8443", "http://exemple.fr", "https://exemple.fr.pirate.test", "https://pirate-exemple.fr", "null"]) expect(ok(o), o).toBe(false);
  });
  it("un joker ou une entrée invalide n'ouvre RIEN", () => {
    process.env.ALLOWED_ORIGINS = "*,https://*.vercel.app,https://*";
    for (const o of ["https://x.vercel.app", "https://pirate.test", "https://a.b"]) expect(ok(o), o).toBe(false);
  });
  it("la liste s'applique aussi sans repli Referer, et avec le Referer par défaut", () => {
    process.env.ALLOWED_ORIGINS = "https://exemple.fr";
    expect(ok("https://exemple.fr", { referer: false })).toBe(true);
    expect(originOk(post({ referer: "https://exemple.fr/page" }))).toBe(true);
    expect(originOk(post({ referer: "https://exemple.fr/page" }), { referer: false })).toBe(false);
  });
});

describe("ALLOWED_VERCEL_PREVIEW : motif d'aperçus strict (désactivé par défaut)", () => {
  const P = "decollage-*-monequipe.vercel.app";
  it("désactivé par défaut : aucun aperçu Vercel accepté", () => {
    expect(ok("https://decollage-abc123-monequipe.vercel.app")).toBe(false);
    expect(ok("https://decollage.vercel.app")).toBe(false);
  });
  it("formes de motif refusées (trop larges)", () => {
    for (const v of ["*.vercel.app", "decollage-*.vercel.app", "*-monequipe.vercel.app", "decollage-*-*.vercel.app", "decollage-*-monequipe.com", "decollage-*-monequipe.vercel.app.evil.com", "decollage*monequipe.vercel.app", "https://decollage-*-monequipe.vercel.app", "-*-x.vercel.app", "", "   "]) {
      expect(parsePreviewPattern(v), v).toBeNull();
    }
    expect(parsePreviewPattern(P)).toEqual({ prefix: "decollage", suffix: "monequipe" });
  });
  it("aperçus du projet et de l'équipe : acceptés", () => {
    process.env.ALLOWED_VERCEL_PREVIEW = P;
    for (const o of ["https://decollage-abc123-monequipe.vercel.app", "https://decollage-git-ma-branche-monequipe.vercel.app"]) expect(ok(o), o).toBe(true);
  });
  it("autres projets, suffixes piégés, domaines imitant le motif : JAMAIS acceptés", () => {
    process.env.ALLOWED_VERCEL_PREVIEW = P;
    const bad = [
      "https://evil-decollage-abc-monequipe.vercel.app", // préfixe piégé
      "https://decollage.vercel.app", // production (ne correspond pas au motif d'aperçu)
      "https://decollage-abc-autreequipe.vercel.app", // autre équipe
      "https://decollage-abc-monequipe.vercel.app.evil.com", // domaine imitant
      "https://decollage-abc-monequipe.vercel.app:8443", // port
      "http://decollage-abc-monequipe.vercel.app", // http
      "https://decollage--monequipe.vercel.app", // milieu vide
      "https://decollage-monequipe.vercel.app", // pas de milieu
      "https://decollage-a.b-monequipe.vercel.app", // point dans le milieu
      "https://sub.decollage-abc-monequipe.vercel.app", // sous-domaine supplémentaire
      "https://decollage-abc-monequipe.vercel.app/", // « / » final dans l'en-tête Origin
      "https://otherproject.vercel.app",
      "https://decollage-abc-monequipe.netlify.app",
      "null",
    ];
    for (const o of bad) expect(ok(o), o).toBe(false);
  });
  it("matchesPreview sans motif : toujours faux", () => {
    expect(matchesPreview("https://decollage-abc-monequipe.vercel.app", null)).toBe(false);
  });
  it("un motif invalide dans l'environnement n'ouvre rien", () => {
    process.env.ALLOWED_VERCEL_PREVIEW = "*.vercel.app";
    expect(ok("https://nimporte-quoi.vercel.app")).toBe(false);
    expect(ok("https://decollage-abc-monequipe.vercel.app")).toBe(false);
  });
});
