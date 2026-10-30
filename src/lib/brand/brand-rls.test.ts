import { readFileSync } from "node:fs";
import { PGlite, type Transaction } from "@electric-sql/pglite";
import { beforeAll, describe, expect, it } from "vitest";

// supabase/0003_marque_blanche.sql exécutée dans un vrai PostgreSQL (PGlite, en mémoire), avec DEUX comptes.
// Même méthode que waitlist-rls.test.ts : seul le minimum de Supabase est reproduit (rôles, auth.users,
// auth.uid() et les droits par défaut « tout accordé » : c'est la migration qui doit les retirer).
const SUPABASE_STUB = `
create role anon nologin;
create role authenticated nologin;
create schema auth;
create table auth.users (id uuid primary key);
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
grant usage on schema auth to anon, authenticated;
grant usage on schema public to anon, authenticated;
alter default privileges in schema public grant all on tables to anon, authenticated;
alter default privileges in schema public grant all on sequences to anon, authenticated;
alter default privileges in schema public grant all on functions to anon, authenticated;
`;
const MIGRATION = readFileSync("supabase/0003_marque_blanche.sql", "utf8");
const A = "00000000-0000-4000-8000-00000000000a";
const B = "00000000-0000-4000-8000-00000000000b";

let db: PGlite;

async function as<T = Record<string, unknown>>(role: "anon" | "authenticated", uid: string | null, sql: string, params: unknown[] = []) {
  return db.transaction(async (tx: Transaction) => {
    await tx.query("select set_config('request.jwt.claim.sub', $1, true)", [uid ?? ""]);
    await tx.exec(`set local role ${role}`);
    return (await tx.query<T>(sql, params)).rows;
  });
}
const fails = (p: Promise<unknown>) => expect(p).rejects.toThrow(/permission denied|row-level security|violates/);

const PNG = "data:image/png;base64,iVBORw0KGgo=";
const cols = "(user_id, name, color_primary, color_secondary, color_accent, color_surface, color_text, logo_data, favicon_data)";
const insertBrand = (uid: string, over: Partial<Record<string, string | null>> = {}) => {
  const v = { name: "Marque", p: "#2f5bff", s: "#0a1433", a: "#ff6b4a", f: "#f6f1e7", t: "#0b1330", logo: null, fav: null, ...over };
  return db.query(`insert into public.brand_configs ${cols} values ($1,$2,$3,$4,$5,$6,$7,$8,$9)`, [uid, v.name, v.p, v.s, v.a, v.f, v.t, v.logo, v.fav]);
};

beforeAll(async () => {
  db = new PGlite();
  await db.exec(SUPABASE_STUB);
  await db.exec(MIGRATION);
  await db.query("insert into auth.users (id) values ($1), ($2)", [A, B]);
  await insertBrand(A, { name: "Marque de A" });
  await insertBrand(B, { name: "Marque de B" });
  await db.query("insert into public.brand_entitlements (user_id, enabled, note) values ($1, true, 'accord'), ($2, false, null)", [B, A]);
});

