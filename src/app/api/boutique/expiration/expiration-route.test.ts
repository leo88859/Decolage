import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Route d'expiration des commandes « nouvelle » : désactivée sans CRON_SECRET, protégée par secret, paramètres bornés.
const h = vi.hoisted(() => ({ rpc: vi.fn(), adminOk: true }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/env", () => ({ isCloudConfigured: () => true, appUrl: () => "https://app.test" }));
vi.mock("@/lib/supabase/server", () => ({
  getUser: async () => ({ supabase: {}, user: null }),
  createAdminClient: () => { if (!h.adminOk) throw new Error("no key"); return { rpc: (...a: unknown[]) => h.rpc(...a) }; },
  createPublicClient: () => ({}),
}));
import { GET, POST } from "./route";

const call = (method: "GET" | "POST", auth?: string, qs = "") =>
  (method === "GET" ? GET : POST)(new Request(`https://app.test/api/boutique/expiration${qs}`, { method, headers: auth ? { authorization: auth } : {} }));

beforeEach(() => {
  h.adminOk = true;
  h.rpc.mockReset().mockResolvedValue({ data: 3, error: null });
});
afterEach(() => vi.unstubAllEnvs());

describe("POST|GET /api/boutique/expiration", () => {
  it("sans CRON_SECRET (valeur par défaut) : la route n'existe pas (404) et rien n'est exécuté", async () => {
    vi.stubEnv("CRON_SECRET", "");
    expect((await call("POST", "Bearer n-importe-quoi")).status).toBe(404);
    expect((await call("GET")).status).toBe(404);
    expect(h.rpc).not.toHaveBeenCalled();
  });

  it("secret absent ou faux : 401, rien n'est exécuté", async () => {
    vi.stubEnv("CRON_SECRET", "s3cret-de-test");
    for (const a of [undefined, "Bearer faux", "s3cret-de-test", "Basic s3cret-de-test", "Bearer "]) expect((await call("POST", a)).status).toBe(401);
    expect(h.rpc).not.toHaveBeenCalled();
  });

  it("bon secret : annule les commandes de plus de 72 h par défaut (POST ou GET) et renvoie le nombre", async () => {
    vi.stubEnv("CRON_SECRET", "s3cret-de-test");
    const r = await call("POST", "Bearer s3cret-de-test");
    expect(r.status).toBe(200);
    expect(await r.json()).toEqual({ annulees: 3, heures: 72 });
    expect(h.rpc).toHaveBeenCalledWith("boutique_expirer_commandes_nouvelles", { p_age: "72 hours" });
    expect((await call("GET", "Bearer s3cret-de-test", "?heures=24")).status).toBe(200);
    expect(h.rpc).toHaveBeenLastCalledWith("boutique_expirer_commandes_nouvelles", { p_age: "24 hours" });
  });

  it("âge borné entre 1 et 720 heures ; clé serveur absente 503 ; migration absente 503 ; autre erreur 500 sans fuite", async () => {
    vi.stubEnv("CRON_SECRET", "s3cret-de-test");
    for (const qs of ["?heures=0", "?heures=721", "?heures=abc", "?heures=1.5", "?heures=-3", "?heures="]) expect((await call("POST", "Bearer s3cret-de-test", qs)).status, qs).toBe(400);
    expect(h.rpc).not.toHaveBeenCalled();
    h.adminOk = false;
    expect((await call("POST", "Bearer s3cret-de-test")).status).toBe(503);
    h.adminOk = true;
    h.rpc.mockResolvedValueOnce({ data: null, error: { code: "PGRST202", message: "Could not find the function" } });
    expect((await call("POST", "Bearer s3cret-de-test")).status).toBe(503);
    h.rpc.mockResolvedValueOnce({ data: null, error: { code: "XX000", message: "relation secrete" } });
    const e = await call("POST", "Bearer s3cret-de-test");
    expect(e.status).toBe(500);
    expect(JSON.stringify(await e.json())).not.toContain("secrete");
  });
});

describe("choix documenté : GET (Vercel Cron) et POST (appel manuel), rien d'autre ; secret comparé en temps constant", () => {
  it("seuls GET et POST sont exportés (PUT, DELETE, PATCH : 405 par Next.js)", async () => {
    const mod = await import("./route");
    const methodes = Object.keys(mod).filter((k) => /^[A-Z]+$/.test(k)).sort();
    expect(methodes).toEqual(["GET", "POST"]);
  });

  it("le secret est comparé par empreintes de même longueur avec timingSafeEqual (pas de ===), y compris pour des secrets de longueurs différentes", async () => {
    const { readFileSync } = await import("node:fs");
    const src = readFileSync("src/app/api/boutique/expiration/route.ts", "utf8");
    expect(src).toContain("timingSafeEqual");
    expect(src).not.toMatch(/===\s*secret|secret\s*===/);
    vi.stubEnv("CRON_SECRET", "s3cret-de-test");
    expect((await call("GET", "Bearer s3cret-de-test-plus-long")).status).toBe(401);
    expect((await call("GET", "Bearer s3")).status).toBe(401);
    expect(h.rpc).not.toHaveBeenCalled();
  });
});
