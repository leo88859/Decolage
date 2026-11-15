import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Étape 2 : routes avec Supabase et Cloudflare SIMULÉS (aucune base, aucun réseau). Les règles SQL sont testées avec PGlite dans
// src/lib/boutique/expiration-0010.test.ts. Ce sont des simulations, pas des tests de production.
const h = vi.hoisted(() => ({
  user: { id: "user-a" } as { id: string } | null,
  rpc: vi.fn(),
  updates: [] as { table: string; patch: unknown; filters: [string, unknown][] }[],
  updateResult: { data: [] as { ref: string }[], error: null as null | { code?: string; message?: string; hint?: string } },
  boutique: { id: "x" } as Record<string, unknown> | null,
  selects: [] as string[],
  catalogueErrors: [] as ({ code?: string; message?: string } | null)[],
}));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/env", () => ({ isCloudConfigured: () => true, appUrl: () => "https://app.test" }));
function chain(table: string) {
  const state = { table, patch: undefined as unknown, filters: [] as [string, unknown][], isUpdate: false };
  const q: Record<string, unknown> = {};
  q.select = (cols?: string) => { if (typeof cols === "string") h.selects.push(cols); return q; };
  q.update = (p: unknown) => { state.isUpdate = true; state.patch = p; return q; };
  for (const m of ["eq", "in", "order", "limit"]) q[m] = (...a: unknown[]) => { state.filters.push([m, a as unknown as unknown]); return q; };
  q.maybeSingle = () => {
    if (table === "boutiques" && h.catalogueErrors.length) return Promise.resolve({ data: null, error: h.catalogueErrors.shift() });
    return Promise.resolve({ data: h.boutique, error: null });
  };
  q.then = (ok: (v: unknown) => unknown) => {
    if (state.isUpdate) { h.updates.push({ table, patch: state.patch, filters: state.filters }); return ok(h.updateResult); }
    return ok({ data: [], error: null });
  };
  return q;
}
const client = () => ({ from: (t: string) => chain(t), rpc: (...a: unknown[]) => h.rpc(...a) });
vi.mock("@/lib/supabase/server", () => ({
  getUser: async () => ({ supabase: client(), user: h.user }),
  createAdminClient: () => client(),
  createPublicClient: () => client(),
}));

import { resetRateLimit } from "@/lib/boutique/api";
import { POST as passerCommande } from "@/app/api/boutique/commande/route";
import { POST as annuler } from "@/app/api/boutique/[id]/commandes/annuler/route";
import { GET as catalogue } from "@/app/api/boutique/catalogue/[slug]/route";

const ORIGIN = "https://app.test";
const ID = "11111111-1111-4111-8111-111111111111";
const VID = "22222222-2222-4222-8222-222222222222";
const req = (body: unknown, headers: Record<string, string> = {}) =>
  new Request("https://app.test/api/x", { method: "POST", headers: { "content-type": "application/json", origin: ORIGIN, ...headers }, body: JSON.stringify(body) });
const ctx = (id: string) => ({ params: Promise.resolve({ id }) });
const CMD = { slug: "chez-awa", cle: "cle-1234567890abcdef", mode: "retrait", client: { nom: "Awa", email: "awa@exemple.fr" }, lignes: [{ variante_id: VID, quantite: 2 }] };
const okCommande = { data: { ref: "CMD-ABCDEF123456", statut: "nouvelle", paiement: "non_payee", rejouee: false, jeton_suivi: "a".repeat(64) }, error: null };
const REF = (i: number) => `CMD-${String(i).padStart(12, "A")}`;

beforeEach(() => {
  resetRateLimit();
  h.user = { id: "user-a" };
  h.updates = [];
  h.selects = [];
  h.catalogueErrors = [];
  h.boutique = { id: ID };
  h.updateResult = { data: [], error: null };
  h.rpc.mockReset().mockImplementation(async (name: string) => (name === "limite_debit" ? { data: false, error: null } : okCommande));
});
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

