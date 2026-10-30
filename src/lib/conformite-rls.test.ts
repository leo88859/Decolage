import { readFileSync } from "node:fs";
import { PGlite, type Transaction } from "@electric-sql/pglite";
import { beforeAll, describe, expect, it } from "vitest";

// Les migrations 0001 + 0002 exécutées dans un vrai PostgreSQL (PGlite, en mémoire), avec le même procédé
// que waitlist-rls.test.ts : seul le minimum de Supabase est reproduit (rôles anon / authenticated /
// service_role, auth.users, auth.uid(), droits par défaut larges, la RLS et les REVOKE font le tri).
const SUPABASE_STUB = `
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
const sql = (f: string) => readFileSync(`supabase/${f}`, "utf8");
const A = "00000000-0000-4000-8000-00000000000a";
const B = "00000000-0000-4000-8000-00000000000b";
type Role = "anon" | "authenticated" | "service_role";

let db: PGlite;

async function as<T = Record<string, unknown>>(role: Role, uid: string | null, query: string, params: unknown[] = []) {
  return db.transaction(async (tx: Transaction) => {
    await tx.query("select set_config('request.jwt.claim.sub', $1, true)", [uid ?? ""]);
    await tx.exec(`set local role ${role}`);
    return (await tx.query<T>(query, params)).rows;
  });
}
const fails = (p: Promise<unknown>) => expect(p).rejects.toThrow(/permission denied|row-level security|violates/);
const n = async (table: string) => (await db.query<{ n: number }>(`select count(*)::int as n from public.${table}`)).rows[0]!.n;

const DATA = JSON.stringify({ config: {}, landing: {}, pricing: null });
const project = (uid: string, id: string) => as("authenticated", uid, "insert into public.projects (user_id, id, data) values ($1, $2, '{}'::jsonb) returning id", [uid, id]);
const site = (uid: string, slug: string, projectId: string) =>
  as("service_role", null, "insert into public.sites (slug, user_id, project_id, data) values ($1, $2, $3, $4::jsonb) returning slug", [slug, uid, projectId, DATA]);

beforeAll(async () => {
  db = new PGlite();
  await db.exec(SUPABASE_STUB);
  await db.exec(sql("0001_schema.sql"));
  await db.exec(sql("0002_conformite.sql"));
  await db.query("insert into auth.users (id) values ($1), ($2)", [A, B]);
  await project(A, "proja1");
  await project(B, "projb1");
  await site(A, "site-de-a", "proja1");
  await site(B, "site-de-b", "projb1");
});

describe("projets : isolation entre deux comptes", () => {
  it("chacun ne voit que ses projets", async () => {
    expect((await as<{ id: string }>("authenticated", A, "select id from public.projects")).map((r) => r.id)).toEqual(["proja1"]);
    expect((await as<{ id: string }>("authenticated", B, "select id from public.projects")).map((r) => r.id)).toEqual(["projb1"]);
    expect(await as("anon", null, "select * from public.projects")).toEqual([]);
  });

  it("personne ne modifie, supprime ni ne crée au nom d'un autre", async () => {
    expect(await as("authenticated", B, "update public.projects set data = '{\"vol\":1}'::jsonb where id = 'proja1' returning id")).toEqual([]);
    expect(await as("authenticated", B, "delete from public.projects where id = 'proja1' returning id")).toEqual([]);
    await fails(as("authenticated", B, "insert into public.projects (user_id, id, data) values ($1, 'faux1', '{}'::jsonb)", [A]));
    expect(await n("projects")).toBe(2);
  });
});

describe("sites : écriture réservée au serveur (I-1)", () => {
  it("la lecture reste publique", async () => {
    expect((await as<{ slug: string }>("anon", null, "select slug from public.sites order by slug")).map((r) => r.slug)).toEqual(["site-de-a", "site-de-b"]);
  });

  it("un utilisateur connecté ne peut ni créer, ni modifier, ni supprimer un site, même le sien", async () => {
    await fails(as("authenticated", A, "insert into public.sites (slug, user_id, project_id, data) values ('pirate-1', $1, 'proja2', '{}'::jsonb)", [A]));
    await fails(as("authenticated", A, "update public.sites set data = '{}'::jsonb where slug = 'site-de-a'"));
    await fails(as("authenticated", A, "delete from public.sites where slug = 'site-de-a'"));
    await fails(as("authenticated", B, "update public.sites set data = '{}'::jsonb where slug = 'site-de-a'"));
    await fails(as("anon", null, "delete from public.sites"));
    expect(await n("sites")).toBe(2);
  });

  it("le serveur (service_role) peut toujours écrire", async () => {
    expect(await as("service_role", null, "update public.sites set updated_at = now() where slug = 'site-de-a' returning slug")).toHaveLength(1);
  });
});

describe("liste d'attente et suspension (I-7)", () => {
  it("un visiteur s'inscrit sur un site actif, plus sur un site suspendu", async () => {
    await as("anon", null, "insert into public.waitlist (slug, email) values ('site-de-a', 'v1@exemple.fr')");
    await as("service_role", null, "update public.sites set suspended_at = now() where slug = 'site-de-a'");
    await fails(as("anon", null, "insert into public.waitlist (slug, email) values ('site-de-a', 'v2@exemple.fr')"));
    await as("service_role", null, "update public.sites set suspended_at = null where slug = 'site-de-a'");
    await as("anon", null, "insert into public.waitlist (slug, email) values ('site-de-a', 'v3@exemple.fr')");
    expect(await n("waitlist")).toBe(2);
  });

  it("seul le propriétaire du site lit ses inscrits", async () => {
    expect(await as("authenticated", A, "select email from public.waitlist")).toHaveLength(2);
    expect(await as("authenticated", B, "select email from public.waitlist")).toEqual([]);
    expect(await as("anon", null, "select * from public.waitlist")).toEqual([]);
  });
});

describe("legal_acceptances : preuve d'acceptation", () => {
  const ins = "insert into public.legal_acceptances (user_id, document, version, contexte, renonciation_retractation, formule) values ($1, $2, $3, $4, $5, $6)";

  it("écriture serveur uniquement", async () => {
    await as("service_role", null, ins, [A, "cgu", "2026-10-29", "inscription", false, null]);
    await as("service_role", null, ins, [A, "cgv", "2026-10-29", "achat", true, "solo"]);
    await as("service_role", null, ins, [B, "cgu", "2026-10-29", "inscription", false, null]);
    await fails(as("authenticated", A, ins, [A, "cgu", "2026-10-29", "inscription", false, null]));
    await fails(as("authenticated", B, ins, [A, "cgv", "9999", "achat", true, "solo"]));
    await fails(as("anon", null, ins, [A, "cgu", "2026-10-29", "inscription", false, null]));
    expect(await n("legal_acceptances")).toBe(3);
  });

  it("lecture par le propriétaire seulement, jamais modifiable ni supprimable par lui", async () => {
    expect(await as("authenticated", A, "select document from public.legal_acceptances")).toHaveLength(2);
    expect(await as("authenticated", B, "select document from public.legal_acceptances")).toHaveLength(1);
    expect(await as("authenticated", B, "select * from public.legal_acceptances where user_id = $1", [A])).toEqual([]);
    expect(await as("anon", null, "select * from public.legal_acceptances").catch(() => [])).toEqual([]);
    await fails(as("authenticated", A, "update public.legal_acceptances set renonciation_retractation = false"));
    await fails(as("authenticated", A, "delete from public.legal_acceptances"));
    expect(await n("legal_acceptances")).toBe(3);
  });

  it("refuse un document, un contexte ou une formule inconnus", async () => {
    await fails(as("service_role", null, ins, [A, "autre", "1", "inscription", false, null]));
    await fails(as("service_role", null, ins, [A, "cgu", "1", "inconnu", false, null]));
    await fails(as("service_role", null, ins, [A, "cgv", "1", "achat", true, "gratuit"]));
    await fails(as("service_role", null, ins, [A, "cgu", "", "inscription", false, null]));
  });
});

describe("supprimer un projet dépublie son site (I-8)", () => {
  it("le site et sa liste d'attente disparaissent avec le projet", async () => {
    expect(await as("authenticated", A, "delete from public.projects where id = 'proja1' returning id")).toHaveLength(1);
    expect(await as("anon", null, "select slug from public.sites where slug = 'site-de-a'")).toEqual([]);
    expect(await n("waitlist")).toBe(0);
    expect(await as("anon", null, "select slug from public.sites where slug = 'site-de-b'")).toHaveLength(1); // l'autre compte n'est pas touché
  });

  it("supprimer un compte efface tout, preuves d'acceptation comprises", async () => {
    await db.query("delete from auth.users where id = $1", [B]);
    expect(await n("sites")).toBe(0);
    expect(await n("projects")).toBe(0);
    expect((await db.query("select * from public.legal_acceptances where user_id = $1", [B])).rows).toEqual([]);
  });
});

describe("migration", () => {
  it("peut être rejouée sans erreur ni perte de données", async () => {
    const before = await n("legal_acceptances");
    await db.exec(sql("0002_conformite.sql"));
    expect(await n("legal_acceptances")).toBe(before);
  });
});
