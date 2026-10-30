import { readFileSync } from "node:fs";
import { PGlite, type Transaction } from "@electric-sql/pglite";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { PLANS, whiteLabelAllowed, type Feature } from "@/lib/plans";
import type { Plan } from "@/lib/types";

// Migrations 0001 à 0004 dans un vrai PostgreSQL (PGlite). Chaque test joue le rôle d'un utilisateur
// qui TENTE de contourner les limites de sa formule depuis le navigateur (rôle « authenticated »).
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
const PLAN_IDS: Plan[] = ["gratuit", "solo", "pro", "illimite"];

let db: PGlite;

async function as<T = Record<string, unknown>>(role: Role, uid: string | null, query: string, params: unknown[] = []) {
  return db.transaction(async (tx: Transaction) => {
    await tx.query("select set_config('request.jwt.claim.sub', $1, true)", [uid ?? ""]);
    await tx.exec(`set local role ${role}`);
    return (await tx.query<T>(query, params)).rows;
  });
}
const refused = (p: Promise<unknown>) => expect(p).rejects.toThrow(/permission denied|row-level security|violates|Limite de projets/);
const limited = (p: Promise<unknown>) => expect(p).rejects.toThrow(/Limite de projets/);
const setPlan = (uid: string, plan: string) => db.query("update public.profiles set plan = $2 where id = $1", [uid, plan]);
const add = (uid: string, id: string) => as("authenticated", uid, "insert into public.projects (user_id, id, data) values ($1, $2, '{}'::jsonb) returning id", [uid, id]);
const upsert = (uid: string, id: string) =>
  as("authenticated", uid, `insert into public.projects (user_id, id, data) values ($1, $2, '{"v":2}'::jsonb) on conflict (user_id, id) do update set data = excluded.data returning id`, [uid, id]);
const count = async (uid: string) => (await db.query<{ n: number }>("select count(*)::int as n from public.projects where user_id = $1", [uid])).rows[0]!.n;

beforeAll(async () => {
  db = new PGlite();
  await db.exec(SUPABASE_STUB);
  for (const f of ["0001_schema.sql", "0002_conformite.sql", "0003_marque_blanche.sql", "0004_limites_serveur.sql", "0005_boutique.sql", "0006_regle_gratuit.sql", "0007_durcissement.sql", "0008_suspendus_et_expiration.sql"]) await db.exec(sql(f));
  await db.exec(sql("0004_limites_serveur.sql")); // rejouable sans erreur
  await db.exec(sql("0006_regle_gratuit.sql")); // rejouable sans erreur (0006 remplace 0004 pour plan_max_projects : on la rejoue en dernier)
  await db.exec(sql("0007_durcissement.sql")); // rejouable sans erreur (dernière migration)
  await db.exec(sql("0008_suspendus_et_expiration.sql")); // rejouable sans erreur (dernière migration)
  await db.query("insert into auth.users (id) values ($1), ($2)", [A, B]);
});

beforeEach(async () => {
  await db.query("delete from public.projects");
  await db.query("delete from public.brand_entitlements");
  await setPlan(A, "gratuit");
  await setPlan(B, "gratuit");
});

describe("nombre de projets : insertion directe refusée au-delà de la limite", () => {
  it("Gratuit : 1 projet (règle du patron, 0006) ; le deuxième est refusé en insertion directe, copie comprise", async () => {
    // Ancien test : « aucune création directe (0 projet) » ; Gratuit passe à 1 projet avec la migration 0006.
    await add(A, "projet1");
    await limited(add(A, "projet2"));
    await limited(add(A, "copie-de-projet1"));
    expect(await count(A)).toBe(1);
  });

  it("Solo : 1 projet, le second est refusé (une duplication est une insertion : refusée aussi)", async () => {
    await setPlan(A, "solo");
    await add(A, "projet1");
    await limited(add(A, "projet2"));
    await limited(add(A, "copie-de-projet1"));
    expect(await count(A)).toBe(1);
  });

  it("Pro : 5 projets, le sixième est refusé", async () => {
    await setPlan(A, "pro");
    for (let i = 1; i <= 5; i++) await add(A, `projet${i}`);
    await limited(add(A, "projet6"));
    expect(await count(A)).toBe(5);
  });

  it("Illimité : pas de plafond", async () => {
    await setPlan(A, "illimite");
    for (let i = 1; i <= 8; i++) await add(A, `projet${i}`);
    expect(await count(A)).toBe(8);
  });

  it("la limite est celle du compte, pas celle d'un autre", async () => {
    await setPlan(A, "pro");
    await setPlan(B, "solo");
    await add(B, "projetb1");
    for (let i = 1; i <= 3; i++) await add(A, `projet${i}`);
    await limited(add(B, "projetb2"));
    expect(await count(A)).toBe(3);
  });

  it("un utilisateur non connecté (anon) ne crée rien", async () => {
    await refused(as("anon", null, "insert into public.projects (user_id, id, data) values ($1, 'anon1', '{}'::jsonb)", [A]));
  });

  it("le serveur (service_role) n'est pas bloqué par le trigger", async () => {
    await as("service_role", null, "insert into public.projects (user_id, id, data) values ($1, 'serveur1', '{}'::jsonb)", [A]);
    expect(await count(A)).toBe(1);
  });
});