describe("POST /api/boutique/commande : limites par IP (3 par minute, 10 par heure)", () => {
  it("la 4e commande de la minute est refusée (429 rate_limit)", async () => {
    const ip = { "x-forwarded-for": "9.9.9.1" };
    for (let i = 0; i < 3; i++) expect((await passerCommande(req(CMD, ip))).status).toBe(201);
    const r = await passerCommande(req(CMD, ip));
    expect(r.status).toBe(429);
    expect((await r.json()).code).toBe("rate_limit");
  });
  it("une autre adresse n'est pas touchée ; la limite partagée en base est appelée avec 3 par 60 s et 10 par 3600 s", async () => {
    for (let i = 0; i < 3; i++) await passerCommande(req(CMD, { "x-forwarded-for": "9.9.9.2" }));
    expect((await passerCommande(req(CMD, { "x-forwarded-for": "9.9.9.3" }))).status).toBe(201);
    expect(h.rpc).toHaveBeenCalledWith("limite_debit", expect.objectContaining({ p_seau: "cmd-min", p_max: 3, p_fenetre_s: 60 }));
    expect(h.rpc).toHaveBeenCalledWith("limite_debit", expect.objectContaining({ p_seau: "cmd-h", p_max: 10, p_fenetre_s: 3600 }));
  });
  it("limite horaire partagée en base dépassée : 429", async () => {
    h.rpc.mockImplementation(async (name: string, a: { p_seau?: string }) => (name === "limite_debit" ? { data: a.p_seau === "cmd-h", error: null } : okCommande));
    expect((await passerCommande(req(CMD, { "x-forwarded-for": "9.9.9.4" }))).status).toBe(429);
  });
});

describe("POST /api/boutique/commande : erreurs de la base traduites", () => {
  const cas: [string, number, string][] = [
    ["E_QUANTITE_MAX", 400, "quantite_max"],
    ["E_ARTICLES_MAX", 400, "articles_max"],
    ["E_CONTACT_TROP_DE_COMMANDES", 429, "trop_de_commandes_contact"],
    ["E_TROP_DE_NOUVELLES", 429, "trop_de_nouvelles"],
  ];
  for (const [sql, status, code] of cas) {
    it(`${sql} -> ${status} ${code}`, async () => {
      h.rpc.mockImplementation(async (name: string) => (name === "limite_debit" ? { data: false, error: null } : { data: null, error: { message: `error ${sql}` } }));
      const r = await passerCommande(req(CMD, { "x-forwarded-for": `9.8.${status}.${code.length}` }));
      expect(r.status).toBe(status);
      expect((await r.json()).code).toBe(code);
    });
  }
  it("la validation serveur refuse plus de 50 articles avant d'interroger la base", async () => {
    const r = await passerCommande(req({ ...CMD, lignes: [{ variante_id: VID, quantite: 40 }, { variante_id: "33333333-3333-4333-8333-333333333333", quantite: 11 }] }, { "x-forwarded-for": "9.8.1.1" }));
    expect(r.status).toBe(400);
    expect(h.rpc).not.toHaveBeenCalled();
  });
});