describe("marque blanche : migration 0003 et RLS (deux comptes)", () => {
  it("chaque compte ne lit que sa marque et son droit", async () => {
    expect((await as<{ name: string }>("authenticated", A, "select name from public.brand_configs")).map((r) => r.name)).toEqual(["Marque de A"]);
    expect((await as<{ name: string }>("authenticated", B, "select name from public.brand_configs")).map((r) => r.name)).toEqual(["Marque de B"]);
    expect(await as<{ enabled: boolean }>("authenticated", A, "select enabled from public.brand_entitlements")).toEqual([{ enabled: false }]);
    expect(await as<{ enabled: boolean }>("authenticated", B, "select enabled from public.brand_entitlements")).toEqual([{ enabled: true }]);
    expect(await as("authenticated", "00000000-0000-4000-8000-0000000000cc", "select * from public.brand_configs")).toEqual([]);
  });

  it("un visiteur anonyme ne lit rien", async () => {
    await fails(as("anon", null, "select * from public.brand_configs"));
    await fails(as("anon", null, "select * from public.brand_entitlements"));
  });

  it("A ne peut ni modifier, ni supprimer, ni créer une marque (écriture réservée au serveur)", async () => {
    await fails(as("authenticated", A, "update public.brand_configs set name = 'volée' where user_id = $1", [B]));
    await fails(as("authenticated", A, "update public.brand_configs set name = 'moi' where user_id = $1", [A]));
    await fails(as("authenticated", A, "delete from public.brand_configs where user_id = $1", [B]));
    await fails(as("authenticated", A, "delete from public.brand_configs"));
    await fails(as("authenticated", A, `insert into public.brand_configs ${cols} values ($1,'x','#000000','#000000','#000000','#000000','#000000',null,null)`, [A]));
    expect((await db.query<{ name: string }>("select name from public.brand_configs where user_id = $1", [B])).rows[0]!.name).toBe("Marque de B");
  });

  it("A ne peut pas s'auto-activer le droit, ni toucher à celui de B", async () => {
    await fails(as("authenticated", A, "update public.brand_entitlements set enabled = true where user_id = $1", [A]));
    await fails(as("authenticated", A, "insert into public.brand_entitlements (user_id, enabled) values ($1, true) on conflict (user_id) do update set enabled = true", [A]));
    await fails(as("authenticated", A, "insert into public.brand_entitlements (user_id, enabled) values ($1, true)", [B]));
    await fails(as("authenticated", A, "delete from public.brand_entitlements where user_id = $1", [B]));
    await fails(as("authenticated", B, "update public.brand_entitlements set enabled = false where user_id = $1", [B]));
    expect((await db.query<{ enabled: boolean }>("select enabled from public.brand_entitlements where user_id = $1", [A])).rows[0]!.enabled).toBe(false);
    expect((await db.query<{ enabled: boolean }>("select enabled from public.brand_entitlements where user_id = $1", [B])).rows[0]!.enabled).toBe(true);
  });

  it("l'activation par SQL (côté propriétaire de la base) renseigne la date", async () => {
    await db.query("update public.brand_entitlements set enabled = true where user_id = $1", [A]);
    const row = (await db.query<{ enabled_at: string | null }>("select enabled_at from public.brand_entitlements where user_id = $1", [A])).rows[0]!;
    expect(row.enabled_at).not.toBeNull();
    await db.query("update public.brand_entitlements set enabled = false, enabled_at = null where user_id = $1", [A]);
  });

  it("les contraintes SQL refusent noms, couleurs et images invalides", async () => {
    await db.query("insert into auth.users (id) values ('00000000-0000-4000-8000-0000000000d1')");
    const U = "00000000-0000-4000-8000-0000000000d1";
    const bad = [
      { name: "" },
      { name: "x".repeat(41) },
      { name: "<script>alert(1)</script>" },
      { name: "a\u0007b" },
      { p: "red" },
      { p: "#fff" },
      { t: "#2F5BFF" }, // la base stocke en minuscules (l'API normalise)
      { a: "#ff6b4a;}" },
      { logo: "data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=" },
      { logo: "https://exemple.fr/logo.png" },
      { logo: "javascript:alert(1)" },
      { logo: "data:image/png;base64," + "A".repeat(270_001) },
      { fav: "data:image/jpeg;base64,/9j/4AAQ" },
      { fav: "data:image/png;base64," + "A".repeat(70_001) },
    ];
    for (const o of bad) await expect(insertBrand(U, o), JSON.stringify(o).slice(0, 80)).rejects.toThrow(/violates check constraint/);
    await expect(insertBrand(U, { logo: PNG, fav: PNG })).resolves.toBeDefined();
    await expect(insertBrand(U, { name: "Doublon" })).rejects.toThrow(/duplicate key|unique/);
  });

  it("supprimer un compte supprime sa marque et son droit (cascade)", async () => {
    await db.query("delete from auth.users where id = $1", [A]);
    expect((await db.query("select * from public.brand_configs where user_id = $1", [A])).rows).toHaveLength(0);
    expect((await db.query("select * from public.brand_entitlements where user_id = $1", [A])).rows).toHaveLength(0);
    expect((await db.query("select * from public.brand_configs where user_id = $1", [B])).rows).toHaveLength(1);
  });

  it("la migration peut être rejouée sans perte de données ni réouverture des droits", async () => {
    await db.exec(MIGRATION);
    expect((await db.query("select * from public.brand_configs where user_id = $1", [B])).rows).toHaveLength(1);
    await fails(as("authenticated", B, "update public.brand_configs set name = 'x'"));
    await fails(as("authenticated", B, "update public.brand_entitlements set enabled = true"));
  });
});
