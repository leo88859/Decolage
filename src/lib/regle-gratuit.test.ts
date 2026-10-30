import { readFileSync } from "node:fs";
import { PGlite, type Transaction } from "@electric-sql/pglite";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { PLANS } from "@/lib/plans";
import { splitPublications } from "@/lib/site-lifecycle";
import type { Plan } from "@/lib/types";

// Règle Gratuit / publication : migrations 0001 à 0006 dans un vrai PostgreSQL (PGlite).
// Chaque test joue un utilisateur qui TENTE de publier depuis le navigateur (rôle « authenticated »), le serveur
// (« service_role », comme /api/sites) ou le public (« anon »).
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
const noPublish = (p: Promise<unknown>) => expect(p).rejects.toThrow(/publication en ligne n'est pas incluse/);
const tooMany = (p: Promise<unknown>) => expect(p).rejects.toThrow(/Limite de (sites publiés|boutiques)/);
const denied = (p: Promise<unknown>) => expect(p).rejects.toThrow(/permission denied|row-level security|violates|propriétaire/);
const setPlan = (uid: string, plan: Plan) => db.query("update public.profiles set plan = $2 where id = $1", [uid, plan]);
const q = async <T>(query: string, params: unknown[] = []) => (await db.query<T>(query, params)).rows;

const newShop = (uid: string, slug: string, statut = "brouillon") =>
  as<{ id: string }>("authenticated", uid, "insert into public.boutiques (proprietaire_id, slug, nom, statut) values ($1,$2,'Boutique',$3) returning id", [uid, slug, statut]);
const publishShop = (uid: string, id: string) => as("authenticated", uid, "update public.boutiques set statut = 'publiee' where id = $1 returning id", [id]);
/** Publication d'un site telle que /api/sites la fait : service_role. */
const serverSite = (uid: string, slug: string, project = slug.replace(/-/g, "")) =>
  as("service_role", null, "insert into public.sites (slug, user_id, project_id, data) values ($1,$2,$3,'{}'::jsonb) returning slug", [slug, uid, project.slice(0, 20)]);

/** Boutique complète créée par le serveur/admin : 1 produit à 10,00 € avec 1 variante (stock 5). */
async function seedShop(owner: string, slug: string, statut = "publiee") {
  const b = (await q<{ id: string }>("insert into public.boutiques (proprietaire_id, slug, nom, statut, modes) values ($1,$2,'Boutique',$3,'{retrait}') returning id", [owner, slug, statut]))[0]!.id;
  await q("insert into public.categories (boutique_id, nom) values ($1,'Habits')", [b]);
  const p = (await q<{ id: string }>("insert into public.produits (boutique_id, titre, prix_centimes) values ($1,'T-shirt',1000) returning id", [b]))[0]!.id;
  const v = (await q<{ id: string }>("insert into public.variantes (produit_id, boutique_id, nom, stock) values ($1,$2,'M',5) returning id", [p, b]))[0]!.id;
  return { id: b, variante: v };
}
let n = 0;
const order = (slug: string, variante: string) =>
  as("service_role", null, "select public.boutique_creer_commande($1,$2,$3::jsonb,'retrait',$4::jsonb) as r", [
    slug, `cle-${String(++n).padStart(6, "0")}-abcdefghij`, JSON.stringify({ nom: "Awa", email: "awa@exemple.fr" }), JSON.stringify([{ variante_id: variante, quantite: 1 }]),
  ]);

beforeAll(async () => {
  db = new PGlite();
  await db.exec(SUPABASE_STUB);
  for (const f of ["0001_schema.sql", "0002_conformite.sql", "0003_marque_blanche.sql", "0004_limites_serveur.sql", "0005_boutique.sql", "0006_regle_gratuit.sql", "0007_durcissement.sql"]) await db.exec(sql(f));
  await db.exec(sql("0006_regle_gratuit.sql")); // rejouable sans erreur
  await db.exec(sql("0007_durcissement.sql")); // rejouable sans erreur (dernière migration)
  await db.query("insert into auth.users (id) values ($1), ($2)", [A, B]);
});
beforeEach(async () => {
  await db.query("delete from public.boutiques");
  await db.query("delete from public.sites");
  await db.query("delete from public.projects");
  await setPlan(A, "gratuit");
  await setPlan(B, "gratuit");
});

describe("la base reprend les règles de plans.ts", () => {
  it("plan_max_projects et plan_can_publish sont identiques à PLANS (Gratuit : 1 projet, pas de publication)", async () => {
    for (const p of PLAN_IDS) {
      const max = (await q<{ v: number | null }>("select public.plan_max_projects($1) as v", [p]))[0]!.v;
      expect(max ?? Infinity, `maxProjets ${p}`).toBe(PLANS[p].maxProjets);
      const pub = (await q<{ v: boolean }>("select public.plan_can_publish($1) as v", [p]))[0]!.v;
      expect(pub, `publication ${p}`).toBe(PLANS[p].maxSites > 0);
      const sites = (await q<{ v: number | null }>("select public.plan_max_sites($1) as v", [p]))[0]!.v;
      expect(sites ?? Infinity, `maxSites ${p}`).toBe(PLANS[p].maxSites);
    }
  });
});

describe("(1) Gratuit : créer, enregistrer, retrouver et prévisualiser", () => {
  it("crée 1 projet et 1 boutique en brouillon avec produits, les modifie et les retrouve", async () => {
    await as("authenticated", A, "insert into public.projects (user_id, id, data) values ($1,'projet1','{}'::jsonb)", [A]);
    expect(await as("authenticated", A, `update public.projects set data = '{"v":2}'::jsonb where id = 'projet1' returning id`)).toHaveLength(1);
    const [b] = await newShop(A, "ma-boutique");
    const [p] = await as<{ id: string }>("authenticated", A, "insert into public.produits (boutique_id, titre, prix_centimes) values ($1,'Robe',2599) returning id", [b!.id]);
    await as("authenticated", A, "insert into public.variantes (produit_id, boutique_id, nom, stock) values ($1,$2,'M',3)", [p!.id, b!.id]);
    expect(await as("authenticated", A, "update public.boutiques set nom = 'Nouveau nom' where id = $1 returning id", [b!.id])).toHaveLength(1);
    expect(await as("authenticated", A, "select id from public.projects")).toHaveLength(1);
    const rows = await as<{ statut: string; nom: string }>("authenticated", A, "select statut, nom from public.boutiques");
    expect(rows).toEqual([{ statut: "brouillon", nom: "Nouveau nom" }]);
    expect(await as("authenticated", A, "select id from public.produits")).toHaveLength(1);
  });

  it("limite : 1 seul projet et 1 seule boutique pour le Gratuit (insertion directe)", async () => {
    await as("authenticated", A, "insert into public.projects (user_id, id, data) values ($1,'projet1','{}'::jsonb)", [A]);
    await expect(as("authenticated", A, "insert into public.projects (user_id, id, data) values ($1,'projet2','{}'::jsonb)", [A])).rejects.toThrow(/Limite de projets/);
    await newShop(A, "boutique-un");
    await tooMany(newShop(A, "boutique-deux"));
    expect(await q("select 1 from public.projects where user_id = $1", [A])).toHaveLength(1);
    expect(await q("select 1 from public.boutiques where proprietaire_id = $1", [A])).toHaveLength(1);
  });
});

describe("(9) aperçu : aucune URL publique n'est créée sans publication", () => {
  it("le brouillon d'un Gratuit (boutique, produits, catégories, variantes) est invisible du public ; le propriétaire le voit", async () => {
    const s = await seedShop(A, "brouillon-a", "brouillon");
    for (const t of ["boutiques", "categories", "produits", "variantes_publiques"]) { // 0007 : le public lit les variantes par la vue (sans stock)
      expect(await as("anon", null, `select 1 from public.${t}`), `anon ${t}`).toHaveLength(0);
    }
    expect(await as("authenticated", B, "select 1 from public.boutiques")).toHaveLength(0);
    expect(await as("authenticated", A, "select 1 from public.boutiques")).toHaveLength(1);
    await expect(order("brouillon-a", s.variante)).rejects.toThrow(/E_BOUTIQUE_INTROUVABLE/);
    expect(await q("select 1 from public.commandes")).toHaveLength(0);
  });

  it("aucun site n'existe tant que le serveur n'a pas publié : l'aperçu d'un projet ne crée aucune ligne dans sites", async () => {
    await as("authenticated", A, "insert into public.projects (user_id, id, data) values ($1,'projet1','{}'::jsonb)", [A]);
    expect(await q("select 1 from public.sites")).toHaveLength(0);
    expect(await as("anon", null, "select 1 from public.sites")).toHaveLength(0);
  });
});

describe("(2) Gratuit : publication impossible, même en SQL direct", () => {
  it("boutique : passer en « publiée » est refusé (navigateur) ; création directe déjà publiée aussi", async () => {
    const [b] = await newShop(A, "ma-boutique");
    await noPublish(publishShop(A, b!.id));
    await noPublish(newShop(A, "autre-boutique", "publiee"));
    expect(await q("select statut from public.boutiques")).toEqual([{ statut: "brouillon" }]);
  });

  it("boutique : le serveur (service_role) ne peut pas non plus publier pour un compte Gratuit", async () => {
    const [b] = await newShop(A, "ma-boutique");
    await noPublish(as("service_role", null, "update public.boutiques set statut = 'publiee' where id = $1", [b!.id]));
  });

  it("site : insertion par le serveur (comme /api/sites) refusée pour un compte Gratuit ; navigateur : aucun droit d'écriture", async () => {
    await noPublish(serverSite(A, "mon-site"));
    await denied(as("authenticated", A, "insert into public.sites (slug, user_id, project_id, data) values ('mon-site',$1,'p1','{}'::jsonb)", [A]));
    await denied(as("anon", null, "insert into public.sites (slug, user_id, project_id, data) values ('mon-site',$1,'p1','{}'::jsonb)", [A]));
    expect(await q("select 1 from public.sites")).toHaveLength(0);
  });

  it("site : un site existant d'un compte devenu Gratuit ne peut pas être remis en ligne (ni mis à jour sans rester suspendu)", async () => {
    await setPlan(A, "solo");
    await serverSite(A, "mon-site");
    await setPlan(A, "gratuit");
    await noPublish(as("service_role", null, "update public.sites set data = '{\"v\":2}'::jsonb where slug = 'mon-site'"));
    // suspendre, lui, est permis
    expect(await as("service_role", null, "update public.sites set suspended_at = now() where slug = 'mon-site' returning slug")).toHaveLength(1);
  });

  it("formule : un Gratuit ne peut pas se donner une formule payante pour publier", async () => {
    await denied(as("authenticated", A, "update public.profiles set plan = 'illimite' where id = $1", [A]));
    const [b] = await newShop(A, "ma-boutique");
    await noPublish(publishShop(A, b!.id));
  });
});

describe("(3)(4)(5) formules payantes : publication et quotas non dépassables par appel direct", () => {
  it("(3) Solo publie 1 boutique ; la 2e publication et un site en plus sont refusés (sites + boutiques = 1)", async () => {
    await setPlan(A, "solo");
    const [b] = await newShop(A, "ma-boutique");
    expect(await publishShop(A, b!.id)).toHaveLength(1);
    expect((await q<{ published_at: string | null }>("select published_at from public.boutiques"))[0]!.published_at).not.toBeNull();
    await tooMany(serverSite(A, "mon-site"));
    await tooMany(newShop(A, "seconde"));
  });

  it("(3) Solo publie 1 site ; une boutique ne peut plus être publiée", async () => {
    await setPlan(A, "solo");
    await serverSite(A, "mon-site");
    const [b] = await newShop(A, "ma-boutique");
    await tooMany(publishShop(A, b!.id));
  });

  it("(4) Pro : 5 sites publiés, le 6e refusé (appel direct du serveur)", async () => {
    await setPlan(A, "pro");
    for (let i = 1; i <= 5; i++) await serverSite(A, `site-numero-${i}`);
    await tooMany(serverSite(A, "site-numero-6"));
    expect(await q("select 1 from public.sites")).toHaveLength(5);
  });

  it("(4) Pro : 5 boutiques créées et publiées, la 6e refusée à la création", async () => {
    await setPlan(A, "pro");
    for (let i = 1; i <= 5; i++) {
      const [b] = await newShop(A, `boutique-n${i}x`);
      await publishShop(A, b!.id);
    }
    await tooMany(newShop(A, "boutique-n6x"));
    expect(await q("select 1 from public.boutiques where statut = 'publiee'")).toHaveLength(5);
  });

  it("(4) Pro : 3 sites + 2 boutiques publiées = 5, la 6e publication (site ou boutique) refusée", async () => {
    await setPlan(A, "pro");
    for (let i = 1; i <= 3; i++) await serverSite(A, `site-mixte-${i}`);
    for (let i = 1; i <= 2; i++) {
      const [b] = await newShop(A, `boutique-m${i}x`);
      await publishShop(A, b!.id);
    }
    await tooMany(serverSite(A, "site-mixte-4"));
    const [c] = await newShop(A, "boutique-m3x");
    await tooMany(publishShop(A, c!.id));
  });

  it("(5) Illimité : pas de plafond", async () => {
    await setPlan(A, "illimite");
    for (let i = 1; i <= 7; i++) await serverSite(A, `site-illimite-${i}`);
    expect(await q("select 1 from public.sites")).toHaveLength(7);
  });
});

describe("(6) pas d'accès aux projets et boutiques d'un autre", () => {
  it("A ne lit, ne modifie, ne publie ni ne supprime la boutique (brouillon) de B ; ne crée pas au nom de B", async () => {
    await setPlan(A, "illimite");
    await setPlan(B, "solo");
    const [b] = await newShop(B, "boutique-de-b");
    expect(await as("authenticated", A, "select id from public.boutiques where id = $1", [b!.id])).toHaveLength(0);
    expect(await as("authenticated", A, "update public.boutiques set nom = 'vol' where id = $1 returning id", [b!.id])).toHaveLength(0);
    expect(await as("authenticated", A, "update public.boutiques set statut = 'publiee' where id = $1 returning id", [b!.id])).toHaveLength(0);
    expect(await as("authenticated", A, "delete from public.boutiques where id = $1 returning id", [b!.id])).toHaveLength(0);
    await denied(as("authenticated", A, "insert into public.boutiques (proprietaire_id, slug, nom) values ($1,'faux-b','x')", [B]));
    await denied(as("authenticated", A, "update public.boutiques set proprietaire_id = $1 where id = $2", [A, b!.id]));
    expect((await q<{ nom: string; statut: string }>("select nom, statut from public.boutiques"))[0]).toEqual({ nom: "Boutique", statut: "brouillon" });
  });

  it("A ne lit pas les projets de B", async () => {
    await setPlan(B, "solo");
    await as("authenticated", B, "insert into public.projects (user_id, id, data) values ($1,'secretb','{}'::jsonb)", [B]);
    expect(await as("authenticated", A, "select id from public.projects")).toEqual([]);
  });
});

describe("rétrogradation vers Gratuit : rien n'est supprimé, plus rien de public, aucune nouvelle publication", () => {
  it("une boutique et un site publiés deviennent introuvables du public SANS attendre le webhook (ancienne URL), données conservées", async () => {
    await setPlan(A, "pro");
    const s = await seedShop(A, "vitrine-a");
    await serverSite(A, "site-de-a");
    await q("insert into public.waitlist (slug, email) values ('site-de-a','x@exemple.fr')");
    for (const t of ["boutiques", "categories", "produits", "variantes_publiques", "sites"]) expect(await as("anon", null, `select 1 from public.${t}`), `public avant ${t}`).not.toHaveLength(0);
    expect(await order("vitrine-a", s.variante)).toHaveLength(1);

    await setPlan(A, "gratuit"); // rétrogradation, webhook pas encore passé

    for (const t of ["boutiques", "categories", "produits", "variantes_publiques", "sites"]) expect(await as("anon", null, `select 1 from public.${t}`), `public après ${t}`).toHaveLength(0);
    await expect(order("vitrine-a", s.variante)).rejects.toThrow(/E_BOUTIQUE_INTROUVABLE/);
    await expect(as("anon", null, "insert into public.waitlist (slug, email) values ('site-de-a','y@exemple.fr')")).rejects.toThrow(/row-level security|permission denied/); // 0007 : plus aucune insertion directe
    // conservé : le propriétaire retrouve tout, et rien n'a été supprimé
    expect(await as("authenticated", A, "select 1 from public.boutiques")).toHaveLength(1);
    expect(await as("authenticated", A, "select 1 from public.sites")).toHaveLength(1);
    expect(await as("authenticated", A, "select 1 from public.produits")).toHaveLength(1);
    expect(await q("select 1 from public.commandes")).toHaveLength(1);
    expect(await q("select 1 from public.waitlist")).toHaveLength(1);
    expect((await q<{ stock: number }>("select stock from public.variantes"))[0]!.stock).toBe(4);
    // le propriétaire peut encore modifier, et repasser en brouillon
    expect(await as("authenticated", A, "update public.boutiques set nom = 'Renommée' returning id")).toHaveLength(1);
    expect(await as("authenticated", A, "update public.boutiques set statut = 'brouillon' returning id")).toHaveLength(1);
    // mais pas de NOUVELLE publication
    await noPublish(as("authenticated", A, "update public.boutiques set statut = 'publiee' returning id"));
    await noPublish(serverSite(A, "autre-site"));
    // après réabonnement, la boutique redevient visible (sans nouvelle action : son statut n'a pas changé) ; le brouillon repassé en brouillon, non
    await setPlan(A, "solo");
    expect(await as("anon", null, "select 1 from public.sites")).toHaveLength(1);
  });

  it("suspension posée par le serveur : non public, conservé, republication possible après réabonnement (brouillon puis publiée)", async () => {
    await setPlan(A, "pro");
    await seedShop(A, "vitrine-a");
    await setPlan(A, "solo");
    expect(await as("service_role", null, "update public.boutiques set suspended_at = now() returning id")).toHaveLength(1);
    expect(await as("anon", null, "select 1 from public.boutiques")).toHaveLength(0);
    expect(await as("anon", null, "select 1 from public.produits")).toHaveLength(0);
    expect(await as("authenticated", A, "select 1 from public.boutiques")).toHaveLength(1);
    // l'utilisateur ne peut pas lever la suspension lui-même
    await denied(as("authenticated", A, "update public.boutiques set suspended_at = null"));
    // le serveur la lève (réabonnement) : visible de nouveau
    await as("service_role", null, "update public.boutiques set suspended_at = null");
    expect(await as("anon", null, "select 1 from public.boutiques")).toHaveLength(1);
    // repasser en brouillon efface aussi la suspension (une boutique en brouillon n'est pas « suspendue »)
    await as("service_role", null, "update public.boutiques set suspended_at = now()");
    await as("authenticated", A, "update public.boutiques set statut = 'brouillon'");
    expect((await q<{ suspended_at: string | null }>("select suspended_at from public.boutiques"))[0]!.suspended_at).toBeNull();
    expect(await as("authenticated", A, "update public.boutiques set statut = 'publiee' returning id")).toHaveLength(1);
  });

  it("Pro vers Solo avec 3 boutiques publiées : toutes lisibles par leur propriétaire, aucune nouvelle publication, la limite compte les 3", async () => {
    await setPlan(A, "pro");
    for (let i = 1; i <= 3; i++) await seedShop(A, `vitrine-${i}x`);
    await setPlan(A, "solo");
    expect(await as("authenticated", A, "select 1 from public.boutiques")).toHaveLength(3);
    await tooMany(serverSite(A, "site-en-plus"));
  });
});

describe("marque blanche : colonne d'origine du droit", () => {
  it("brand_entitlements.source vaut « manuel » par défaut (le webhook ne touche que « stripe »)", async () => {
    await q("insert into public.brand_entitlements (user_id, enabled) values ($1, true)", [A]);
    expect((await q<{ source: string }>("select source from public.brand_entitlements"))[0]!.source).toBe("manuel");
    await q("delete from public.brand_entitlements");
  });
});

describe("répartition des publications à la rétrogradation (sites + boutiques sous une seule limite)", () => {
  const pub = (kind: "site" | "boutique", key: string, at: string) => ({ kind, key, published_at: at });
  it("les plus anciennes restent dans la limite, les autres sont suspendues, jamais supprimées", () => {
    const all = [pub("boutique", "b1", "2026-03-01"), pub("site", "s1", "2026-01-01"), pub("site", "s2", "2026-02-01")];
    const r = splitPublications(all, 2);
    expect(r.keep.map((p) => p.key)).toEqual(["s1", "s2"]);
    expect(r.suspend.map((p) => p.key)).toEqual(["b1"]);
    expect(splitPublications(all, PLANS.gratuit.maxSites).keep).toEqual([]);
    expect(splitPublications(all, PLANS.gratuit.maxSites).suspend).toHaveLength(3);
    expect(splitPublications(all, Infinity).suspend).toEqual([]);
  });
});