describe("POST /api/boutique/commande : Cloudflare Turnstile", () => {
  const cf = (body: unknown, status = 200) => vi.fn(async () => new Response(JSON.stringify(body), { status }));
  const ip = (n: number) => ({ "x-forwarded-for": `8.8.8.${n}` });
  const appelsCommande = () => h.rpc.mock.calls.filter((c) => c[0] === "boutique_creer_commande").length;
  it("non configuré : la commande passe sans jeton, Cloudflare n'est jamais appelé", async () => {
    vi.stubEnv("TURNSTILE_SECRET_KEY", "");
    const f = cf({ success: false });
    vi.stubGlobal("fetch", f);
    expect((await passerCommande(req(CMD, ip(1)))).status).toBe(201);
    expect(f).not.toHaveBeenCalled();
  });
  it("une SEULE clé (publique) : commande bloquée 500 « configuration_turnstile », Cloudflare jamais appelé, aucune commande", async () => {
    vi.stubEnv("TURNSTILE_SECRET_KEY", "");
    vi.stubEnv("NEXT_PUBLIC_TURNSTILE_SITE_KEY", "site-de-test");
    const f = cf({ success: true });
    vi.stubGlobal("fetch", f);
    const r = await passerCommande(req({ ...CMD, turnstile: "bon" }, ip(9)));
    expect(r.status).toBe(500);
    expect((await r.json()).code).toBe("configuration_turnstile");
    expect(f).not.toHaveBeenCalled();
    expect(appelsCommande()).toBe(0);
  });
  it("une SEULE clé (secrète) : commande bloquée 500 « configuration_turnstile », aucune commande", async () => {
    vi.stubEnv("TURNSTILE_SECRET_KEY", "secret-de-test");
    vi.stubEnv("NEXT_PUBLIC_TURNSTILE_SITE_KEY", "");
    vi.stubGlobal("fetch", cf({ success: true }));
    const r = await passerCommande(req({ ...CMD, turnstile: "bon" }, ip(10)));
    expect(r.status).toBe(500);
    expect((await r.json()).code).toBe("configuration_turnstile");
    expect(appelsCommande()).toBe(0);
  });
  it("activé, jeton absent : refus 400, aucune commande créée", async () => {
    vi.stubEnv("TURNSTILE_SECRET_KEY", "secret-de-test");
    vi.stubEnv("NEXT_PUBLIC_TURNSTILE_SITE_KEY", "site-de-test");
    vi.stubGlobal("fetch", cf({ success: true }));
    const r = await passerCommande(req(CMD, ip(2)));
    expect(r.status).toBe(400);
    expect((await r.json()).code).toBe("turnstile_requis");
    expect(appelsCommande()).toBe(0);
  });
  it("activé, jeton invalide : refus 403, aucune commande créée", async () => {
    vi.stubEnv("TURNSTILE_SECRET_KEY", "secret-de-test");
    vi.stubEnv("NEXT_PUBLIC_TURNSTILE_SITE_KEY", "site-de-test");
    vi.stubGlobal("fetch", cf({ success: false, "error-codes": ["invalid-input-response"] }));
    const r = await passerCommande(req({ ...CMD, turnstile: "mauvais" }, ip(3)));
    expect(r.status).toBe(403);
    expect((await r.json()).code).toBe("turnstile_invalide");
    expect(appelsCommande()).toBe(0);
  });
  it("activé, jeton valide : la commande est créée", async () => {
    vi.stubEnv("TURNSTILE_SECRET_KEY", "secret-de-test");
    vi.stubEnv("NEXT_PUBLIC_TURNSTILE_SITE_KEY", "site-de-test");
    vi.stubGlobal("fetch", cf({ success: true }));
    expect((await passerCommande(req({ ...CMD, turnstile: "bon" }, ip(4)))).status).toBe(201);
    expect(appelsCommande()).toBe(1);
  });
  it("activé, Cloudflare injoignable ou en panne : 503 temporaire, aucune commande créée", async () => {
    vi.stubEnv("TURNSTILE_SECRET_KEY", "secret-de-test");
    vi.stubEnv("NEXT_PUBLIC_TURNSTILE_SITE_KEY", "site-de-test");
    vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("réseau"); }));
    const r = await passerCommande(req({ ...CMD, turnstile: "bon" }, ip(5)));
    expect(r.status).toBe(503);
    expect((await r.json()).code).toBe("turnstile_indisponible");
    vi.stubGlobal("fetch", cf({}, 502));
    expect((await passerCommande(req({ ...CMD, turnstile: "bon" }, ip(6)))).status).toBe(503);
    expect(appelsCommande()).toBe(0);
  });
  it("le champ piège « site » rempli ne déclenche aucune vérification ni création", async () => {
    vi.stubEnv("TURNSTILE_SECRET_KEY", "secret-de-test");
    vi.stubEnv("NEXT_PUBLIC_TURNSTILE_SITE_KEY", "site-de-test");
    const f = cf({ success: true });
    vi.stubGlobal("fetch", f);
    expect((await passerCommande(req({ ...CMD, site: "http://spam" }, ip(7)))).status).toBe(201);
    expect(f).not.toHaveBeenCalled();
    expect(appelsCommande()).toBe(0);
  });
});

