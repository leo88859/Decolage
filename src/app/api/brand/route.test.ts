import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { dataUrl, pngBytes } from "@/lib/brand/test-utils";
import { DEFAULT_BRAND } from "@/lib/brand/types";

// Contrôle d'accès des routes /api/brand : session, droit, Origin, corps, isolation, fausse confirmation.
// La base est simulée en mémoire (même interface que supabase-js pour les appels utilisés).

type Row = Record<string, unknown>;
const h = vi.hoisted(() => ({
  cloud: true,
  user: null as { id: string } | null,
  db: { brand_configs: [] as Row[], brand_entitlements: [] as Row[] },
  dropWrites: false,
}));

class Query {
  private filters: [string, unknown][] = [];
  private op: "select" | "insert" | "update" = "select";
  private payload: Row = {};
  constructor(private table: "brand_configs" | "brand_entitlements") {}
  select() { return this; }
  eq(c: string, v: unknown) { this.filters.push([c, v]); return this; }
  insert(p: Row) { this.op = "insert"; this.payload = p; return this; }
  update(p: Row) { this.op = "update"; this.payload = p; return this; }
  private match() { return h.db[this.table].filter((r) => this.filters.every(([c, v]) => r[c] === v)); }
  private run(): { data: unknown; error: { code?: string } | null } {
    const rows = this.match();
    if (this.op === "select") return { data: rows.map((r) => ({ ...r })), error: null };
    if (h.dropWrites) return { data: [], error: null };
    if (this.op === "insert") {
      if (h.db[this.table].some((r) => r.user_id === this.payload.user_id)) return { data: null, error: { code: "23505" } };
      h.db[this.table].push({ ...this.payload });
      return { data: null, error: null };
    }
    rows.forEach((r) => Object.assign(r, this.payload));
    return { data: rows.map((r) => ({ version: r.version })), error: null };
  }
  maybeSingle() { const r = this.run(); return Promise.resolve({ data: Array.isArray(r.data) ? (r.data[0] ?? null) : r.data, error: r.error }); }
  then<T>(res: (v: { data: unknown; error: { code?: string } | null }) => T) { return Promise.resolve(this.run()).then(res); }
}
const client = () => ({ from: (t: "brand_configs" | "brand_entitlements") => new Query(t) });

vi.mock("server-only", () => ({}));
vi.mock("@/lib/env", () => ({ isCloudConfigured: () => h.cloud, appUrl: () => "https://app.test" }));
vi.mock("@/lib/supabase/server", () => ({
  getUser: async () => ({ supabase: client(), user: h.user }),
  createAdminClient: () => client(),
}));

import { POST as restorePOST } from "./restore/route";
import { DELETE, GET, PUT } from "./route";

const A = "00000000-0000-4000-8000-00000000000a";
const B = "00000000-0000-4000-8000-00000000000b";
const ORIGIN = "https://app.test";

function req(method: string, body?: unknown, headers: Record<string, string> = { origin: ORIGIN }) {
  const hasBody = body !== undefined;
  return new Request("https://app.test/api/brand", {
    method,
    headers: { ...(hasBody ? { "content-type": "application/json" } : {}), ...headers },
    body: hasBody ? (typeof body === "string" ? body : JSON.stringify(body)) : undefined,
  });
}
const brand = (o: Record<string, unknown> = {}) => ({ ...DEFAULT_BRAND, name: "Acme", ...o });
const enable = (id: string) => h.db.brand_entitlements.push({ user_id: id, enabled: true });
const rowOf = (id: string) => h.db.brand_configs.find((r) => r.user_id === id);

beforeEach(() => {
  h.cloud = true;
  h.user = { id: A };
  h.db.brand_configs = [];
  h.db.brand_entitlements = [];
  h.dropWrites = false;
  delete process.env.WHITE_LABEL_USER_IDS;
});
afterEach(() => { delete process.env.WHITE_LABEL_USER_IDS; });

