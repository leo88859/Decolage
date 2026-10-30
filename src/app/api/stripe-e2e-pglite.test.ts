import { readFileSync } from "node:fs";
import { PGlite, type Transaction } from "@electric-sql/pglite";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

// Bout en bout « webhook -> profiles.plan / brand_entitlements -> limites et droit », dans un vrai PostgreSQL en mémoire (PGlite) avec
// les migrations 0001 à 0008. Le vrai code de la route webhook s'exécute ; SEUL Stripe est simulé, et le client Supabase est
// remplacé par un petit adaptateur qui exécute les requêtes dans PGlite (jamais de base distante, jamais de réseau).
const db = vi.hoisted(() => ({ pg: null as unknown as import("@electric-sql/pglite").PGlite, stripe: { retrieve: vi.fn(), constructEvent: vi.fn(), itemDel: vi.fn() } }));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/env", () => ({
  isCloudConfigured: () => true,
  isPaymentConfigured: () => true,
  stripePrices: () => ({ solo: "price_solo", pro: "price_pro", illimite: "price_ill" }),
  stripeBrandPrice: () => "price_brand",
  stripeLegacyPrices: () => ({}),
  stripeWebhookSecret: () => "whsec_test",
}));
vi.mock("@/lib/stripe", () => ({ getStripe: () => ({ subscriptions: { retrieve: db.stripe.retrieve }, subscriptionItems: { del: db.stripe.itemDel }, webhooks: { constructEvent: db.stripe.constructEvent } }) }));

const TABLES = new Set(["profiles", "sites", "boutiques", "brand_entitlements"]);
function adapter(table: string) {
  if (!TABLES.has(table)) throw new Error(`table non prévue dans le test : ${table}`);
  let op: "select" | "insert" | "update" = "select";
  let cols = "*";
  let vals: Record<string, unknown> = {};
  const where: string[] = [];
  const params: unknown[] = [];
  const q: Record<string, unknown> = {};
  q.select = (c = "*") => { cols = c; return q; };
  q.insert = (v: Record<string, unknown>) => { op = "insert"; vals = v; return q; };
  q.update = (v: Record<string, unknown>) => { op = "update"; vals = v; return q; };
  q.eq = (c: string, v: unknown) => { params.push(v); where.push(`${c} = $${params.length}`); return q; };
  q.in = (c: string, v: unknown[]) => { params.push(v); where.push(`${c} = any($${params.length})`); return q; };
  const run = async () => {
    try {
      if (op === "insert") {
        const k = Object.keys(vals);
        await db.pg.query(`insert into public.${table} (${k.join(",")}) values (${k.map((_, i) => `$${i + 1}`).join(",")})`, k.map((c) => vals[c]));
        return { data: null, error: null };
      }
      if (op === "update") {
        const k = Object.keys(vals);
        const set = k.map((c, i) => `${c} = $${i + 1}`).join(", ");
        const w = where.map((s) => s.replace(/\$(\d+)/, (_m, n) => `$${Number(n) + k.length}`));
        await db.pg.query(`update public.${table} set ${set} ${w.length ? `where ${w.join(" and ")}` : ""}`, [...k.map((c) => vals[c]), ...params]);
        return { data: null, error: null };
      }
      const r = await db.pg.query(`select ${cols} from public.${table} ${where.length ? `where ${where.join(" and ")}` : ""}`, params);
      return { data: r.rows, error: null };
    } catch (e) {
      return { data: null, error: { message: (e as Error).message, code: (e as { code?: string }).code } };
    }
  };
  q.maybeSingle = async () => { const r = await run(); return { data: (r.data as unknown[] | null)?.[0] ?? null, error: r.error }; };
  q.then = (ok: (v: unknown) => unknown, ko?: (e: unknown) => unknown) => run().then(ok, ko);
  return q;
}
vi.mock("@/lib/supabase/server", () => ({ createAdminClient: () => ({ from: adapter }), getUser: async () => ({ supabase: { from: adapter }, user: null }) }));

import { POST as webhook } from "@/app/api/stripe/webhook/route";

const STUB = `
create role anon nologin;
create role authenticated nologin;
create role service_role nologin bypassrls;
create schema auth;
create table auth.users (id uuid primary key);
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
grant usage on schema auth to anon, authenticated, service_role;
grant usage on schema public to anon, authenticated, service_role;
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
`;
const U = "00000000-0000-4000-8000-00000000000a";

async function asUser<T = Record<string, unknown>>(sql: string, params: unknown[] = []) {
  return db.pg.transaction(async (tx: Transaction) => {
    await tx.query("select set_config('request.jwt.claim.sub', $1, true)", [U]);
    await tx.exec("set local role authenticated");
    return (await tx.query<T>(sql, params)).rows;
  });
}
const addProject = (id: string) => asUser("insert into public.projects (user_id, id, data) values ($1, $2, '{}'::jsonb) returning id", [U, id]);
const nProjects = async () => (await db.pg.query<{ n: number }>("select count(*)::int as n from public.projects where user_id = $1", [U])).rows[0]!.n;
const planInDb = async () => (await db.pg.query<{ plan: string }>("select plan from public.profiles where id = $1", [U])).rows[0]!.plan;
const brandAllowed = async () => (await asUser<{ ok: boolean }>("select public.my_white_label_allowed() as ok"))[0]!.ok;

async function event(status: string, prices: string[]) {
  db.stripe.retrieve.mockResolvedValue({ id: "sub_1", customer: "cus_1", status, metadata: { user_id: U }, items: { data: prices.map((p) => ({ id: `si_${p}`, price: { id: p } })) } });
  db.stripe.constructEvent.mockReturnValue({ id: "evt", type: "customer.subscription.updated", data: { object: { id: "sub_1" } } });
  return webhook(new Request("https://app.test/api/stripe/webhook", { method: "POST", headers: { "stripe-signature": "x" }, body: "{}" }));
}