describe("POST /api/boutique/[id]/commandes/annuler (annulation multiple)", () => {
  it("annule les commandes « nouvelle » de MA boutique seulement et signale les autres", async () => {
    h.updateResult = { data: [{ ref: REF(1) }, { ref: REF(2) }], error: null };
    const r = await annuler(req({ refs: [REF(1), REF(2), REF(3)] }), ctx(ID));
    expect(r.status).toBe(200);
    expect(await r.json()).toEqual({ annulees: [REF(1), REF(2)], ignorees: [REF(3)] });
    const u = h.updates[0]!;
    expect(u.table).toBe("commandes");
    expect(u.patch).toEqual({ statut: "annulee" }); // seul le statut change ; le stock est remis par le déclencheur de la base
    expect(u.filters).toEqual(expect.arrayContaining([["eq", ["boutique_id", ID]], ["eq", ["statut", "nouvelle"]], ["in", ["ref", [REF(1), REF(2), REF(3)]]]]));
  });
  it("un second appel identique ne réannule rien (rien à remettre en stock)", async () => {
    h.updateResult = { data: [], error: null };
    const r = await annuler(req({ refs: [REF(1)] }), ctx(ID));
    expect(await r.json()).toEqual({ annulees: [], ignorees: [REF(1)] });
  });
  it("doublons dans la demande : une seule référence envoyée à la base", async () => {
    await annuler(req({ refs: [REF(1), REF(1)] }), ctx(ID));
    expect(h.updates[0]!.filters).toContainEqual(["in", ["ref", [REF(1)]]]);
  });
  it("données invalides : refs absentes, vides, trop nombreuses, mal formées, champ inconnu, JSON non objet", async () => {
    for (const body of [{}, { refs: [] }, { refs: "CMD-AAAAAAAA" }, { refs: ["pas-une-ref"] }, { refs: [42] }, { refs: Array.from({ length: 51 }, (_, i) => REF(i + 1)) }, { refs: [REF(1)], statut: "terminee" }, [REF(1)], "x"]) {
      expect((await annuler(req(body), ctx(ID))).status, JSON.stringify(body).slice(0, 40)).toBe(400);
    }
    expect(h.updates).toHaveLength(0);
  });
  it("50 références acceptées", async () => {
    expect((await annuler(req({ refs: Array.from({ length: 50 }, (_, i) => REF(i + 1)) }), ctx(ID))).status).toBe(200);
  });
  it("identifiant de boutique invalide ou boutique d'un autre : 404 ; non connecté : 401 ; origine inattendue : 403", async () => {
    expect((await annuler(req({ refs: [REF(1)] }), ctx("pas-un-uuid"))).status).toBe(404);
    h.boutique = null;
    expect((await annuler(req({ refs: [REF(1)] }), ctx(ID))).status).toBe(404);
    h.boutique = { id: ID };
    h.user = null;
    expect((await annuler(req({ refs: [REF(1)] }), ctx(ID))).status).toBe(401);
    h.user = { id: "user-a" };
    expect((await annuler(req({ refs: [REF(1)] }, { origin: "https://evil.test" }), ctx(ID))).status).toBe(403);
    expect(h.updates).toHaveLength(0);
  });
  it("erreur temporaire de la base : 500 sans fuite, rien n'est présenté comme annulé", async () => {
    h.updateResult = { data: [], error: { code: "XX000", message: "relation secrete" } };
    const r = await annuler(req({ refs: [REF(1)] }), ctx(ID));
    expect(r.status).toBe(500);
    expect(JSON.stringify(await r.json())).not.toContain("secrete");
  });
});

describe("GET /api/boutique/catalogue/[slug] : réglages d'expiration", () => {
  const appel = () => catalogue(new Request("https://app.test/api/boutique/catalogue/chez-awa"), { params: Promise.resolve({ slug: "chez-awa" }) });
  it("demande le délai et la quantité maximale, et les renvoie", async () => {
    h.boutique = { id: ID, slug: "chez-awa", delai_expiration_h: 24, quantite_max_article: 5 };
    const r = await appel();
    expect(r.status).toBe(200);
    expect((await r.json()).boutique).toMatchObject({ delai_expiration_h: 24, quantite_max_article: 5 });
    expect(h.selects[0]).toContain("delai_expiration_h");
  });
  it("migration 0010 pas encore exécutée : la vitrine s'affiche quand même (repli sans les colonnes)", async () => {
    h.catalogueErrors = [{ code: "42703", message: 'column boutiques.delai_expiration_h does not exist' }];
    h.boutique = { id: ID, slug: "chez-awa" };
    const r = await appel();
    expect(r.status).toBe(200);
    expect(h.selects.some((s) => !s.includes("delai_expiration_h") && s.includes("theme"))).toBe(true);
  });
});
