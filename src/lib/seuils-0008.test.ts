import { readFileSync } from "node:fs";
import { PGlite, type Transaction } from "@electric-sql/pglite";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { validateCommande, validateProduit } from "@/lib/boutique/validate";

// Seuils de la boutique et de la liste d'attente, vérifiés en SQL direct (PGlite, migrations 0001 à 0008) : pour chacun,
// N passe, N+1 est refusé. Les mêmes seuils sont aussi vérifiés côté serveur (validation d'entrée) quand elle existe.
//   3 commandes « nouvelle » / contact / 7 jours / boutique · 200 articles / commande · 500 produits / boutique ·
//   2 000 produits / compte · 50 variantes / produit · 50 catégories / boutique · 5 000 inscrits / liste d'attente
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
const FILES = ["0001_schema.sql", "0002_conformite.sql", "0003_marque_blanche.sql", "0004_limites_serveur.sql", "0005_boutique.sql", "0006_regle_gratuit.sql", "0007_durcissement.sql", "0008_suspendus_et_expiration.sql"];
const sql = (f: string) => readFileSync(`supabase/${f}`, "utf8");
const A = "00000000-0000-4000-8000-00000000000a";
type Role = "anon" | "authenticated" | "service_role";
let db: PGlite;

async function as<T = Record<string, unknown>>(role: Role, uid: string | null, query: string, params: unknown[] = []) {
  return db.transaction(async (tx: Transaction) => {
    await tx.query("select set_config('request.jwt.claim.sub', $1, true)", [uid ?? ""]);
    await tx.exec(`set local role ${role}`);
    return (await tx.query<T>(query, params)).rows;
  });
}
const q = async <T = Record<string, unknown>>(query: string, params: unknown[] = []) => (await db.query<T>(query, params)).rows;

let cle = 0;
function order(slug: string, lignes: { variante_id: string; quantite: number }[], email: string) {
  return as("service_role", null, "select public.boutique_creer_commande($1,$2,$3::jsonb,'retrait',$4::jsonb) as r", [
    slug, `cle-${String(++cle).padStart(6, "0")}-abcdefghij`, JSON.stringify({ nom: "Awa", email }), JSON.stringify(lignes),
  ]);
}
async function shop(slug: string) {
  return (await q<{ id: string }>("insert into public.boutiques (proprietaire_id, slug, nom, statut, modes) values ($1,$2,'B','publiee','{retrait}') returning id", [A, slug]))[0]!.id;
}
async function produit(boutique: string) {
  return (await q<{ id: string }>("insert into public.produits (boutique_id, titre, prix_centimes) values ($1,'P',100) returning id", [boutique]))[0]!.id;
}
const bulkProduits = (boutique: string, n: number) =>
  q("insert into public.produits (boutique_id, titre, prix_centimes) select $1, 'p' || g, 100 from generate_series(1, $2::int) g", [boutique, n]);
const addProduit = (boutique: string) => as("authenticated", A, "insert into public.produits (boutique_id, titre, prix_centimes) values ($1,'x',100) returning id", [boutique]);

beforeAll(async () => {
  db = new PGlite();
  await db.exec(SUPABASE_STUB);
  for (const f of FILES) await db.exec(sql(f));
  await q("insert into auth.users (id) values ($1)", [A]);
});
beforeEach(async () => {
  await q("delete from public.boutiques");
  await q("delete from public.sites");
  await q("delete from public.waitlist");
  await q("delete from public.limites_debit");
  await q("update public.profiles set plan = 'illimite' where id = $1", [A]);
});

