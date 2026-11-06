import { readFileSync } from "node:fs";
import { PGlite, type Transaction } from "@electric-sql/pglite";
import { beforeAll, describe, expect, it } from "vitest";
import { colonneThemeAbsente, THEMES, themeOf } from "./themes";
import { validateBoutique } from "./validate";

// Thème de la vitrine : la migration 0009 dans un vrai PostgreSQL (PGlite), la validation et le repli sans la colonne.
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
let db: PGlite;

async function as<T = Record<string, unknown>>(role: "anon" | "authenticated", uid: string | null, query: string, params: unknown[] = []) {
  return db.transaction(async (tx: Transaction) => {
    await tx.query("select set_config('request.jwt.claim.sub', $1, true)", [uid ?? ""]);
    await tx.exec(`set local role ${role}`);
    return (await tx.query<T>(query, params)).rows;
  });
}

beforeAll(async () => {
  db = new PGlite();
  await db.exec(SUPABASE_STUB);
  for (const f of ["0001_schema.sql", "0002_conformite.sql", "0003_marque_blanche.sql", "0004_limites_serveur.sql", "0005_boutique.sql", "0006_regle_gratuit.sql", "0007_durcissement.sql", "0008_suspendus_et_expiration.sql"]) await db.exec(sql(f));
  await db.query("insert into auth.users (id) values ($1)", [A]);
  await db.query("update public.profiles set plan = 'illimite' where id = $1", [A]);
  // Une boutique créée AVANT la migration : elle doit garder son apparence (thème classique).
  await db.query("insert into public.boutiques (proprietaire_id, slug, nom, statut, modes) values ($1, 'avant-0009', 'Avant', 'publiee', '{retrait}')", [A]);
  await db.exec(sql("0009_theme_boutique.sql"));
  await db.exec(sql("0009_theme_boutique.sql")); // rejouable sans erreur
});

describe("migration 0009 : thème de la vitrine", () => {
  it("les boutiques existantes passent en thème classique, sans autre changement", async () => {
    const [b] = (await db.query<{ theme: string; nom: string }>("select theme, nom from public.boutiques where slug = 'avant-0009'")).rows;
    expect(b).toEqual({ theme: "classique", nom: "Avant" });
  });
  it("le propriétaire choisit un thème connu, la base refuse un thème inconnu", async () => {
    await as("authenticated", A, "update public.boutiques set theme = 'ecrin' where slug = 'avant-0009'");
    expect((await db.query<{ theme: string }>("select theme from public.boutiques where slug = 'avant-0009'")).rows[0]!.theme).toBe("ecrin");
    await expect(as("authenticated", A, "update public.boutiques set theme = 'pirate' where slug = 'avant-0009'")).rejects.toThrow(/check|violates/);
  });
  it("le public lit le thème d'une vitrine publiée", async () => {
    const rows = await as<{ theme: string }>("anon", null, "select theme from public.boutiques where slug = 'avant-0009'");
    expect(rows).toEqual([{ theme: "ecrin" }]);
  });
  it("le fichier à coller est identique à la migration", () => {
    expect(sql("A-COLLER-0009.sql")).toBe(sql("0009_theme_boutique.sql"));
  });
  it("chaque thème de la base existe dans l'application, et inversement", () => {
    const enBase = sql("0009_theme_boutique.sql").match(/theme in \(([^)]+)\)/)![1]!.match(/'([a-z]+)'/g)!.map((s) => s.slice(1, -1));
    expect(enBase.sort()).toEqual(THEMES.map((t) => t.id).sort());
  });
});

describe("thème côté application", () => {
  it("un thème inconnu ou absent donne le thème classique", () => {
    expect(themeOf(undefined)).toBe("classique");
    expect(themeOf("pirate")).toBe("classique");
    expect(themeOf("street")).toBe("street");
  });
  it("la validation accepte les thèmes connus et refuse les autres", () => {
    expect(validateBoutique({ theme: "marche" }, true)).toEqual({ ok: true, value: { theme: "marche" } });
    const r = validateBoutique({ theme: "pirate" }, true);
    expect(r.ok).toBe(false);
  });
  it("le repli ne se déclenche que si la colonne theme manque", () => {
    expect(colonneThemeAbsente({ code: "PGRST204", message: "Could not find the 'theme' column of 'boutiques' in the schema cache" })).toBe(true);
    expect(colonneThemeAbsente({ code: "42703", message: 'column boutiques.theme does not exist' })).toBe(true);
    expect(colonneThemeAbsente({ code: "42703", message: "column boutiques.nom does not exist" })).toBe(false);
    expect(colonneThemeAbsente({ code: "23514", message: "violates check constraint boutiques_theme_check" })).toBe(false);
    expect(colonneThemeAbsente(null)).toBe(false);
  });
});