describe("sans configuration, sans session, sans droit", () => {
  it("mode démonstration : 503 et aucune écriture", async () => {
    h.cloud = false;
    expect((await GET(req("GET", undefined, {}))).status).toBe(503);
    expect((await PUT(req("PUT", brand()))).status).toBe(503);
    expect(h.db.brand_configs).toHaveLength(0);
  });

  it("sans session : 401 sur toutes les méthodes", async () => {
    h.user = null;
    enable(A);
    expect((await GET(req("GET", undefined, {}))).status).toBe(401);
    expect((await PUT(req("PUT", brand()))).status).toBe(401);
    expect((await DELETE(req("DELETE"))).status).toBe(401);
    expect((await restorePOST(req("POST"))).status).toBe(401);
    expect(h.db.brand_configs).toHaveLength(0);
  });

  it("session sans droit : 403 partout, rien n'est écrit, rien n'est lu", async () => {
    h.db.brand_configs.push({ user_id: A, name: "Secret", version: 1 });
    const g = await GET(req("GET", undefined, {}));
    expect(g.status).toBe(403);
    expect(JSON.stringify(await g.json())).not.toContain("Secret");
    expect((await PUT(req("PUT", brand()))).status).toBe(403);
    expect((await DELETE(req("DELETE"))).status).toBe(403);
    expect((await restorePOST(req("POST"))).status).toBe(403);
    expect(rowOf(A)?.name).toBe("Secret");
  });

  it("un droit désactivé (enabled=false) est refusé", async () => {
    h.db.brand_entitlements.push({ user_id: A, enabled: false });
    expect((await PUT(req("PUT", brand()))).status).toBe(403);
  });

  it("le droit d'un autre compte ne profite pas à A", async () => {
    enable(B);
    expect((await PUT(req("PUT", brand()))).status).toBe(403);
  });

  it("WHITE_LABEL_USER_IDS autorise un identifiant précis (et pas un autre)", async () => {
    process.env.WHITE_LABEL_USER_IDS = B;
    expect((await GET(req("GET", undefined, {}))).status).toBe(403);
    process.env.WHITE_LABEL_USER_IDS = `${B}, ${A}`;
    expect((await GET(req("GET", undefined, {}))).status).toBe(200);
  });
});

describe("protection CSRF (Origin)", () => {
  it("refuse une écriture sans Origin ou avec une origine étrangère", async () => {
    enable(A);
    expect((await PUT(req("PUT", brand(), {}))).status).toBe(403);
    expect((await PUT(req("PUT", brand(), { origin: "https://evil.example" }))).status).toBe(403);
    expect((await PUT(req("PUT", brand(), { origin: "null" }))).status).toBe(403);
    expect((await DELETE(req("DELETE", undefined, { origin: "https://evil.example" }))).status).toBe(403);
    expect((await restorePOST(req("POST", undefined, {}))).status).toBe(403);
    expect(h.db.brand_configs).toHaveLength(0);
  });
});