describe("seuils en base (N passe, N+1 refusé)", () => {
  it("3 commandes « nouvelle » par contact sur 7 jours et par boutique : la 3e passe, la 4e est refusée ; une commande de plus de 7 jours ne compte plus", async () => {
    const b = await shop("vitrine-a");
    const p = await produit(b);
    const v = (await q<{ id: string }>("insert into public.variantes (produit_id, boutique_id, nom, stock) values ($1,$2,'M',100) returning id", [p, b]))[0]!.id;
    const l = [{ variante_id: v, quantite: 1 }];
    for (let i = 0; i < 3; i++) await order("vitrine-a", l, "awa@exemple.fr");
    await expect(order("vitrine-a", l, "awa@exemple.fr")).rejects.toThrow(/E_CONTACT_TROP_DE_COMMANDES/);
    // 8 jours plus tard, les trois premières ne comptent plus
    await q("update public.commandes set created_at = now() - interval '8 days'");
    await order("vitrine-a", l, "awa@exemple.fr");
  });

  it("200 articles par commande : 200 passent (99 + 99 + 2), 201 sont refusés sans toucher au stock", async () => {
    const b = await shop("vitrine-a");
    const p = await produit(b);
    const vs: string[] = [];
    for (const nom of ["S", "M", "L"]) vs.push((await q<{ id: string }>("insert into public.variantes (produit_id, boutique_id, nom, stock) values ($1,$2,$3,500) returning id", [p, b, nom]))[0]!.id);
    const lignes = (a: number, b2: number, c: number) => [{ variante_id: vs[0]!, quantite: a }, { variante_id: vs[1]!, quantite: b2 }, { variante_id: vs[2]!, quantite: c }];
    await expect(order("vitrine-a", lignes(99, 99, 3), "a@exemple.fr")).rejects.toThrow(/E_QUANTITE_INVALIDE/);
    expect(await q<{ s: number }>("select sum(stock)::int as s from public.variantes")).toEqual([{ s: 1500 }]);
    await order("vitrine-a", lignes(99, 99, 2), "b@exemple.fr");
    expect(await q<{ s: number }>("select sum(stock)::int as s from public.variantes")).toEqual([{ s: 1300 }]);
    // même cap quand la quantité est répartie sur la même variante (lignes regroupées : 99 max par variante)
    await expect(order("vitrine-a", [{ variante_id: vs[0]!, quantite: 60 }, { variante_id: vs[0]!, quantite: 60 }], "c@exemple.fr")).rejects.toThrow(/E_QUANTITE_INVALIDE/);
  });

  it("500 produits par boutique : le 500e passe, le 501e est refusé (navigateur et serveur)", async () => {
    const b = await shop("vitrine-a");
    await bulkProduits(b, 499);
    expect(await addProduit(b)).toHaveLength(1);
    await expect(addProduit(b)).rejects.toThrow(/500 produits/);
    await expect(as("service_role", null, "insert into public.produits (boutique_id, titre, prix_centimes) values ($1,'x',100)", [b])).rejects.toThrow(/500 produits/);
    expect(await q<{ n: number }>("select count(*)::int as n from public.produits")).toEqual([{ n: 500 }]);
  });

  it("2 000 produits par compte (boutiques cumulées) : le 2 000e passe, le 2 001e est refusé", async () => {
    const shops = [await shop("vitrine-1"), await shop("vitrine-2"), await shop("vitrine-3"), await shop("vitrine-4"), await shop("vitrine-5")];
    for (const id of shops.slice(0, 3)) await bulkProduits(id, 500);
    await bulkProduits(shops[3]!, 499);
    expect(await addProduit(shops[3]!)).toHaveLength(1); // 2 000e du compte
    await expect(addProduit(shops[4]!)).rejects.toThrow(/2000 produits/); // 2 001e, alors que cette boutique est vide
  });

  it("50 variantes par produit : la 50e passe, la 51e est refusée ; 50 catégories par boutique : idem", async () => {
    const b = await shop("vitrine-a");
    const p = await produit(b);
    await q("insert into public.variantes (produit_id, boutique_id, nom) select $1, $2, 'v' || g from generate_series(1, 49) g", [p, b]);
    const addV = () => as("authenticated", A, "insert into public.variantes (produit_id, boutique_id, nom) values ($1,$2,'derniere') returning id", [p, b]);
    expect(await addV()).toHaveLength(1);
    await expect(as("authenticated", A, "insert into public.variantes (produit_id, boutique_id, nom) values ($1,$2,'de trop')", [p, b])).rejects.toThrow(/50 variantes/);
    await q("insert into public.categories (boutique_id, nom) select $1, 'c' || g from generate_series(1, 49) g", [b]);
    expect(await as("authenticated", A, "insert into public.categories (boutique_id, nom) values ($1,'derniere') returning id", [b])).toHaveLength(1);
    await expect(as("authenticated", A, "insert into public.categories (boutique_id, nom) values ($1,'de trop')", [b])).rejects.toThrow(/50 catégories/);
  });

  it("5 000 inscriptions par liste d'attente : la 5 000e passe, la 5 001e est refusée (fonction ET insertion directe)", async () => {
    await q("insert into public.projects (user_id, id, data) values ($1,'proja1','{}'::jsonb)", [A]);
    await q("insert into public.sites (slug, user_id, project_id, data) values ('site-de-a',$1,'proja1','{}'::jsonb)", [A]);
    await q("insert into public.waitlist (slug, email) select 'site-de-a', 'u' || g || '@exemple.fr' from generate_series(1, 4999) g");
    const inscrire = (e: string) => as<{ r: string }>("service_role", null, "select public.waitlist_inscrire('site-de-a', $1) as r", [e]).then((x) => x[0]!.r);
    expect(await inscrire("derniere@exemple.fr")).toBe("ok");
    expect(await q<{ n: number }>("select count(*)::int as n from public.waitlist")).toEqual([{ n: 5000 }]);
    expect(await inscrire("de-trop@exemple.fr")).toBe("liste_pleine");
    await expect(q("insert into public.waitlist (slug, email) values ('site-de-a','direct@exemple.fr')")).rejects.toThrow(/liste d'attente de ce site est pleine/);
    expect(await q<{ n: number }>("select count(*)::int as n from public.waitlist")).toEqual([{ n: 5000 }]);
  });
});

describe("seuils côté serveur (validation d'entrée des routes)", () => {
  const id = (i: number) => `0000000${i}-0000-4000-8000-000000000000`;
  const base = { slug: "chez-awa", cle: "cle-1234567890abcdef", mode: "retrait", client: { nom: "Awa", email: "awa@exemple.fr" } };

  it("commande : 200 articles passent, 201 refusés ; 20 lignes passent, 21 refusées", () => {
    expect(validateCommande({ ...base, lignes: [{ variante_id: id(1), quantite: 99 }, { variante_id: id(2), quantite: 99 }, { variante_id: id(3), quantite: 2 }] }).ok).toBe(true);
    expect(validateCommande({ ...base, lignes: [{ variante_id: id(1), quantite: 99 }, { variante_id: id(2), quantite: 99 }, { variante_id: id(3), quantite: 3 }] }).ok).toBe(false);
    const n = (k: number) => Array.from({ length: k }, (_, i) => ({ variante_id: `0000000${i % 10}-0000-4000-8000-0000000000${String(i).padStart(2, "0")}`, quantite: 1 }));
    expect(validateCommande({ ...base, lignes: n(20) }).ok).toBe(true);
    expect(validateCommande({ ...base, lignes: n(21) }).ok).toBe(false);
  });

  it("produit : 50 variantes passent, 51 refusées", () => {
    const vs = (k: number) => Array.from({ length: k }, (_, i) => ({ nom: `v${i}`, stock: 1 }));
    expect(validateProduit({ titre: "Robe", prix_centimes: 100, variantes: vs(50) }).ok).toBe(true);
    expect(validateProduit({ titre: "Robe", prix_centimes: 100, variantes: vs(51) }).ok).toBe(false);
  });
});