describe("projets existants : jamais cassés par une limite", () => {
  it("après résiliation (Pro -> Gratuit) : lecture, modification, synchronisation (upsert) et suppression restent permises", async () => {
    await setPlan(A, "pro");
    await add(A, "projet1");
    await add(A, "projet2");
    await setPlan(A, "gratuit");
    expect((await as("authenticated", A, "select id from public.projects order by id")).length).toBe(2);
    expect((await as("authenticated", A, `update public.projects set data = '{"v":3}'::jsonb where id = 'projet1' returning id`)).length).toBe(1);
    expect((await upsert(A, "projet2")).length).toBe(1);
    await limited(add(A, "projet3")); // seule une NOUVELLE création est bloquée
    expect((await as("authenticated", A, "delete from public.projects where id = 'projet1' returning id")).length).toBe(1);
    expect(await count(A)).toBe(1);
  });

  it("Pro rétrogradé en Solo avec 3 projets : les 3 restent lisibles, aucun nouveau", async () => {
    await setPlan(A, "pro");
    for (let i = 1; i <= 3; i++) await add(A, `projet${i}`);
    await setPlan(A, "solo");
    expect(await count(A)).toBe(3);
    await limited(add(A, "projet4"));
  });
});

describe("isolation entre comptes (RLS)", () => {
  it("A ne lit, ne modifie ni ne supprime le projet de B ; il ne peut pas créer au nom de B", async () => {
    await setPlan(B, "solo");
    await add(B, "secretb");
    expect(await as("authenticated", A, "select id from public.projects")).toEqual([]);
    expect(await as("authenticated", A, `update public.projects set data = '{"vol":1}'::jsonb where id = 'secretb' returning id`)).toEqual([]);
    expect(await as("authenticated", A, "delete from public.projects where id = 'secretb' returning id")).toEqual([]);
    await setPlan(A, "illimite");
    await refused(as("authenticated", A, "insert into public.projects (user_id, id, data) values ($1, 'faux1', '{}'::jsonb)", [B]));
    await refused(
      as("authenticated", A, `insert into public.projects (user_id, id, data) values ($1, 'secretb', '{"vol":1}'::jsonb) on conflict (user_id, id) do update set data = excluded.data`, [B]),
    );
    expect((await db.query<{ data: unknown }>("select data from public.projects where id = 'secretb'")).rows[0]!.data).toEqual({});
  });

  it("les profils des autres ne sont pas lisibles", async () => {
    expect((await as<{ id: string }>("authenticated", A, "select id from public.profiles")).map((r) => r.id)).toEqual([A]);
  });
});

describe("formule : impossible de se l'attribuer depuis le navigateur", () => {
  it("modifier sa propre formule, ses données Stripe ou son statut d'abonnement est refusé", async () => {
    await refused(as("authenticated", A, "update public.profiles set plan = 'illimite' where id = $1", [A]));
    await refused(as("authenticated", A, "update public.profiles set plan = 'illimite'"));
    await refused(as("authenticated", A, "update public.profiles set subscription_status = 'active' where id = $1", [A]));
    await refused(as("authenticated", A, "update public.profiles set stripe_customer_id = 'cus_vol' where id = $1", [A]));
    await refused(as("anon", null, "update public.profiles set plan = 'illimite'"));
    const row = (await db.query<{ plan: string }>("select plan from public.profiles where id = $1", [A])).rows[0]!;
    expect(row.plan).toBe("gratuit");
  });

  it("modifier la formule de B, supprimer ou recréer un profil est refusé", async () => {
    await refused(as("authenticated", A, "update public.profiles set plan = 'illimite' where id = $1", [B]));
    await refused(as("authenticated", A, "delete from public.profiles where id = $1", [A]));
    await refused(as("authenticated", A, "insert into public.profiles (id, plan) values ($1, 'illimite')", [B]));
  });

  it("les favoris restent modifiables par leur propriétaire", async () => {
    expect((await as("authenticated", A, "update public.profiles set favorites = array['x'] where id = $1 returning id", [A])).length).toBe(1);
  });

  it("la formule ne peut pas être détournée pour créer des projets", async () => {
    // Le Gratuit a 1 projet (0006) : le deuxième reste refusé même après une tentative de s'attribuer Illimité.
    await add(A, "projet1");
    await refused(as("authenticated", A, "update public.profiles set plan = 'illimite' where id = $1", [A]));
    await limited(add(A, "projet2"));
  });
});