beforeAll(async () => {
  db.pg = new PGlite();
  await db.pg.exec(STUB);
  for (const f of ["0001_schema.sql", "0002_conformite.sql", "0003_marque_blanche.sql", "0004_limites_serveur.sql", "0005_boutique.sql", "0006_regle_gratuit.sql", "0007_durcissement.sql", "0008_suspendus_et_expiration.sql"]) await db.pg.exec(readFileSync(`supabase/${f}`, "utf8"));
  await db.pg.query("insert into auth.users (id) values ($1)", [U]);
});
afterAll(async () => { await db.pg.close(); });
beforeEach(async () => {
  await db.pg.query("delete from public.projects");
  await db.pg.query("delete from public.brand_entitlements");
  await db.pg.query("update public.profiles set plan = 'gratuit', stripe_customer_id = 'cus_1', stripe_subscription_id = null, subscription_status = null where id = $1", [U]);
  db.stripe.itemDel.mockReset();
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
});

describe("webhook -> profiles.plan -> limites de projets (base réelle en mémoire)", () => {
  it("Solo : 1 projet, le deuxième est refusé par la base", async () => {
    expect((await event("active", ["price_solo"])).status).toBe(200);
    expect(await planInDb()).toBe("solo");
    await addProject("projet1");
    await expect(addProject("projet2")).rejects.toThrow(/Limite de projets/);
    expect(await nProjects()).toBe(1);
  });
  it("Solo + option : toujours 1 projet (l'option ne change aucune limite)", async () => {
    await event("active", ["price_solo", "price_brand"]);
    expect(await planInDb()).toBe("solo");
    await addProject("projet1");
    await expect(addProject("projet2")).rejects.toThrow(/Limite de projets/);
  });
  it("Pro : 5 projets, le sixième est refusé", async () => {
    await event("active", ["price_pro"]);
    expect(await planInDb()).toBe("pro");
    for (const id of ["projeta", "projetb", "projetc", "projetd", "projete"]) await addProject(id);
    await expect(addProject("projetf")).rejects.toThrow(/Limite de projets/);
    expect(await nProjects()).toBe(5);
  });
  it("Illimité : pas de limite de nombre (12 projets créés)", async () => {
    await event("active", ["price_ill"]);
    expect(await planInDb()).toBe("illimite");
    for (let i = 0; i < 12; i++) await addProject(`projet${i}`);
    expect(await nProjects()).toBe(12);
  });
  it("annulation : retour à Découverte (1 projet) ; les projets existants sont conservés, aucun nouveau au-delà", async () => {
    await event("active", ["price_ill"]);
    for (let i = 0; i < 3; i++) await addProject(`projet${i}`);
    await event("canceled", ["price_ill"]);
    expect(await planInDb()).toBe("gratuit");
    expect(await nProjects()).toBe(3);
    await expect(addProject("nouveau1")).rejects.toThrow(/Limite de projets/);
  });
});

describe("webhook -> brand_entitlements -> droit marque blanche lu par la base (my_white_label_allowed)", () => {
  it("Solo sans option : refusé ; Solo + option : accordé ; retrait : refusé ; Découverte : refusé", async () => {
    await event("active", ["price_solo"]);
    expect(await brandAllowed()).toBe(false);
    await event("active", ["price_solo", "price_brand"]);
    expect(await brandAllowed()).toBe(true);
    const row = (await db.pg.query<{ enabled: boolean; source: string }>("select enabled, source from public.brand_entitlements where user_id = $1", [U])).rows;
    expect(row).toEqual([{ enabled: true, source: "stripe" }]);
    await event("active", ["price_solo"]);
    expect(await brandAllowed()).toBe(false);
    await event("active", ["price_solo", "price_brand"]);
    expect(await brandAllowed()).toBe(true);
    await event("canceled", ["price_solo", "price_brand"]);
    expect(await brandAllowed()).toBe(false);
  });
  it("Pro et Illimité : inclus par la formule, même après retrait de la ligne option ; retour à Solo sans option : refusé", async () => {
    await event("active", ["price_solo", "price_brand"]);
    await event("active", ["price_pro", "price_brand"]);
    expect(await brandAllowed()).toBe(true);
    expect(db.stripe.itemDel).toHaveBeenCalledTimes(1);
    await event("active", ["price_ill"]);
    expect(await brandAllowed()).toBe(true);
    await event("active", ["price_solo"]);
    expect(await brandAllowed()).toBe(false);
  });
  it("droit « manuel » : jamais modifié par le webhook (Solo sans option, annulation), la base le garde", async () => {
    await db.pg.query("insert into public.brand_entitlements (user_id, enabled, source) values ($1, true, 'manuel')", [U]);
    await event("active", ["price_solo"]);
    expect(await brandAllowed()).toBe(true);
    await event("canceled", ["price_solo"]);
    const r = (await db.pg.query<{ enabled: boolean; source: string }>("select enabled, source from public.brand_entitlements where user_id = $1", [U])).rows;
    expect(r).toEqual([{ enabled: true, source: "manuel" }]);
  });
  it("rejeu : mêmes écritures, une seule ligne de droit", async () => {
    for (let i = 0; i < 3; i++) expect((await event("active", ["price_solo", "price_brand"])).status).toBe(200);
    expect((await db.pg.query("select 1 from public.brand_entitlements where user_id = $1", [U])).rows).toHaveLength(1);
  });
});
