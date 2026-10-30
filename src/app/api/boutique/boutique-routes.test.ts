import { beforeEach, describe, expect, it, vi } from "vitest";

// Routes /api/boutique/** avec Supabase simulé : session, origine, validation, anti-spam, appels faits à la base.
// (Le comportement SQL réel est testé dans src/lib/boutique/boutique-rls.test.ts avec PGlite.)
type Call = { table: string; steps: [string, unknown[]][] };
const h = vi.hoisted(() => ({
  user: { id: "user-a" } as { id: string } | null,
  calls: [] as { table: string; steps: [string, unknown[]][] }[],
  results: {} as Record<string, { data: unknown; error: { code?: string; message?: string; hint?: string } | null }>,
  rpc: vi.fn(),
  /** Résultats des fonctions SQL ajoutées par la migration 0007 (par défaut : « fonction absente » pour le produit, limite non atteinte). */
  extra: {} as Record<string, { data: unknown; error: { code?: string; message?: string; hint?: string } | null }>,
  extraCalls: [] as [string, unknown][],
  adminOk: true,
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/env", () => ({ isCloudConfigured: () => true, appUrl: () => "https://app.test" }));

function chain(table: string) {
  const call: Call = { table, steps: [] };
  h.calls.push(call);
  const q: Record<string, unknown> = {};
  const res = () => h.results[table] ?? { data: [], error: null };
  for (const m of ["select", "eq", "insert", "update", "delete", "order", "limit"]) q[m] = (...a: unknown[]) => { call.steps.push([m, a]); return q; };
  q.single = () => { call.steps.push(["single", []]); const r = res(); return Promise.resolve({ data: Array.isArray(r.data) ? r.data[0] ?? null : r.data, error: r.error }); };
  q.maybeSingle = () => { call.steps.push(["maybeSingle", []]); const r = res(); return Promise.resolve({ data: Array.isArray(r.data) ? r.data[0] ?? null : r.data, error: r.error }); };
  q.then = (ok: (v: unknown) => unknown) => ok(res());
  return q;
}
const client = () => ({
  from: (t: string) => chain(t),
  rpc: (name: string, ...a: unknown[]) => {
    if (name in h.extra) { h.extraCalls.push([name, a[0]]); return Promise.resolve(h.extra[name]); }
    return h.rpc(name, ...a);
  },
});
vi.mock("@/lib/supabase/server", () => ({
  getUser: async () => ({ supabase: client(), user: h.user }),
  createAdminClient: () => { if (!h.adminOk) throw new Error("no key"); return client(); },
  createPublicClient: () => client(),
}));

import { resetRateLimit } from "@/lib/boutique/api";
import { POST as createBoutique, GET as listBoutiques } from "@/app/api/boutique/route";
import { PATCH as patchBoutique, GET as getBoutique } from "@/app/api/boutique/[id]/route";
import { POST as createProduit } from "@/app/api/boutique/[id]/produits/route";
import { PATCH as patchStatut } from "@/app/api/boutique/[id]/commandes/[ref]/route";
import { GET as listCommandes } from "@/app/api/boutique/[id]/commandes/route";
import { GET as catalogue } from "@/app/api/boutique/catalogue/[slug]/route";
import { POST as passerCommande } from "@/app/api/boutique/commande/route";
import { POST as suivre } from "@/app/api/boutique/suivi/route";

const ORIGIN = "https://app.test";
const ID = "11111111-1111-4111-8111-111111111111";
const VID = "22222222-2222-4222-8222-222222222222";
const req = (method: string, body?: unknown, headers: Record<string, string> = { origin: ORIGIN }, url = "https://app.test/api/boutique/x") =>
  new Request(url, { method, headers: { "content-type": "application/json", ...headers }, body: body === undefined ? undefined : typeof body === "string" ? body : JSON.stringify(body) });
const ctx = <T extends object>(p: T) => ({ params: Promise.resolve(p) });
const CMD = { slug: "chez-awa", cle: "cle-1234567890abcdef", mode: "retrait", client: { nom: "Awa", email: "awa@exemple.fr" }, lignes: [{ variante_id: VID, quantite: 2 }] };
const sqlErr = (m: string) => ({ data: null, error: { message: m } });
const steps = (table: string, op: string) => h.calls.filter((c) => c.table === table).flatMap((c) => c.steps.filter(([m]) => m === op).map(([, a]) => a));

beforeEach(() => {
  h.user = { id: "user-a" };
  h.calls = [];
  h.results = {};
  h.adminOk = true;
  h.extraCalls = [];
  h.extra = {
    limite_debit: { data: false, error: null },
    boutique_creer_produit: { data: null, error: { code: "PGRST202", message: "Could not find the function public.boutique_creer_produit" } },
  };
  h.rpc.mockReset().mockResolvedValue({ data: { ref: "CMD-AAAA1111", statut: "nouvelle", total_centimes: 2000, paiement: "non_payee", mode: "retrait", rejouee: false, jeton_suivi: "a".repeat(64) }, error: null });
  resetRateLimit();
});

describe("routes du commerçant : session, origine, validation", () => {
  it("refuse sans connexion (401) et une écriture sans bonne origine (403), avant toute écriture", async () => {
    h.user = null;
    expect((await listBoutiques(req("GET", undefined, {}))).status).toBe(401);
    expect((await createBoutique(req("POST", { slug: "chez-awa", nom: "x" }))).status).toBe(401);
    h.user = { id: "user-a" };
    for (const origin of [undefined, "https://evil.example", "null"]) {
      const r = await createBoutique(req("POST", { slug: "chez-awa", nom: "x" }, origin ? { origin } : {}));
      expect(r.status).toBe(403);
    }
    expect((await patchBoutique(req("PATCH", { nom: "x" }, { origin: "https://evil.example" }), ctx({ id: ID }))).status).toBe(403);
    expect(h.calls).toHaveLength(0);
  });

  it("la création prend le propriétaire dans la session ; un proprietaire_id envoyé est refusé", async () => {
    h.results.boutiques = { data: [{ id: ID }], error: null };
    const ok = await createBoutique(req("POST", { slug: "chez-awa", nom: "Chez Awa" }));
    expect(ok.status).toBe(201);
    expect(steps("boutiques", "insert")[0]![0]).toMatchObject({ proprietaire_id: "user-a", slug: "chez-awa" });
    h.calls = [];
    const bad = await createBoutique(req("POST", { slug: "chez-awa", nom: "x", proprietaire_id: "user-b" }));
    expect(bad.status).toBe(400);
    expect(h.calls).toHaveLength(0);
  });

  it("une limite de formule de la base devient une réponse 403 claire ; un doublon de slug 409", async () => {
    h.results.boutiques = { data: null, error: { code: "P0001", message: "Limite", hint: "limite_boutiques" } };
    const r = await createBoutique(req("POST", { slug: "chez-awa", nom: "x" }));
    expect(r.status).toBe(403);
    expect((await r.json()).code).toBe("limite_boutiques");
    h.results.boutiques = { data: null, error: { code: "23505", message: "duplicate key value" } };
    expect((await createBoutique(req("POST", { slug: "chez-awa", nom: "x" }))).status).toBe(409);
  });

  it("n'expose jamais le texte brut d'une erreur de la base", async () => {
    h.results.boutiques = { data: null, error: { code: "XX000", message: "relation \"secret\" does not exist" } };
    const r = await createBoutique(req("POST", { slug: "chez-awa", nom: "x" }));
    expect(r.status).toBe(500);
    expect(JSON.stringify(await r.json())).not.toContain("secret");
  });

  it("boutique d'un autre (ou inexistante, ou identifiant invalide) : 404, sans écriture", async () => {
    h.results.boutiques = { data: null, error: null };
    expect((await getBoutique(req("GET", undefined, {}), ctx({ id: ID }))).status).toBe(404);
    expect((await patchBoutique(req("PATCH", { nom: "x" }), ctx({ id: ID }))).status).toBe(404);
    expect((await createProduit(req("POST", { titre: "x", prix_centimes: 100 }), ctx({ id: ID }))).status).toBe(404);
    expect((await patchBoutique(req("PATCH", { nom: "x" }), ctx({ id: "pas-un-uuid" }))).status).toBe(404);
    expect(steps("boutiques", "update")).toHaveLength(0);
    expect(steps("produits", "insert")).toHaveLength(0);
    // la lecture est filtrée sur le propriétaire de la session (la RLS laisse aussi lire les boutiques publiées des autres)
    expect(steps("boutiques", "eq")).toContainEqual(["proprietaire_id", "user-a"]);
  });

  it("produit : prix négatif/décimal et injection refusés avant la base ; produit valide créé avec une variante par défaut", async () => {
    h.results.boutiques = { data: [{ id: ID }], error: null };
    for (const body of [{ titre: "x", prix_centimes: -5 }, { titre: "x", prix_centimes: 9.99 }, { titre: "<script>", prix_centimes: 5 }]) {
      expect((await createProduit(req("POST", body), ctx({ id: ID }))).status).toBe(400);
    }
    expect(steps("produits", "insert")).toHaveLength(0);
    h.results.produits = { data: [{ id: "p1" }], error: null };
    h.results.variantes = { data: [{ id: "v1", nom: "Unique" }], error: null };
    const ok = await createProduit(req("POST", { titre: "Robe", prix_centimes: 2599 }), ctx({ id: ID }));
    expect(ok.status).toBe(201);
    expect(steps("variantes", "insert")[0]![0]).toEqual([{ stock: 0, position: 0, nom: "Unique", produit_id: "p1", boutique_id: ID }]);
  });

  it("statut de commande : valeur inconnue ou « payee » refusée ; référence mal formée 404 ; aucune ligne = 404", async () => {
    expect((await patchStatut(req("PATCH", { statut: "payee" }), ctx({ id: ID, ref: "CMD-AAAA1111" }))).status).toBe(400);
    expect((await patchStatut(req("PATCH", { statut: "prete" }), ctx({ id: ID, ref: "x'; drop" }))).status).toBe(404);
    h.results.commandes = { data: [], error: null };
    expect((await patchStatut(req("PATCH", { statut: "prete" }), ctx({ id: ID, ref: "CMD-AAAA1111" }))).status).toBe(404);
    h.results.commandes = { data: null, error: { code: "P0001", message: "x", hint: "statut_invalide" } };
    expect((await patchStatut(req("PATCH", { statut: "terminee" }), ctx({ id: ID, ref: "CMD-AAAA1111" }))).status).toBe(409);
    h.results.commandes = { data: [{ ref: "CMD-AAAA1111", statut: "prete" }], error: null };
    h.results.boutiques = { data: [{ id: ID }], error: null };
    expect((await patchStatut(req("PATCH", { statut: "prete" }), ctx({ id: ID, ref: "CMD-AAAA1111" }))).status).toBe(200);
    expect(steps("commandes", "update")[0]![0]).toEqual({ statut: "prete" });
  });

  it("liste des commandes : filtre de statut validé", async () => {
    h.results.boutiques = { data: [{ id: ID }], error: null };
    expect((await listCommandes(req("GET", undefined, {}, "https://app.test/x?statut=payee"), ctx({ id: ID }))).status).toBe(400);
    expect((await listCommandes(req("GET", undefined, {}, "https://app.test/x?statut=nouvelle"), ctx({ id: ID }))).status).toBe(200);
  });
});

describe("catalogue public", () => {
  it("brouillon, inconnue ou slug invalide : 404 ; boutique publiée : catalogue sans identifiant de propriétaire", async () => {
    h.results.boutiques = { data: null, error: null };
    expect((await catalogue(req("GET", undefined, {}), ctx({ slug: "brouillon-x" }))).status).toBe(404);
    expect((await catalogue(req("GET", undefined, {}), ctx({ slug: "../etc" }))).status).toBe(404);
    h.results.boutiques = { data: [{ id: ID, slug: "chez-awa", nom: "Chez Awa" }], error: null };
    h.results.produits = { data: [{ id: "p", titre: "Robe" }], error: null };
    h.results.variantes_publiques = { data: [
      { id: "v", produit_id: "p", nom: "M", position: 0, disponible: false, stock_bas: false },
      { id: "w", produit_id: "p", nom: "L", position: 1, disponible: true, stock_bas: true },
    ], error: null };
    const r = await catalogue(req("GET", undefined, {}), ctx({ slug: "chez-awa" }));
    const body = await r.json();
    expect(r.status).toBe(200);
    expect(body.produits[0].variantes.map((v: { disponible: boolean }) => v.disponible)).toEqual([false, true]);
    expect(body.produits[0].variantes.map((v: { stock_bas: boolean }) => v.stock_bas)).toEqual([false, true]);
    expect(JSON.stringify(body)).not.toContain("stock\":"); // jamais la quantité exacte
    const select = String(steps("boutiques", "select")[0]![0]);
    expect(select).not.toContain("proprietaire_id");
    expect(steps("boutiques", "eq")).toContainEqual(["statut", "publiee"]);
  });

  it("repli avant la migration 0007 : l'ancienne lecture des variantes est convertie en booléens, le stock exact n'est jamais renvoyé", async () => {
    h.results.boutiques = { data: [{ id: ID, slug: "chez-awa", nom: "Chez Awa" }], error: null };
    h.results.produits = { data: [{ id: "p", titre: "Robe" }], error: null };
    h.results.variantes_publiques = { data: null, error: { code: "42P01", message: "relation does not exist" } };
    h.results.variantes = { data: [{ id: "v", produit_id: "p", nom: "M", stock: 0, position: 0 }, { id: "w", produit_id: "p", nom: "L", stock: 2, position: 1 }, { id: "x", produit_id: "p", nom: "XL", stock: 40, position: 2 }], error: null };
    const body = await (await catalogue(req("GET", undefined, {}), ctx({ slug: "chez-awa" }))).json();
    expect(body.produits[0].variantes).toEqual([
      { id: "v", nom: "M", position: 0, disponible: false, stock_bas: false },
      { id: "w", nom: "L", position: 1, disponible: true, stock_bas: true },
      { id: "x", nom: "XL", position: 2, disponible: true, stock_bas: false },
    ]);
    expect(JSON.stringify(body)).not.toMatch(/"stock":/);
  });
});

describe("POST /api/boutique/commande : public, anti-spam, prix ignorés", () => {
  it("n'envoie à la base que identifiants et quantités ; renvoie le jeton de suivi une seule fois", async () => {
    const r = await passerCommande(req("POST", { ...CMD, total_centimes: 1, paiement: "payee", lignes: [{ variante_id: VID, quantite: 2, prix_centimes: 1 }] }));
    expect(r.status).toBe(201);
    const args = h.rpc.mock.calls[0]!;
    expect(args[0]).toBe("boutique_creer_commande");
    expect(args[1]).toMatchObject({ p_slug: "chez-awa", p_cle: CMD.cle, p_mode: "retrait", p_lignes: [{ variante_id: VID, quantite: 2 }] });
    expect(JSON.stringify(args[1])).not.toMatch(/prix|total|payee/);
    const body = await r.json();
    expect(body.commande).toMatchObject({ ref: "CMD-AAAA1111", paiement: "non_payee" });
    expect(body.rejouee).toBe(false);
  });

  it("commande déjà reçue (même clé) : 200 et rejouee=true", async () => {
    h.rpc.mockResolvedValue({ data: { ref: "CMD-AAAA1111", statut: "nouvelle", total_centimes: 2000, paiement: "non_payee", mode: "retrait", rejouee: true }, error: null });
    const r = await passerCommande(req("POST", CMD));
    expect(r.status).toBe(200);
    expect((await r.json()).rejouee).toBe(true);
  });

  it("refus d'origine, champ piège (faux succès sans rien enregistrer), corps invalide", async () => {
    expect((await passerCommande(req("POST", CMD, { origin: "https://evil.example" }))).status).toBe(403);
    expect((await passerCommande(req("POST", CMD, {}))).status).toBe(403);
    const trap = await passerCommande(req("POST", { ...CMD, site: "http://spam.example" }));
    expect(trap.status).toBe(201);
    expect(h.rpc).not.toHaveBeenCalled();
    expect((await passerCommande(req("POST", "pas du json"))).status).toBe(400);
    expect((await passerCommande(req("POST", { ...CMD, lignes: [{ variante_id: VID, quantite: 0 }] }))).status).toBe(400);
    expect((await passerCommande(req("POST", { ...CMD, client: { nom: "A", email: "nope" } }))).status).toBe(400);
    expect(h.rpc).not.toHaveBeenCalled();
  });

  it("limite par IP : la 6e demande en une minute est refusée (429), pas celle d'une autre IP", async () => {
    const from = (ip: string) => ({ origin: ORIGIN, "x-forwarded-for": ip });
    for (let i = 0; i < 5; i++) expect((await passerCommande(req("POST", CMD, from("1.1.1.1")))).status).toBe(201);
    expect((await passerCommande(req("POST", CMD, from("1.1.1.1")))).status).toBe(429);
    expect((await passerCommande(req("POST", CMD, from("2.2.2.2")))).status).toBe(201);
  });

  it("erreurs de la base traduites : stock 409, boutique introuvable 404, autre erreur 500 sans fuite", async () => {
    h.rpc.mockResolvedValueOnce(sqlErr("E_STOCK_INSUFFISANT"));
    const s = await passerCommande(req("POST", CMD, { origin: ORIGIN, "x-forwarded-for": "3.3.3.3" }));
    expect(s.status).toBe(409);
    expect((await s.json()).code).toBe("stock_insuffisant");
    h.rpc.mockResolvedValueOnce(sqlErr("E_BOUTIQUE_INTROUVABLE"));
    expect((await passerCommande(req("POST", CMD, { origin: ORIGIN, "x-forwarded-for": "4.4.4.4" }))).status).toBe(404);
    h.rpc.mockResolvedValueOnce(sqlErr("deadlock detected on table commandes"));
    const e = await passerCommande(req("POST", CMD, { origin: ORIGIN, "x-forwarded-for": "5.5.5.5" }));
    expect(e.status).toBe(500);
    expect(JSON.stringify(await e.json())).not.toContain("deadlock");
  });

  it("sans clé serveur : 503, jamais de commande créée avec la clé anonyme", async () => {
    h.adminOk = false;
    expect((await passerCommande(req("POST", CMD))).status).toBe(503);
    expect(h.rpc).not.toHaveBeenCalled();
  });
});

describe("POST /api/boutique/suivi", () => {
  it("mauvais format = 404 sans appel ; bon couple = commande ; couple inconnu = 404", async () => {
    expect((await suivre(req("POST", { ref: "CMD-AAAA1111", jeton: "court" }))).status).toBe(404);
    expect((await suivre(req("POST", { ref: "x", jeton: "a".repeat(64) }))).status).toBe(404);
    expect(h.rpc).not.toHaveBeenCalled();
    h.rpc.mockResolvedValueOnce({ data: { ref: "CMD-AAAA1111", statut: "prete" }, error: null });
    expect((await suivre(req("POST", { ref: "CMD-AAAA1111", jeton: "a".repeat(64) }))).status).toBe(200);
    h.rpc.mockResolvedValueOnce({ data: null, error: null });
    expect((await suivre(req("POST", { ref: "CMD-AAAA1111", jeton: "b".repeat(64) }))).status).toBe(404);
    expect((await suivre(req("POST", { ref: "CMD-AAAA1111", jeton: "a".repeat(64) }, { origin: "https://evil.example" }))).status).toBe(403);
  });
});

describe("migration 0007 : création atomique, limite de débit en base, plafonds", () => {
  it("le produit et ses variantes sont créés par UNE seule fonction SQL (aucune écriture en deux temps)", async () => {
    h.results.boutiques = { data: [{ id: ID }], error: null };
    h.extra.boutique_creer_produit = { data: { id: "p1", titre: "Robe", variantes: [{ id: "v1", nom: "M", stock: 3 }] }, error: null };
    const r = await createProduit(req("POST", { titre: "Robe", prix_centimes: 2599, variantes: [{ nom: "M", stock: 3 }] }), ctx({ id: ID }));
    expect(r.status).toBe(201);
    expect((await r.json()).produit).toMatchObject({ id: "p1", variantes: [{ nom: "M", stock: 3 }] });
    expect(h.extraCalls).toEqual([["boutique_creer_produit", { p_boutique: ID, p_produit: { titre: "Robe", prix_centimes: 2599 }, p_variantes: [{ nom: "M", stock: 3 }] }]]);
    expect(steps("produits", "insert")).toHaveLength(0);
    expect(steps("variantes", "insert")).toHaveLength(0);
  });

  it("un plafond de la base devient une réponse 403 claire, une entrée refusée 400, sans repli sur l'ancien chemin", async () => {
    h.results.boutiques = { data: [{ id: ID }], error: null };
    h.extra.boutique_creer_produit = { data: null, error: { code: "P0001", message: "Limite de 500 produits", hint: "plafond_produits" } };
    const r = await createProduit(req("POST", { titre: "Robe", prix_centimes: 100 }), ctx({ id: ID }));
    expect(r.status).toBe(403);
    expect((await r.json()).code).toBe("plafond_produits");
    h.extra.boutique_creer_produit = { data: null, error: { code: "23514", message: "violates check produits_images_https" } };
    expect((await createProduit(req("POST", { titre: "Robe", prix_centimes: 100 }), ctx({ id: ID }))).status).toBe(400);
    expect(steps("produits", "insert")).toHaveLength(0);
  });

  it("limite de débit PARTAGÉE en base : refus 429 avant tout appel à la création de commande", async () => {
    h.extra.limite_debit = { data: true, error: null };
    const r = await passerCommande(req("POST", CMD, { origin: ORIGIN, "x-forwarded-for": "9.9.9.9" }));
    expect(r.status).toBe(429);
    expect((await r.json()).code).toBe("rate_limit");
    expect(h.rpc).not.toHaveBeenCalled();
    expect(h.extraCalls.some(([n, a]) => n === "limite_debit" && (a as { p_cle: string }).p_cle === "9.9.9.9")).toBe(true);
  });

  it("limite de débit absente (migration pas exécutée) : la commande passe, la limite mémoire reste active", async () => {
    h.extra.limite_debit = { data: null, error: { code: "PGRST202", message: "Could not find the function" } };
    expect((await passerCommande(req("POST", CMD, { origin: ORIGIN, "x-forwarded-for": "8.8.8.8" }))).status).toBe(201);
  });

  it("plafond de commandes « nouvelle » par contact : 429 clair ; trop d'articles : refusé avant la base", async () => {
    h.rpc.mockResolvedValueOnce(sqlErr("E_CONTACT_TROP_DE_COMMANDES"));
    const r = await passerCommande(req("POST", CMD, { origin: ORIGIN, "x-forwarded-for": "7.7.7.7" }));
    expect(r.status).toBe(429);
    expect((await r.json()).code).toBe("trop_de_commandes_contact");
    const gros = { ...CMD, lignes: [1, 2, 3].map((i) => ({ variante_id: `0000000${i}-0000-4000-8000-000000000000`, quantite: 99 })) };
    expect((await passerCommande(req("POST", gros, { origin: ORIGIN, "x-forwarded-for": "6.6.6.6" }))).status).toBe(400);
    expect(h.rpc).toHaveBeenCalledTimes(1);
  });

  it("le suivi accepte les références de 8 caractères (anciennes) et de 12 (nouvelles)", async () => {
    h.rpc.mockResolvedValue({ data: { ref: "CMD-3F9A1C2B4D5E", statut: "prete" }, error: null });
    expect((await suivre(req("POST", { ref: "CMD-3F9A1C2B4D5E", jeton: "a".repeat(64) }))).status).toBe(200);
    expect((await suivre(req("POST", { ref: "CMD-3F9A1C2B", jeton: "a".repeat(64) }))).status).toBe(200);
    expect((await suivre(req("POST", { ref: "CMD-3F9A1C2B4", jeton: "a".repeat(64) }))).status).toBe(404);
  });
});
