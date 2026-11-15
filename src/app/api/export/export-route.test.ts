import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

// SIMULATIONS : Supabase est remplacé par de faux clients, aucune vraie base, aucun vrai compte, aucun paiement.
// Ces tests prouvent la logique de la route ; ils ne remplacent pas une vérification sur un déploiement réel.
const h = vi.hoisted(() => ({
  cloud: true,
  user: { id: "u-a" } as { id: string } | null,
  plan: "gratuit" as string | null,
  profileError: false,
  dbLimited: false,
  rpc: [] as unknown[],
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/env", () => ({ isCloudConfigured: () => h.cloud, appUrl: () => "https://app.test" }));
const client = () => ({
  from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: h.plan === null ? null : { plan: h.plan }, error: h.profileError ? { message: "x" } : null }) }) }) }),
  rpc: async (name: string, args: unknown) => { h.rpc.push([name, args]); return { data: h.dbLimited, error: null }; },
});
vi.mock("@/lib/supabase/server", () => ({ getUser: async () => ({ supabase: client(), user: h.user }), createAdminClient: () => client() }));

import { EXPORT_BODY_MAX_BYTES, POST } from "@/app/api/export/route";
import { resetRateLimit } from "@/lib/boutique/api";
import { newProject } from "@/lib/project";
import { PLANS } from "@/lib/plans";

const ORIGIN = "https://app.test";
const req = (body: unknown, headers: Record<string, string> = {}) =>
  new Request(`${ORIGIN}/api/export`, { method: "POST", headers: { "content-type": "application/json", origin: ORIGIN, ...headers }, body: typeof body === "string" ? body : JSON.stringify(body) });
const project = (t: Parameters<typeof newProject>[0] = "crm") => newProject(t);

/** Noms des entrées d'une archive ZIP « stored » (en-têtes locaux 0x04034b50). */
function zipNames(buf: Uint8Array): string[] {
  const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  const names: string[] = [];
  for (let i = 0; i + 30 < buf.length; ) {
    if (dv.getUint32(i, true) !== 0x04034b50) break;
    const size = dv.getUint32(i + 18, true), n = dv.getUint16(i + 26, true), m = dv.getUint16(i + 28, true);
    names.push(new TextDecoder().decode(buf.slice(i + 30, i + 30 + n)));
    i += 30 + n + m + size;
  }
  return names;
}

beforeEach(() => {
  h.cloud = true; h.user = { id: "u-a" }; h.plan = "solo"; h.profileError = false; h.dbLimited = false; h.rpc = [];
  resetRateLimit();
  vi.spyOn(console, "warn").mockImplementation(() => {});
});