describe("enregistrement", () => {
  beforeEach(() => enable(A));

  it("GET sans marque enregistrée renvoie les valeurs par défaut", async () => {
    const r = await GET(req("GET", undefined, {}));
    const b = await r.json();
    expect(r.status).toBe(200);
    expect(b).toMatchObject({ entitled: true, saved: false, canRestore: false, brand: DEFAULT_BRAND });
  });

  it("PUT enregistre, relit et confirme", async () => {
    const r = await PUT(req("PUT", brand({ primary: "#112233" })));
    const b = await r.json();
    expect(r.status).toBe(200);
    expect(b).toMatchObject({ ok: true, saved: true, version: 1 });
    expect(b.brand.primary).toBe("#112233");
    expect(rowOf(A)).toMatchObject({ name: "Acme", color_primary: "#112233", version: 1, previous: null });
  });

  it("un user_id dans le corps est ignoré : seule la session compte", async () => {
    enable(B);
    h.db.brand_configs.push({ user_id: B, name: "Marque de B", version: 1, color_primary: "#000000", previous: null });
    const r = await PUT(req("PUT", { ...brand(), user_id: B, userId: B, user: { id: B } }));
    expect(r.status).toBe(200);
    expect(rowOf(A)?.name).toBe("Acme");
    expect(rowOf(B)).toMatchObject({ name: "Marque de B", version: 1, color_primary: "#000000" });
  });

  it("A ne lit jamais la marque de B", async () => {
    h.db.brand_configs.push({ user_id: B, name: "Marque de B", color_primary: "#000000", version: 3, previous: null });
    const b = await (await GET(req("GET", undefined, {}))).json();
    expect(JSON.stringify(b)).not.toContain("Marque de B");
    expect(b.saved).toBe(false);
  });

  it("refuse nom piégé, couleur invalide, SVG, faux PNG, avec des erreurs par champ", async () => {
    const svg = `data:image/svg+xml;base64,${Buffer.from("<svg onload=alert(1)/>").toString("base64")}`;
    const fake = `data:image/png;base64,${Buffer.from("pas un png").toString("base64")}`;
    for (const body of [brand({ name: "<script>alert(1)</script>" }), brand({ primary: "red" }), brand({ logo: svg }), brand({ logo: fake }), brand({ favicon: dataUrl("image/jpeg", new Uint8Array([0xff, 0xd8, 0xff, 0xe0])) })]) {
      const r = await PUT(req("PUT", body));
      expect(r.status).toBe(400);
      expect(Object.keys((await r.json()).errors).length).toBeGreaterThan(0);
    }
    expect(h.db.brand_configs).toHaveLength(0);
  });

  it("accepte un vrai logo PNG", async () => {
    const r = await PUT(req("PUT", brand({ logo: dataUrl("image/png", pngBytes()) })));
    expect(r.status).toBe(200);
  });

  it("corps trop gros : 413 ; type de contenu faux : 415 ; JSON cassé : 400", async () => {
    expect((await PUT(req("PUT", brand({ logo: "x".repeat(600_000) })))).status).toBe(413);
    expect((await PUT(req("PUT", "pas du json", { origin: ORIGIN, "content-type": "application/json" }))).status).toBe(400);
    expect((await PUT(req("PUT", "name=x", { origin: ORIGIN, "content-type": "text/plain" }))).status).toBe(415);
    expect(h.db.brand_configs).toHaveLength(0);
  });

  it("pas de fausse confirmation : si la base n'enregistre rien, la réponse n'est pas ok", async () => {
    h.dropWrites = true;
    const r = await PUT(req("PUT", brand()));
    expect(r.status).toBe(500);
    expect((await r.json()).ok).toBeUndefined();
  });

  it("les erreurs ne contiennent aucune donnée sensible", async () => {
    h.user = { id: A };
    const r = await PUT(req("PUT", brand({ name: "" })));
    const text = JSON.stringify(await r.json());
    expect(text).not.toMatch(/service_role|SUPABASE|stack|sql|postgres/i);
  });

  it("deuxième enregistrement : l'ancien devient récupérable, restauration puis réinitialisation", async () => {
    await PUT(req("PUT", brand({ name: "Un" })));
    expect((await (await GET(req("GET", undefined, {}))).json()).canRestore).toBe(false);
    const second = await (await PUT(req("PUT", brand({ name: "Deux" })))).json();
    expect(second).toMatchObject({ ok: true, version: 2, canRestore: true });
    expect(JSON.stringify(second)).not.toContain('"previous"');

    const back = await (await restorePOST(req("POST"))).json();
    expect(back).toMatchObject({ ok: true, version: 3 });
    expect(back.brand.name).toBe("Un");

    const reset = await (await DELETE(req("DELETE"))).json();
    expect(reset).toMatchObject({ ok: true, saved: true });
    expect(reset.brand).toEqual(DEFAULT_BRAND);

    const undo = await (await restorePOST(req("POST"))).json();
    expect(undo.brand.name).toBe("Un"); // la réinitialisation est annulable
  });

  it("restaurer sans historique : 409 ; réinitialiser sans marque : ok sans rien écrire", async () => {
    expect((await restorePOST(req("POST"))).status).toBe(409);
    const d = await DELETE(req("DELETE"));
    expect(d.status).toBe(200);
    expect(h.db.brand_configs).toHaveLength(0);
  });

  it("un instantané précédent altéré en base n'est pas restauré", async () => {
    await PUT(req("PUT", brand({ name: "Un" })));
    await PUT(req("PUT", brand({ name: "Deux" })));
    (rowOf(A)!.previous as Record<string, unknown>).name = "<script>x</script>";
    expect((await restorePOST(req("POST"))).status).toBe(409);
    expect(rowOf(A)?.name).toBe("Deux");
  });

  it("restaurer n'agit que sur le compte de la session", async () => {
    enable(B);
    h.db.brand_configs.push({ user_id: B, name: "B", color_primary: "#000000", version: 2, previous: { ...DEFAULT_BRAND, name: "B avant", version: 1 } });
    expect((await restorePOST(req("POST"))).status).toBe(409); // A n'a rien à restaurer
    expect(rowOf(B)).toMatchObject({ name: "B", version: 2 });
  });
});
