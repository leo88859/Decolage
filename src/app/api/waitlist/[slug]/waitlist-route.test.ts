import { beforeEach, describe, expect, it, vi } from "vitest";

// Route d'inscription à la liste d'attente avec Supabase simulé. (Le comportement SQL réel est testé dans
// src/lib/durcissement-0007.test.ts avec PGlite.)
const h = vi.hoisted(() => ({
  rpc: vi.fn(),
  inserts: [] as unknown[],
  insertError: null as { code?: string } | null,
  siteFound: true,
  adminOk: true,
}));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/env", () => ({ isCloudConfigured: () => true, appUrl: () => "https://app.test" }));
vi.mock("@/lib/supabase/server", () => {
  const admin = () => ({
    rpc: (name: string, args: unknown) => h.rpc(name, args),
    from: (t: string) => {
      const q: Record<string, unknown> = {};
      q.select = () => q;
      q.eq = () => q;
      q.is = () => q;
      q.maybeSingle = () => Promise.resolve({ data: h.siteFound ? { slug: "mon-saas" } : null, error: null });
      q.insert = (row: unknown) => {
        h.inserts.push([t, row]);
        return Promise.resolve({ error: h.insertError });
      };
      return q;
    },
  });
  return {
    getUser: async () => ({ supabase: {}, user: null }),
    createAdminClient: () => {
      if (!h.adminOk) throw new Error("no key");
      return admin();
    },
    createPublicClient: () => {
      throw new Error("la liste d'attente ne doit plus écrire avec la clé anonyme");
    },
  };
});
import { resetRateLimit } from "@/lib/boutique/api";
import { POST } from "./route";

let n = 0;
const post = (email: string, extra: Record<string, string> = {}, ip = `10.0.0.${++n}`) => {
  const body = new URLSearchParams({ email, ...extra });
  return POST(
    new Request("https://app.test/api/waitlist/mon-saas", { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded", "x-forwarded-for": ip }, body }) as never,
    { params: Promise.resolve({ slug: "mon-saas" }) } as never,
  );
};
const where = (r: Response) => r.headers.get("location") ?? "";
const reply = (code: unknown, limited = false) => async (name: string) => (name === "limite_debit" ? { data: limited, error: null } : { data: code, error: null });

beforeEach(() => {
  h.inserts = [];
  h.insertError = null;
  h.siteFound = true;
  h.adminOk = true;
  h.rpc.mockReset().mockImplementation(reply("ok"));
  resetRateLimit();
});

describe("POST /api/waitlist/[slug]", () => {
  it("inscrit par la fonction SQL waitlist_inscrire (clé serveur), jamais par insertion directe ni clé anonyme", async () => {
    const r = await post(" Marie@Exemple.fr ");
    expect(r.status).toBe(303);
    expect(where(r)).toContain("/s/mon-saas?merci=1");
    expect(h.rpc).toHaveBeenCalledWith("waitlist_inscrire", { p_slug: "mon-saas", p_email: "marie@exemple.fr" });
    expect(h.inserts).toHaveLength(0);
  });

  it("un doublon donne EXACTEMENT la même redirection qu'une nouvelle inscription (rien n'est révélé)", async () => {
    const neuf = where(await post("a@exemple.fr"));
    const doublon = where(await post("a@exemple.fr")); // la base répond 'ok' dans les deux cas
    expect(doublon).toBe(neuf);
  });

  it("refus de la base (liste pleine, site inconnu, trop de demandes, e-mail invalide) : page d'erreur", async () => {
    for (const code of ["liste_pleine", "site_inconnu", "trop_de_demandes", "email_invalide"]) {
      h.rpc.mockImplementation(reply(code));
      expect(where(await post("a@exemple.fr"))).toContain("erreur=1");
    }
  });

  it("limite de débit partagée en base : au-delà, erreur sans inscription ; la limite mémoire (8 par minute) reste active", async () => {
    h.rpc.mockImplementation(reply("ok", true));
    expect(where(await post("a@exemple.fr"))).toContain("erreur=1");
    expect(h.rpc.mock.calls.some(([name]) => name === "waitlist_inscrire")).toBe(false);
    h.rpc.mockImplementation(reply("ok"));
    const ip = "11.1.1.1";
    const res: string[] = [];
    for (let i = 0; i < 10; i++) res.push(where(await post(`u${i}@exemple.fr`, {}, ip)));
    expect(res.filter((l) => l.includes("merci=1"))).toHaveLength(8);
  });

  it("champ piège rempli, e-mail invalide : aucun appel à la base", async () => {
    expect(where(await post("a@exemple.fr", { site: "http://spam" }))).toContain("merci=1");
    expect(where(await post("pas-un-email"))).toContain("erreur=1");
    expect(h.rpc).not.toHaveBeenCalled();
  });

  it("migration 0007 pas exécutée : repli par insertion serveur, doublon confirmé, site suspendu refusé", async () => {
    h.rpc.mockImplementation(async (name: string) => ({ data: null, error: { code: "PGRST202", message: `Could not find the function public.${name}` } }));
    expect(where(await post("a@exemple.fr"))).toContain("merci=1");
    expect(h.inserts).toEqual([["waitlist", { slug: "mon-saas", email: "a@exemple.fr" }]]);
    h.insertError = { code: "23505" };
    expect(where(await post("a@exemple.fr"))).toContain("merci=1"); // doublon : même réponse
    h.insertError = null;
    h.siteFound = false;
    h.inserts = [];
    expect(where(await post("b@exemple.fr"))).toContain("erreur=1");
    expect(h.inserts).toHaveLength(0);
  });

  it("sans clé serveur : erreur, aucune écriture", async () => {
    h.adminOk = false;
    expect(where(await post("a@exemple.fr"))).toContain("erreur=1");
    expect(h.inserts).toHaveLength(0);
  });
});