describe("marque blanche : droit lié à la formule", () => {
  const allowed = async (uid: string) => (await as<{ ok: boolean }>("authenticated", uid, "select public.my_white_label_allowed() as ok"))[0]!.ok;

  it("activer son propre droit depuis le navigateur est refusé", async () => {
    await refused(as("authenticated", A, "insert into public.brand_entitlements (user_id, enabled) values ($1, true)", [A]));
    await refused(as("authenticated", A, "update public.brand_entitlements set enabled = true where user_id = $1", [A]));
    await refused(as("anon", null, "insert into public.brand_entitlements (user_id, enabled) values ($1, true)", [A]));
    expect(await allowed(A)).toBe(false);
  });

  it("écrire une marque directement est refusé (seule l'API serveur écrit)", async () => {
    await refused(
      as("authenticated", A, "insert into public.brand_configs (user_id, name, color_primary, color_secondary, color_accent, color_surface, color_text) values ($1, 'M', '#2f5bff', '#0a1433', '#ff6b4a', '#f6f1e7', '#0b1330')", [A]),
    );
  });

  it("Gratuit : refusé, même avec un droit activé par erreur", async () => {
    await db.query("insert into public.brand_entitlements (user_id, enabled) values ($1, true)", [A]);
    expect(await allowed(A)).toBe(false);
    expect(whiteLabelAllowed("gratuit", true)).toBe(false);
  });

  it("Solo : seulement avec l'option ; Pro et Illimité : inclus", async () => {
    await setPlan(A, "solo");
    expect(await allowed(A)).toBe(false);
    await db.query("insert into public.brand_entitlements (user_id, enabled) values ($1, true)", [A]);
    expect(await allowed(A)).toBe(true);
    await setPlan(B, "pro");
    expect(await allowed(B)).toBe(true);
    await setPlan(B, "illimite");
    expect(await allowed(B)).toBe(true);
    expect(whiteLabelAllowed("solo", false)).toBe(false);
    expect(whiteLabelAllowed("solo", true)).toBe(true);
    expect(whiteLabelAllowed("pro", false)).toBe(true);
    expect(whiteLabelAllowed("illimite", false)).toBe(true);
  });
});

describe("export et fonctions premium : droit lu côté base", () => {
  const FEATURES: Feature[] = ["modelesPremium", "exportFichiers", "duplication", "personnalisationAvancee", "plansDetailles"];
  const allows = async (uid: string, f: string) => (await as<{ ok: boolean }>("authenticated", uid, "select public.my_plan_allows($1) as ok", [f]))[0]!.ok;

  it("Gratuit : export et duplication refusés ; formule payante : accordés", async () => {
    expect(await allows(A, "exportFichiers")).toBe(false);
    expect(await allows(A, "duplication")).toBe(false);
    await setPlan(A, "solo");
    expect(await allows(A, "exportFichiers")).toBe(true);
    expect(await allows(A, "duplication")).toBe(true);
  });

  it("une fonction inconnue n'est jamais accordée", async () => {
    await setPlan(A, "illimite");
    expect(await allows(A, "n_importe_quoi")).toBe(false);
  });

  it("la base et src/lib/plans.ts disent la même chose pour chaque formule", async () => {
    for (const plan of PLAN_IDS) {
      const max = (await db.query<{ m: number | null }>("select public.plan_max_projects($1) as m", [plan])).rows[0]!.m;
      expect(max ?? Infinity, `maxProjets ${plan}`).toBe(PLANS[plan].maxProjets);
      for (const f of FEATURES) {
        const ok = (await db.query<{ ok: boolean }>("select public.plan_allows($1, $2) as ok", [plan, f])).rows[0]!.ok;
        expect(ok, `${plan}.${f}`).toBe(PLANS[plan][f]);
      }
    }
  });
});
