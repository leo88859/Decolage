import { readFileSync } from "node:fs";
import { PGlite, type Transaction } from "@electric-sql/pglite";
import { beforeAll, describe, expect, it } from "vitest";
import { WAITLIST_SQL } from "./kit-cloud";

// La migration de la liste d'attente exécutée dans un vrai PostgreSQL (PGlite, en mémoire).
// Seul le minimum de Supabase est reproduit : rôles anon / authenticated, auth.users, auth.uid()
// et les droits par défaut de Supabase (tout accordé, la RLS fait le tri). Ce test ne remplace pas
// le test sur un vrai projet Supabase, il vérifie les règles avant.
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
const A = "00000000-0000-4000-8000-00000000000a";
const B = "00000000-0000-4000-8000-00000000000b";

let db: PGlite;
let LA = "";
let LB = "";

/** Exécute une requête avec le rôle et l'utilisateur donnés, comme le ferait l'API Supabase. */
async function as<T = Record<string, unknown>>(role: "anon" | "authenticated", uid: string | null, sql: string, params: unknown[] = []) {
  return db.transaction(async (tx: Transaction) => {
    await tx.query("select set_config('request.jwt.claim.sub', $1, true)", [uid ?? ""]);
    await tx.exec(`set local role ${role}`);
    return (await tx.query<T>(sql, params)).rows;
  });
}
const fails = (p: Promise<unknown>) => expect(p).rejects.toThrow(/permission denied|row-level security|violates/);
const count = async () => (await db.query<{ n: number }>("select count(*)::int as n from public.inscriptions")).rows[0]!.n;
const inscrire = (liste: string, email: string, donnees: unknown = {}) =>
  as<{ r: string }>("anon", null, "select public.inscrire($1, $2, $3::jsonb) as r", [liste, email, JSON.stringify(donnees)]).then((x) => x[0]!.r);

beforeAll(async () => {
  db = new PGlite();
  await db.exec(SUPABASE_STUB);
  await db.exec(WAITLIST_SQL);
  await db.query("insert into auth.users (id) values ($1), ($2)", [A, B]);
  LA = (await as<{ id: string }>("authenticated", A, "insert into public.listes (nom) values ('Liste A') returning id"))[0]!.id;
  LB = (await as<{ id: string }>("authenticated", B, "insert into public.listes (nom) values ('Liste B') returning id"))[0]!.id;
});

describe("liste d'attente Supabase : migration et RLS", () => {
  it("un visiteur s'inscrit, sans doublon quelle que soit la casse", async () => {
    expect(await inscrire(LA, " Marie@Exemple.fr ", { Source: "Instagram" })).toBe("ok");
    expect(await inscrire(LA, "marie@exemple.fr")).toBe("ok"); // même réponse : rien n'est révélé
    expect(await count()).toBe(1);
    const row = (await db.query<{ email: string; donnees: { Source: string } }>("select email, donnees from public.inscriptions")).rows[0]!;
    expect(row).toEqual({ email: "marie@exemple.fr", donnees: { Source: "Instagram" } });
    // La même adresse peut s'inscrire sur une autre liste.
    expect(await inscrire(LB, "marie@exemple.fr")).toBe("ok");
    expect(await count()).toBe(2);
  });

  it("les entrées invalides sont refusées par la base", async () => {
    expect(await inscrire(LA, "pas-un-email")).toBe("email_invalide");
    expect(await inscrire(LA, "a@b")).toBe("email_invalide");
    expect(await inscrire(LA, "x".repeat(250) + "@exemple.fr")).toBe("email_invalide");
    expect(await inscrire(LA, "ok@exemple.fr", ["tableau"])).toBe("donnees_invalides");
    expect(await inscrire(LA, "ok@exemple.fr", { gros: "x".repeat(3000) })).toBe("donnees_invalides");
    expect(await inscrire("00000000-0000-4000-8000-000000000000", "ok@exemple.fr")).toBe("liste_inconnue");
    expect(await count()).toBe(2);
  });

  it("un visiteur ne peut ni lire, ni écrire directement dans les tables", async () => {
    await fails(as("anon", null, "select * from public.inscriptions"));
    await fails(as("anon", null, "select * from public.listes"));
    await fails(as("anon", null, "insert into public.inscriptions (liste_id, email) values ($1, 'pirate@exemple.fr')", [LA]));
    await fails(as("anon", null, "delete from public.inscriptions"));
  });

  it("chaque propriétaire ne voit que ses listes et ses inscriptions", async () => {
    expect((await as<{ id: string }>("authenticated", A, "select id from public.listes")).map((r) => r.id)).toEqual([LA]);
    expect((await as<{ id: string }>("authenticated", B, "select id from public.listes")).map((r) => r.id)).toEqual([LB]);
    const voitA = await as<{ liste_id: string }>("authenticated", A, "select liste_id from public.inscriptions");
    expect(voitA.map((r) => r.liste_id)).toEqual([LA]);
    expect(await as("authenticated", B, "select * from public.inscriptions where liste_id = $1", [LA])).toEqual([]);
    // Un compte sans liste ne voit rien du tout.
    expect(await as("authenticated", "00000000-0000-4000-8000-0000000000cc", "select * from public.inscriptions")).toEqual([]);
  });

  it("un propriétaire ne peut ni modifier, ni supprimer, ni s'approprier les données d'un autre", async () => {
    expect(await as("authenticated", B, "delete from public.inscriptions where liste_id = $1 returning id", [LA])).toEqual([]);
    expect(await as("authenticated", B, "update public.listes set nom = 'volée' where id = $1 returning id", [LA])).toEqual([]);
    expect(await as("authenticated", B, "delete from public.listes where id = $1 returning id", [LA])).toEqual([]);
    await fails(as("authenticated", B, "update public.listes set owner_id = $1 where id = $2", [A, LB]));
    await fails(as("authenticated", B, "insert into public.listes (owner_id, nom) values ($1, 'au nom de A')", [A]));
    await fails(as("authenticated", B, "insert into public.inscriptions (liste_id, email) values ($1, 'x@exemple.fr')", [LB]));
    await fails(as("authenticated", B, "update public.inscriptions set email = 'x@exemple.fr'"));
    expect(await count()).toBe(2);
  });

  it("le propriétaire supprime ses propres inscriptions", async () => {
    expect(await as("authenticated", A, "delete from public.inscriptions where liste_id = $1 returning id", [LA])).toHaveLength(1);
    expect(await count()).toBe(1);
  });

  it("la copie de docs/supabase-test est identique à la migration générée", () => {
    expect(readFileSync("docs/supabase-test/0001_liste_attente.sql", "utf8").replace(/\r\n/g, "\n")).toBe(WAITLIST_SQL);
  });

  it("la migration peut être rejouée sans perte de données", async () => {
    await db.exec(WAITLIST_SQL);
    expect(await count()).toBe(1);
    expect((await db.query("select * from public.listes")).rows).toHaveLength(2);
  });
});