describe("POST /api/export (simulation)", () => {
  it("refuse un utilisateur non connecté (401)", async () => {
    h.user = null;
    const r = await POST(req({ kind: "next", project: project() }));
    expect(r.status).toBe(401);
  });

  it("refuse la formule gratuite (403), y compris avec une formule annoncée par le navigateur", async () => {
    h.plan = "gratuit";
    expect((await POST(req({ kind: "next", project: project() }))).status).toBe(403);
    // Une formule envoyée dans la requête est refusée par le schéma strict : elle n'est jamais lue.
    const r = await POST(req({ kind: "next", plan: "illimite", project: project() }));
    expect(r.status).toBe(400);
  });

  it("refuse un profil sans formule enregistrée (traité comme gratuit) et une base en erreur (503)", async () => {
    h.plan = null;
    expect((await POST(req({ kind: "archive", project: project() }))).status).toBe(403);
    h.profileError = true;
    expect((await POST(req({ kind: "archive", project: project() }))).status).toBe(503);
  });

  it.each(["solo", "pro", "illimite"])("accorde l'export à la formule %s lue en base", async (plan) => {
    h.plan = plan;
    for (const kind of ["next", "archive", "landing"]) {
      const r = await POST(req({ kind, project: project() }));
      expect(r.status).toBe(200);
    }
  });

  it("modèle premium : refusé si la formule n'a pas les modèles premium, accepté sinon", async () => {
    const saved = PLANS.solo.modelesPremium;
    try {
      PLANS.solo.modelesPremium = false; // simulation : formule payante sans modèles premium
      h.plan = "solo";
      const refused = await POST(req({ kind: "next", project: project("boutique") }));
      expect(refused.status).toBe(403);
      expect((await refused.json()).code).toBe("modele_premium");
      h.plan = "pro";
      expect((await POST(req({ kind: "next", project: project("boutique") }))).status).toBe(200);
    } finally {
      PLANS.solo.modelesPremium = saved;
    }
  });

  it("refuse un projet invalide (400)", async () => {
    const p = project();
    expect((await POST(req({ kind: "next", project: { ...p, config: { ...p.config, templateId: "inconnu" } } }))).status).toBe(400);
    expect((await POST(req({ kind: "next", project: { ...p, id: "../x" } }))).status).toBe(400);
    expect((await POST(req({ kind: "next", project: { ...p, config: { ...p.config, nom: "x".repeat(81) } } }))).status).toBe(400);
    expect((await POST(req({ kind: "zip", project: p }))).status).toBe(400);
    expect((await POST(req({ kind: "next" }))).status).toBe(400);
    expect((await POST(req("pas du json"))).status).toBe(400);
    expect((await POST(req({ kind: "next", project: p }, { "content-type": "text/plain" }))).status).toBe(415);
  });

  it("refuse une requête trop volumineuse (413), par en-tête déclaré et par taille réelle", async () => {
    const declared = await POST(req({ kind: "next", project: project() }, { "content-length": String(EXPORT_BODY_MAX_BYTES + 1) }));
    expect(declared.status).toBe(413);
    const p = project();
    const big = await POST(req({ kind: "next", project: { ...p, activity: [{ date: "x", label: "y".repeat(EXPORT_BODY_MAX_BYTES) }] } }));
    expect(big.status).toBe(413);
  });

  it("refuse une origine incorrecte ou absente (403)", async () => {
    const body = { kind: "next", project: project() };
    expect((await POST(req(body, { origin: "https://evil.example" }))).status).toBe(403);
    const noOrigin = new Request(`${ORIGIN}/api/export`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    expect((await POST(noOrigin)).status).toBe(403);
  });

  it("applique la limite de débit en mémoire (429) puis celle de la base (limite_debit)", async () => {
    const body = { kind: "archive", project: project() };
    for (let i = 0; i < 10; i++) expect((await POST(req(body))).status).toBe(200);
    expect((await POST(req(body))).status).toBe(429);
    resetRateLimit();
    h.dbLimited = true;
    const r = await POST(req(body));
    expect(r.status).toBe(429);
    expect(JSON.stringify(h.rpc)).toContain("limite_debit");
  });

  it("génère un ZIP serveur avec les bons en-têtes et le bon contenu", async () => {
    const p = project();
    const next = await POST(req({ kind: "next", project: p }));
    expect(next.headers.get("content-type")).toBe("application/zip");
    expect(next.headers.get("cache-control")).toBe("no-store");
    expect(next.headers.get("content-disposition")).toMatch(/^attachment; filename="[a-z0-9-]+-nextjs\.zip"$/);
    const names = zipNames(new Uint8Array(await next.arrayBuffer()));
    expect(names.some((n) => n.endsWith("/package.json"))).toBe(true);
    expect(names.some((n) => n.endsWith("/app/layout.tsx"))).toBe(true);

    const archive = zipNames(new Uint8Array(await (await POST(req({ kind: "archive", project: p }))).arrayBuffer()));
    expect(archive).toEqual(expect.arrayContaining(["index.html", "style.css", "prototype.html", "decollage.json", "README.md"]));
    const landing = zipNames(new Uint8Array(await (await POST(req({ kind: "landing", project: p }))).arrayBuffer()));
    expect(landing).toEqual(["index.html", "style.css"]);
  });

  it("mode local (sans Supabase) : démonstration en développement, refus en production", async () => {
    h.cloud = false;
    h.plan = "gratuit"; // sans effet : aucune base n'est lue
    expect((await POST(req({ kind: "archive", project: project() }))).status).toBe(200);
    vi.stubEnv("NODE_ENV", "production");
    try {
      expect((await POST(req({ kind: "archive", project: project() }))).status).toBe(503);
    } finally {
      vi.unstubAllEnvs();
    }
  });
});

describe("la formule ne vient jamais du navigateur", () => {
  it("la route n'importe ni localStorage, ni le store, ni use-plan, et ne lit aucune formule dans la requête", () => {
    const src = readFileSync(join(__dirname, "route.ts"), "utf8");
    expect(src).not.toMatch(/localStorage|@\/lib\/store|use-plan|useData|sessionStorage/);
    expect(src).not.toMatch(/body\.plan|\.plan\s*=\s*b\./);
    expect(src).toMatch(/from\("profiles"\)\.select\("plan"\)/);
  });
});

describe("séparation serveur / navigateur (server-only)", () => {
  const root = join(__dirname, "..", "..", "..");
  const walk = (d: string): string[] => readdirSync(d).flatMap((f) => { const p = join(d, f); return statSync(p).isDirectory() ? walk(p) : /\.(ts|tsx)$/.test(f) && !/\.test\./.test(f) ? [p] : []; });
  const files = walk(root);
  const serverOnly = files.filter((f) => /^\s*import\s+"server-only";/m.test(readFileSync(f, "utf8")));
  const imports = (src: string) => [...src.matchAll(/(?:from|import)\s+["']([^"']+)["']/g)].map((m) => m[1]!);
  const resolve = (from: string, spec: string) => (spec.startsWith("@/") ? join(root, spec.slice(2)) : spec.startsWith(".") ? join(from, "..", spec) : null);
  const isServerOnlyTarget = (target: string) => serverOnly.some((f) => { const bare = f.replace(/\.(ts|tsx)$/, ""); return bare === target || bare === join(target, "index"); });

  it("le générateur payant (codegen/index.ts et kit-*.ts) est marqué server-only", () => {
    const rel = serverOnly.map((f) => relative(root, f).replace(/\\/g, "/"));
    expect(rel).toEqual(expect.arrayContaining(["lib/codegen/index.ts", "lib/codegen/kit-ui.ts", "lib/codegen/kit-views.ts", "lib/codegen/kit-cloud.ts", "lib/codegen/kit-data.ts", "lib/codegen/kit-arch.ts", "lib/codegen/kit-rules.ts", "app/api/export/route.ts"]));
  });

  it("aucun fichier « use client » n'importe un module server-only", () => {
    const clients = files.filter((f) => /^\s*["']use client["']/.test(readFileSync(f, "utf8")));
    expect(clients.length).toBeGreaterThan(10);
    const violations: string[] = [];
    for (const f of clients) {
      for (const spec of imports(readFileSync(f, "utf8"))) {
        const target = resolve(f, spec);
        if (target && isServerOnlyTarget(target)) violations.push(`${relative(root, f)} -> ${spec}`);
      }
    }
    expect(violations).toEqual([]);
  });

  it("l'interface d'export n'importe plus le générateur Next.js ni le zip", () => {
    for (const f of ["components/project/ExportTab.tsx", "components/project/LandingTab.tsx"]) {
      const src = readFileSync(join(root, f), "utf8");
      expect(src).not.toMatch(/from "@\/lib\/codegen"/);
      expect(src).not.toMatch(/@\/lib\/zip/);
      expect(src).toMatch(/\/api\/export/);
    }
  });
});
