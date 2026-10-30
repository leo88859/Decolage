import { readFileSync } from "node:fs";
import { PGlite, type Transaction } from "@electric-sql/pglite";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";

// Migration 0007 (durcissement) dans un vrai PostgreSQL (PGlite) : chaque test reproduit un problème de l'audit.
// Preuve que les tests échouent SANS la correction : `SANS_0007=1 npx vitest run src/lib/durcissement-0007.test.ts`
// (les migrations 0001 à 0006 seules sont chargées).
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
const q = async <T = Record<string, unknown>>(query: string, params: unknown[] = []) => (await db.query<T>(query, params)).rows;
const DENIED = /permission denied|row-level security/;
const setPlan = (uid: string, plan: string) => db.query("update public.profiles set plan = $2 where id = $1", [uid, plan]);

let n = 0;
const key = () => `cle-${String(++n).padStart(6, "0")}-abcdefghij`;
const CLIENT = { nom: "Awa Diop", email: "awa@exemple.fr", telephone: "+221770000000" };
function order(slug: string, lignes: unknown[], over: { cle?: string; client?: unknown } = {}) {
  return as<{ r: Record<string, unknown> }>("service_role", null, "select public.boutique_creer_commande($1,$2,$3::jsonb,'retrait',$4::jsonb) as r", [
    slug, over.cle ?? key(), JSON.stringify(over.client ?? CLIENT), JSON.stringify(lignes),
  ]).then((rows) => rows[0]!.r);
}
const stock = async (v: string) => (await q<{ stock: number }>("select stock from public.variantes where id = $1", [v]))[0]!.stock;

type Shop = { id: string; produit: string; variante: string };
async function seed(owner: string, slug: string, stk = 100): Promise<Shop> {
  const b = (await q<{ id: string }>("insert into public.boutiques (proprietaire_id, slug, nom, statut, modes) values ($1,$2,$3,'publiee','{retrait,livraison,contact}') returning id", [owner, slug, `Boutique ${slug}`]))[0]!.id;
  const p = (await q<{ id: string }>("insert into public.produits (boutique_id, titre, prix_centimes) values ($1,'T-shirt',1000) returning id", [b]))[0]!.id;
  const v = (await q<{ id: string }>("insert into public.variantes (produit_id, boutique_id, nom, stock) values ($1,$2,'M',$3) returning id", [p, b, stk]))[0]!.id;
  return { id: b, produit: p, variante: v };
}
async function seedSite(owner: string, slug: string) {
  await q("insert into public.projects (user_id, id, data) values ($1,$2,'{}'::jsonb) on conflict do nothing", [owner, `p-${slug}`]);
  await q("insert into public.sites (slug, user_id, project_id, data) values ($1,$2,$3,'{\"a\":1}'::jsonb)", [slug, owner, `p-${slug}`]);
}

beforeAll(async () => {
  db = new PGlite();
  await db.exec(SUPABASE_STUB);
  const files = ["0001_schema.sql", "0002_conformite.sql", "0003_marque_blanche.sql", "0004_limites_serveur.sql", "0005_boutique.sql", "0006_regle_gratuit.sql"];
  if (process.env.SANS_0007 !== "1") files.push("0007_durcissement.sql");
  for (const f of files) await db.exec(sql(f));
  await q("insert into auth.users (id) values ($1), ($2)", [A, B]);
});
beforeEach(async () => {
  await q("delete from public.boutiques");
  await q("delete from public.sites");
  await q("delete from public.projects");
  await q("delete from public.waitlist");
  if (process.env.SANS_0007 !== "1") await q("delete from public.limites_debit");
  await setPlan(A, "illimite");
  await setPlan(B, "illimite");
});

describe("1. liste d'attente : plus d'insertion directe, réponse identique, plafonds", () => {
  it("anon et authenticated ne peuvent plus insérer (ni lire en anon) : le spam direct par PostgREST est fermé", async () => {
    await seedSite(A, "site-de-a");
    await expect(as("anon", null, "insert into public.waitlist (slug, email) values ('site-de-a','spam@exemple.fr')")).rejects.toThrow(DENIED);
    await expect(as("authenticated", B, "insert into public.waitlist (slug, email) values ('site-de-a','spam@exemple.fr')")).rejects.toThrow(DENIED);
    await expect(as("anon", null, "select email from public.waitlist")).rejects.toThrow(DENIED);
    expect(await q("select 1 from public.waitlist")).toHaveLength(0);
  });

  it("l'inscription passe par waitlist_inscrire : un doublon donne EXACTEMENT la même réponse que l'inscription (rien n'est révélé)", async () => {
    await seedSite(A, "site-de-a");
    const inscrire = (slug: string, email: string) => as<{ r: string }>("service_role", null, "select public.waitlist_inscrire($1,$2) as r", [slug, email]).then((x) => x[0]!.r);
    expect(await inscrire("site-de-a", " Marie@Exemple.fr ")).toBe("ok");
    expect(await inscrire("site-de-a", "marie@exemple.fr")).toBe("ok"); // doublon : même réponse
    expect(await q("select email from public.waitlist")).toEqual([{ email: "marie@exemple.fr" }]);
    expect(await inscrire("site-de-a", "pas-un-email")).toBe("email_invalide");
    expect(await inscrire("site-de-a", "a@b")).toBe("email_invalide");
    expect(await inscrire("site-inconnu", "x@exemple.fr")).toBe("site_inconnu");
    // site suspendu ou compte Gratuit : introuvable, comme la page publique
    await q("update public.sites set suspended_at = now()");
    expect(await inscrire("site-de-a", "autre@exemple.fr")).toBe("site_inconnu");
    await q("update public.sites set suspended_at = null");
    await setPlan(A, "gratuit");
    expect(await inscrire("site-de-a", "autre@exemple.fr")).toBe("site_inconnu");
    expect(await q("select 1 from public.waitlist")).toHaveLength(1);
    // la fonction n'est pas appelable depuis le navigateur
    await expect(as("anon", null, "select public.waitlist_inscrire('site-de-a','x@exemple.fr')")).rejects.toThrow(DENIED);
    await expect(as("authenticated", B, "select public.waitlist_inscrire('site-de-a','x@exemple.fr')")).rejects.toThrow(DENIED);
  });

  it("le propriétaire du site lit et supprime ses inscrits (inchangé) ; un autre compte ne voit rien", async () => {
    await seedSite(A, "site-de-a");
    await as("service_role", null, "select public.waitlist_inscrire('site-de-a','x@exemple.fr')");
    expect(await as("authenticated", A, "select email from public.waitlist")).toEqual([{ email: "x@exemple.fr" }]);
    expect(await as("authenticated", B, "select email from public.waitlist")).toEqual([]);
    expect(await as("authenticated", B, "delete from public.waitlist returning id")).toEqual([]);
    expect(await as("authenticated", A, "delete from public.waitlist returning id")).toHaveLength(1);
  });

  it("format d'e-mail en base (minuscules) pour toute écriture ; contrainte « not valid » : les lignes existantes ne sont pas contrôlées", async () => {
    await seedSite(A, "site-de-a");
    await expect(q("insert into public.waitlist (slug, email) values ('site-de-a','pas-un-email')")).rejects.toThrow(/violates/);
    await expect(q("insert into public.waitlist (slug, email) values ('site-de-a','Majuscule@Exemple.fr')")).rejects.toThrow(/violates/);
    const c = await q<{ convalidated: boolean }>("select convalidated from pg_constraint where conname = 'waitlist_email_format'");
    expect(c).toEqual([{ convalidated: false }]);
  });

  it("plafond de 5000 inscrits par site : même réponse pour une nouvelle adresse et un doublon, insertion directe refusée", async () => {
    await seedSite(A, "site-de-a");
    await q("insert into public.waitlist (slug, email) select 'site-de-a', 'u' || g || '@exemple.fr' from generate_series(1, 5000) g");
    const inscrire = (email: string) => as<{ r: string }>("service_role", null, "select public.waitlist_inscrire('site-de-a',$1) as r", [email]).then((x) => x[0]!.r);
    expect(await inscrire("nouveau@exemple.fr")).toBe("liste_pleine");
    expect(await inscrire("u1@exemple.fr")).toBe("liste_pleine"); // un doublon ne se distingue pas
    await expect(q("insert into public.waitlist (slug, email) values ('site-de-a','encore@exemple.fr')")).rejects.toThrow(/pleine/);
    expect(await q("select 1 from public.waitlist")).toHaveLength(5000);
  });

  it("limite de débit en base : fenêtre fixe, clé hachée, réservée au serveur", async () => {
    const hit = () => as<{ r: boolean }>("service_role", null, "select public.limite_debit('test','1.2.3.4',3,60) as r").then((x) => x[0]!.r);
    expect([await hit(), await hit(), await hit(), await hit(), await hit()]).toEqual([false, false, false, true, true]);
    const other = await as<{ r: boolean }>("service_role", null, "select public.limite_debit('test','5.6.7.8',3,60) as r");
    expect(other[0]!.r).toBe(false); // autre clé = autre compteur
    expect(JSON.stringify(await q("select cle from public.limites_debit"))).not.toContain("1.2.3.4"); // jamais l'adresse en clair
    await expect(as("anon", null, "select public.limite_debit('t','k',3,60)")).rejects.toThrow(DENIED);
    await expect(as("authenticated", A, "select public.limite_debit('t','k',3,60)")).rejects.toThrow(DENIED);
    await expect(as("authenticated", A, "select * from public.limites_debit")).rejects.toThrow(DENIED);
    await expect(as("service_role", null, "select public.limite_debit('t','k',0,60)")).rejects.toThrow(/E_LIMITE_PARAMETRES/);
  });
});

describe("2. commandes sans paiement : plafonds, expiration, référence", () => {
  it("quantité totale plafonnée à 200 articles par commande (avant tout accès au stock)", async () => {
    const s = await seed(A, "vitrine-a", 1000);
    const ids = ["00000000-0000-4000-8000-0000000000f1", "00000000-0000-4000-8000-0000000000f2", "00000000-0000-4000-8000-0000000000f3"];
    await expect(order("vitrine-a", ids.map((variante_id) => ({ variante_id, quantite: 99 })))).rejects.toThrow(/E_QUANTITE_INVALIDE/);
    expect(await stock(s.variante)).toBe(1000);
    expect(await q("select 1 from public.commandes")).toHaveLength(0);
  });

  it("une quantité non numérique donne E_QUANTITE_INVALIDE, jamais une erreur brute", async () => {
    const s = await seed(A, "vitrine-a");
    for (const quantite of ["abc", {}, true, [], 1e30, "1; drop table x"]) {
      await expect(order("vitrine-a", [{ variante_id: s.variante, quantite: 1 }, { variante_id: s.variante, quantite }])).rejects.toThrow(/E_QUANTITE_INVALIDE/);
    }
    await expect(order("vitrine-a", [{ variante_id: s.variante, quantite: 1 }, "texte", 5, null])).rejects.toThrow(/E_QUANTITE_INVALIDE/);
    await expect(order("vitrine-a", [{ variante_id: 42, quantite: 1 }])).rejects.toThrow(/E_QUANTITE_INVALIDE/);
    await expect(order("vitrine-a", { variante_id: s.variante, quantite: 1 } as unknown as unknown[])).rejects.toThrow(/E_QUANTITE_INVALIDE/);
  });

  it("au plus 3 commandes « nouvelle » par contact et par boutique (e-mail ou téléphone normalisé), le stock n'est pas bloqué à l'infini", async () => {
    const s = await seed(A, "vitrine-a");
    const o = await seed(B, "vitrine-b");
    const l = [{ variante_id: s.variante, quantite: 1 }];
    await order("vitrine-a", l, { client: { nom: "A", email: "awa@exemple.fr" } });
    await order("vitrine-a", l, { client: { nom: "A", email: "AWA+promo@Exemple.fr" } }); // même contact après normalisation
    await order("vitrine-a", l, { client: { nom: "A", email: "awa@exemple.fr", telephone: "+221 77 000 00 00" } });
    await expect(order("vitrine-a", l, { client: { nom: "A", email: "awa@exemple.fr" } })).rejects.toThrow(/E_CONTACT_TROP_DE_COMMANDES/);
    expect(await stock(s.variante)).toBe(97);
    // un autre contact, une autre boutique : autorisés
    await order("vitrine-a", l, { client: { nom: "C", email: "autre@exemple.fr" } });
    await order("vitrine-b", [{ variante_id: o.variante, quantite: 1 }], { client: { nom: "A", email: "awa@exemple.fr" } });
    // une commande confirmée ne compte plus
    const first = (await q<{ ref: string }>("select ref from public.commandes where boutique_id = $1 order by created_at limit 1", [s.id]))[0]!.ref;
    await q("update public.commandes set statut = 'confirmee' where ref = $1", [first]);
    await order("vitrine-a", l, { client: { nom: "A", email: "awa@exemple.fr" } });
  });

  it("le même numéro de téléphone écrit de trois façons compte pour un seul contact (sans e-mail)", async () => {
    const s = await seed(A, "vitrine-a");
    const l = [{ variante_id: s.variante, quantite: 1 }];
    for (const telephone of ["+221 77 000 00 01", "077-000-00-01", "77 000 00 01"]) await order("vitrine-a", l, { client: { nom: "T", telephone } });
    await expect(order("vitrine-a", l, { client: { nom: "T", telephone: "+221770000001" } })).rejects.toThrow(/E_CONTACT_TROP_DE_COMMANDES/);
    await order("vitrine-a", l, { client: { nom: "T", telephone: "+221770000002" } });
  });

  it("le rejeu d'une commande déjà reçue reste possible même quand le plafond du contact est atteint", async () => {
    const s = await seed(A, "vitrine-a");
    const l = [{ variante_id: s.variante, quantite: 1 }];
    const cle = key();
    const c = { nom: "A", email: "awa@exemple.fr" };
    const first = await order("vitrine-a", l, { cle, client: c });
    await order("vitrine-a", l, { client: c });
    await order("vitrine-a", l, { client: c });
    await expect(order("vitrine-a", l, { client: c })).rejects.toThrow(/E_CONTACT_TROP_DE_COMMANDES/);
    expect(await order("vitrine-a", l, { cle, client: c })).toMatchObject({ ref: first.ref, rejouee: true });
  });

  it("« 100 par heure » : compté sous verrou de boutique (la 101e est refusée, y compris envoyée en parallèle)", async () => {
    const s = await seed(A, "vitrine-a");
    await q(`insert into public.commandes (ref, boutique_id, cle_idempotence, client_nom, client_email, mode, jeton_hash)
             select 'CMD-' || lpad(g::text, 12, '0'), $1, 'cle-' || lpad(g::text, 12, '0'), 'x', 'x' || g || '@exemple.fr', 'retrait', 'h' from generate_series(1, 99) g`, [s.id]);
    const res = await Promise.allSettled([1, 2, 3].map((i) => order("vitrine-a", [{ variante_id: s.variante, quantite: 1 }], { client: { nom: "A", email: `p${i}@exemple.fr` } })));
    expect(res.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(res.filter((r) => r.status === "rejected")).toHaveLength(2);
    expect(await q("select 1 from public.commandes")).toHaveLength(100);
  });

  it("expiration : les « nouvelle » trop anciennes sont annulées, stock remis UNE seule fois ; les autres statuts et les récentes restent", async () => {
    const s = await seed(A, "vitrine-a");
    const vieille = await order("vitrine-a", [{ variante_id: s.variante, quantite: 4 }], { client: { nom: "A", email: "a1@exemple.fr" } });
    const confirmee = await order("vitrine-a", [{ variante_id: s.variante, quantite: 5 }], { client: { nom: "A", email: "a2@exemple.fr" } });
    const recente = await order("vitrine-a", [{ variante_id: s.variante, quantite: 6 }], { client: { nom: "A", email: "a3@exemple.fr" } });
    await q("update public.commandes set statut = 'confirmee' where ref = $1", [confirmee.ref]);
    await q("update public.commandes set created_at = now() - interval '3 days' where ref in ($1, $2)", [vieille.ref, confirmee.ref]);
    expect(await stock(s.variante)).toBe(85);
    const run = (age = "48 hours") => as<{ n: number }>("service_role", null, "select public.boutique_expirer_commandes_nouvelles($1::interval) as n", [age]).then((x) => x[0]!.n);
    expect(await run()).toBe(1);
    expect(await stock(s.variante)).toBe(89); // +4, une seule fois
    expect(await run()).toBe(0); // rejouable : rien de plus
    expect(await stock(s.variante)).toBe(89);
    const statuts = await q<{ ref: string; statut: string }>("select ref, statut from public.commandes order by ref");
    expect(Object.fromEntries(statuts.map((r) => [r.ref, r.statut]))).toEqual({ [vieille.ref as string]: "annulee", [confirmee.ref as string]: "confirmee", [recente.ref as string]: "nouvelle" });
    // garde-fous : âge minimum d'une heure, réservé au serveur
    await expect(run("10 minutes")).rejects.toThrow(/E_AGE_INVALIDE/);
    await expect(as("anon", null, "select public.boutique_expirer_commandes_nouvelles('48 hours')")).rejects.toThrow(DENIED);
    await expect(as("authenticated", A, "select public.boutique_expirer_commandes_nouvelles('48 hours')")).rejects.toThrow(DENIED);
  });

  it("référence de 12 caractères pour les nouvelles commandes ; les anciennes (8) restent valables et suivies ; collision gérée", async () => {
    const s = await seed(A, "vitrine-a");
    const r = await order("vitrine-a", [{ variante_id: s.variante, quantite: 1 }]);
    expect(String(r.ref)).toMatch(/^CMD-[0-9A-F]{12}$/);
    // une commande ancienne (8 caractères) existe encore et reste lisible
    await q("update public.commandes set ref = 'CMD-3F9A1C2B' where ref = $1", [r.ref]);
    const suivre = (ref: string, j: string) => as<{ r: unknown }>("service_role", null, "select public.boutique_suivre_commande($1,$2) as r", [ref, j]).then((x) => x[0]!.r);
    expect(await suivre("CMD-3F9A1C2B", r.jeton_suivi as string)).toMatchObject({ ref: "CMD-3F9A1C2B" });
    // collision : le générateur renvoie d'abord une référence déjà prise ; la commande réussit avec la suivante
    await q("create sequence public.test_ref_seq");
    await q(`create or replace function public.boutique_generer_ref() returns text language plpgsql as $$
             begin return case when nextval('public.test_ref_seq') <= 3 then 'CMD-3F9A1C2B' else 'CMD-' || lpad(upper(to_hex(currval('public.test_ref_seq')::int)), 12, '0') end; end $$`);
    try {
      const c = await order("vitrine-a", [{ variante_id: s.variante, quantite: 1 }], { client: { nom: "Z", email: "z@exemple.fr" } });
      expect(c.ref).toBe("CMD-000000000004");
      expect(await q("select 1 from public.commandes")).toHaveLength(2);
      expect(await stock(s.variante)).toBe(98);
    } finally {
      await db.exec(sql("0007_durcissement.sql")); // restaure le vrai générateur
    }
  });
});

describe("3. plafonds et URL d'images en base (écriture directe comprise)", () => {
  it("50 variantes par produit, 50 catégories par boutique", async () => {
    const s = await seed(A, "vitrine-a");
    await q("insert into public.variantes (produit_id, boutique_id, nom) select $1, $2, 'v' || g from generate_series(1, 49) g", [s.produit, s.id]);
    await expect(as("authenticated", A, "insert into public.variantes (produit_id, boutique_id, nom) values ($1,$2,'de trop')", [s.produit, s.id])).rejects.toThrow(/50 variantes/);
    await q("insert into public.categories (boutique_id, nom) select $1, 'c' || g from generate_series(1, 50) g", [s.id]);
    await expect(as("authenticated", A, "insert into public.categories (boutique_id, nom) values ($1,'de trop')", [s.id])).rejects.toThrow(/50 catégories/);
  });

  it("500 produits par boutique et 2000 par compte", async () => {
    const shops: string[] = [];
    for (let i = 1; i <= 5; i++) shops.push((await q<{ id: string }>("insert into public.boutiques (proprietaire_id, slug, nom) values ($1,$2,'x') returning id", [A, `boutique-${i}x`]))[0]!.id);
    for (const id of shops.slice(0, 4)) await q("insert into public.produits (boutique_id, titre, prix_centimes) select $1, 'p' || g, 100 from generate_series(1, 500) g", [id]);
    await expect(as("authenticated", A, "insert into public.produits (boutique_id, titre, prix_centimes) values ($1,'de trop',100)", [shops[0]])).rejects.toThrow(/500 produits/);
    await expect(as("authenticated", A, "insert into public.produits (boutique_id, titre, prix_centimes) values ($1,'du compte',100)", [shops[4]])).rejects.toThrow(/2000 produits/);
    // un autre compte n'est pas touché
    const b = (await q<{ id: string }>("insert into public.boutiques (proprietaire_id, slug, nom) values ($1,'boutique-b','x') returning id", [B]))[0]!.id;
    await as("authenticated", B, "insert into public.produits (boutique_id, titre, prix_centimes) values ($1,'ok',100)", [b]);
  });

  it("images : https uniquement, 500 caractères, 5 au plus, pas de balises/identifiants ; logo aussi — par écriture directe", async () => {
    const s = await seed(A, "vitrine-a");
    const ins = (images: string[]) => as("authenticated", A, "insert into public.produits (boutique_id, titre, prix_centimes, images) values ($1,'x',1,$2::text[])", [s.id, images]);
    await ins(["https://exemple.fr/a.jpg", "https://cdn.exemple.fr/b.png?x=1&y=2"]);
    for (const bad of [["http://exemple.fr/a.jpg"], ["javascript:alert(1)"], ["data:image/png;base64,AAAA"], ["https://exemple.fr/a b.jpg"],
      ["https://exemple.fr/<script>"], ["https://user:pw@exemple.fr/a.jpg"], ["https://exemple.fr/" + "a".repeat(500)], ["//exemple.fr/a.jpg"],
      Array.from({ length: 6 }, (_, i) => `https://exemple.fr/${i}.jpg`)]) {
      await expect(ins(bad), JSON.stringify(bad).slice(0, 60)).rejects.toThrow(/violates/);
    }
    await expect(as("authenticated", A, "update public.produits set images = '{http://exemple.fr/x.png}' where boutique_id = $1", [s.id])).rejects.toThrow(/violates/);
    await expect(as("authenticated", A, "update public.boutiques set logo = 'https://exemple.fr/a b.png' where id = $1", [s.id])).rejects.toThrow(/violates/);
    await as("authenticated", A, "update public.boutiques set logo = 'https://exemple.fr/logo.png' where id = $1", [s.id]);
  });
});

describe("4. exposition publique", () => {
  it("anon ne lit plus sites.user_id / project_id ; la lecture publique (slug, data, suspended_at) marche toujours", async () => {
    await seedSite(A, "site-de-a");
    await expect(as("anon", null, "select user_id from public.sites")).rejects.toThrow(DENIED);
    await expect(as("anon", null, "select project_id from public.sites")).rejects.toThrow(DENIED);
    await expect(as("anon", null, "select * from public.sites")).rejects.toThrow(DENIED);
    expect(await as("anon", null, "select data, suspended_at from public.sites where slug = 'site-de-a'")).toEqual([{ data: { a: 1 }, suspended_at: null }]);
    // suspendu ou propriétaire Gratuit : toujours introuvable
    await setPlan(A, "gratuit");
    expect(await as("anon", null, "select data from public.sites where slug = 'site-de-a'")).toEqual([]);
  });

  it("un compte connecté ne lit plus les sites ni les boutiques (proprietaire_id, user_id) des AUTRES ; il lit les siens", async () => {
    await seedSite(A, "site-de-a");
    await seed(A, "vitrine-a");
    expect(await as("authenticated", B, "select user_id from public.sites")).toEqual([]);
    expect(await as("authenticated", B, "select proprietaire_id, suspended_at from public.boutiques")).toEqual([]);
    expect(await as("authenticated", A, "select user_id from public.sites")).toEqual([{ user_id: A }]);
    expect(await as("authenticated", A, "select proprietaire_id, suspended_at from public.boutiques")).toHaveLength(1);
    // le public lit toujours la vitrine par ses colonnes publiques
    expect(await as("anon", null, "select slug, nom, modes from public.boutiques where slug = 'vitrine-a'")).toHaveLength(1);
    await expect(as("anon", null, "select proprietaire_id from public.boutiques")).rejects.toThrow(DENIED);
    await expect(as("anon", null, "select suspended_at from public.boutiques")).rejects.toThrow(DENIED);
  });

  it("stock exact : illisible pour le public, remplacé par la vue (disponible / stock_bas) ; le commerçant voit le stock exact de ses variantes", async () => {
    const s = await seed(A, "vitrine-a", 7);
    await q("insert into public.variantes (produit_id, boutique_id, nom, stock) values ($1,$2,'S',3), ($1,$2,'XL',0)", [s.produit, s.id]);
    await expect(as("anon", null, "select stock from public.variantes")).rejects.toThrow(DENIED);
    await expect(as("anon", null, "select * from public.variantes")).rejects.toThrow(DENIED);
    await expect(as("anon", null, "select stock from public.variantes_publiques")).rejects.toThrow(/stock|column/);
    const pub = await as<{ nom: string; disponible: boolean; stock_bas: boolean }>("anon", null, "select nom, disponible, stock_bas from public.variantes_publiques order by nom");
    expect(pub).toEqual([
      { nom: "M", disponible: true, stock_bas: false },
      { nom: "S", disponible: true, stock_bas: true },
      { nom: "XL", disponible: false, stock_bas: false },
    ]);
    // la lecture publique des produits (politique qui dépend de produit_actif) n'est pas cassée
    expect(await as("anon", null, "select id from public.produits")).toHaveLength(1);
    // variante inactive, produit inactif, boutique brouillon : absents de la vue
    await q("update public.variantes set actif = false where nom = 'S'");
    expect(await as("anon", null, "select 1 from public.variantes_publiques")).toHaveLength(2);
    await q("update public.produits set actif = false");
    expect(await as("anon", null, "select 1 from public.variantes_publiques")).toEqual([]);
    await q("update public.produits set actif = true");
    // le commerçant voit le stock exact des siennes ; un autre compte ne voit rien
    expect((await as<{ stock: number }>("authenticated", A, "select stock from public.variantes order by stock")).map((r) => r.stock)).toEqual([0, 3, 7]);
    expect(await as("authenticated", B, "select stock from public.variantes")).toEqual([]);
  });

  it("la vue publique n'est ni modifiable ni insérable (aucune écriture contournant la RLS)", async () => {
    const s = await seed(A, "vitrine-a", 7);
    for (const w of [
      "update public.variantes_publiques set nom = 'pirate'",
      "delete from public.variantes_publiques",
      `insert into public.variantes_publiques (produit_id, boutique_id, nom) values ('${s.produit}','${s.id}','x')`,
    ]) {
      await expect(as("anon", null, w), w).rejects.toThrow(DENIED);
      await expect(as("authenticated", B, w), w).rejects.toThrow(DENIED);
    }
    expect((await q<{ nom: string }>("select nom from public.variantes"))[0]!.nom).toBe("M");
  });
});

describe("5. droits TRUNCATE / REFERENCES / TRIGGER", () => {
  const TABLES = ["profiles", "projects", "sites", "waitlist", "legal_acceptances", "brand_entitlements", "brand_configs", "boutiques", "categories", "produits", "variantes", "commandes", "lignes_commande"];
  it("les rôles du navigateur n'ont plus aucun de ces trois droits sur aucune table", async () => {
    for (const t of TABLES) for (const role of ["anon", "authenticated"]) for (const priv of ["TRUNCATE", "REFERENCES", "TRIGGER"]) {
      const r = await q<{ ok: boolean }>("select has_table_privilege($1, $2, $3) as ok", [role, `public.${t}`, priv]);
      expect(r[0]!.ok, `${role} ${priv} ${t}`).toBe(false);
    }
    await expect(as("authenticated", A, "truncate public.waitlist")).rejects.toThrow(DENIED);
    await expect(as("anon", null, "truncate public.sites cascade")).rejects.toThrow(DENIED);
  });

  it("rien ne casse : la suppression d'un compte (cascades) et les écritures serveur fonctionnent toujours", async () => {
    await seedSite(A, "site-de-a");
    await seed(A, "vitrine-a");
    await q("insert into public.waitlist (slug, email) values ('site-de-a','x@exemple.fr')");
    await as("service_role", null, "delete from public.waitlist where email = 'x@exemple.fr'");
    await q("insert into public.waitlist (slug, email) values ('site-de-a','y@exemple.fr')");
    await q("delete from auth.users where id = $1", [A]); // cascades : profil, projets, sites (et liste d'attente), boutiques, produits, variantes
    expect(await q("select 1 from public.profiles where id = $1", [A])).toHaveLength(0);
    expect(await q("select 1 from public.projects where user_id = $1", [A])).toHaveLength(0);
    expect(await q("select 1 from public.sites where user_id = $1", [A])).toHaveLength(0);
    expect(await q("select 1 from public.waitlist")).toHaveLength(0);
    expect(await q("select 1 from public.boutiques where proprietaire_id = $1", [A])).toHaveLength(0);
    expect(await q("select 1 from public.produits")).toHaveLength(0);
    expect(await q("select 1 from public.variantes")).toHaveLength(0);
    await q("insert into auth.users (id) values ($1)", [A]); // remet le compte pour les autres tests
  });
});

describe("6. création atomique d'un produit avec ses variantes", () => {
  const creer = (uid: string, boutique: string, produit: unknown, variantes: unknown = null) =>
    as<{ r: { id: string; titre: string; variantes: { nom: string; stock: number }[] } }>("authenticated", uid, "select public.boutique_creer_produit($1, $2::jsonb, $3::jsonb) as r", [boutique, JSON.stringify(produit), variantes === null ? null : JSON.stringify(variantes)]).then((x) => x[0]!.r);
  const nb = async (t: string) => (await q(`select 1 from public.${t}`)).length;

  it("crée le produit et toutes ses variantes en une opération ; variante par défaut « Unique »", async () => {
    const s = await seed(A, "vitrine-a");
    const base = await nb("produits");
    const r = await creer(A, s.id, { titre: "Robe", prix_centimes: 2599, images: ["https://exemple.fr/a.jpg"] }, [{ nom: "M", stock: 3 }, { nom: "L", stock: 1, position: 5 }]);
    expect(r).toMatchObject({ titre: "Robe", prix_centimes: 2599, images: ["https://exemple.fr/a.jpg"] });
    expect(r.variantes.map((v) => [v.nom, v.stock])).toEqual([["M", 3], ["L", 1]]);
    const d = await creer(A, s.id, { titre: "Mug", prix_centimes: 500 });
    expect(d.variantes.map((v) => [v.nom, v.stock])).toEqual([["Unique", 0]]);
    expect(await nb("produits")).toBe(base + 2);
  });

  it("tout ou rien : une variante refusée (doublon de nom, plafond, image http) n'abandonne aucun produit orphelin", async () => {
    const s = await seed(A, "vitrine-a");
    const produits = await nb("produits");
    const variantes = await nb("variantes");
    await expect(creer(A, s.id, { titre: "Robe", prix_centimes: 100 }, [{ nom: "M" }, { nom: "M" }])).rejects.toThrow(/duplicate|unique|violates/);
    await expect(creer(A, s.id, { titre: "Robe", prix_centimes: 100, images: ["http://exemple.fr/a.jpg"] })).rejects.toThrow(/violates/);
    await expect(creer(A, s.id, { titre: "Robe", prix_centimes: 100 }, Array.from({ length: 51 }, (_, i) => ({ nom: `v${i}` })))).rejects.toThrow(/invalide/);
    await expect(creer(A, s.id, { titre: "Robe", prix_centimes: 100 }, [{ nom: "M", stock: -1 }])).rejects.toThrow(/invalide/);
    await q("update public.variantes set nom = nom"); // sans effet
    expect(await nb("produits")).toBe(produits);
    expect(await nb("variantes")).toBe(variantes);
  });

  it("refuse la boutique d'un autre, les champs inconnus, les types faux ; réservée aux comptes connectés", async () => {
    const sa = await seed(A, "vitrine-a");
    const produits = await nb("produits");
    await expect(creer(B, sa.id, { titre: "Intrus", prix_centimes: 100 })).rejects.toThrow(DENIED);
    await expect(creer(A, sa.id, { titre: "x", prix_centimes: 100, boutique_id: sa.id })).rejects.toThrow(/invalide/);
    await expect(creer(A, sa.id, { titre: "x", prix_centimes: 9.99 })).rejects.toThrow(/invalide/);
    await expect(creer(A, sa.id, { titre: "x", prix_centimes: -5 })).rejects.toThrow(/invalide/);
    await expect(creer(A, sa.id, { titre: 5, prix_centimes: 5 })).rejects.toThrow(/invalide/);
    await expect(creer(A, sa.id, { titre: "x", prix_centimes: 5, images: "https://exemple.fr/a.jpg" })).rejects.toThrow(/invalide/);
    await expect(as("anon", null, "select public.boutique_creer_produit($1, '{\"titre\":\"x\",\"prix_centimes\":1}'::jsonb)", [sa.id])).rejects.toThrow(DENIED);
    expect(await nb("produits")).toBe(produits);
  });
});

describe("7. fonctions de déclencheur et adresses réservées", () => {
  it("les fonctions de déclencheur ne sont plus exécutables directement (/rpc) par anon ni authenticated ; les déclencheurs fonctionnent toujours", async () => {
    const fns = ["handle_new_user()", "enforce_project_limit()", "brand_entitlements_stamp()", "unpublish_site_of_deleted_project()", "boutique_touch()", "boutique_enforce_limit()",
      "boutique_garde()", "commande_transition()", "commande_boutique_publiable()", "sites_enforce_plan()", "waitlist_plafond()", "boutique_plafonds()", "boutique_generer_ref()", "contact_email_norm(text)"];
    for (const f of fns) for (const role of ["anon", "authenticated"]) {
      const r = await q<{ ok: boolean }>("select has_function_privilege($1, $2, 'execute') as ok", [role, `public.${f}`]);
      expect(r[0]!.ok, `${role} ${f}`).toBe(false);
    }
    // les fonctions dont les politiques ont besoin restent exécutables
    for (const f of ["boutique_possedee(uuid)", "boutique_publiee(uuid)", "produit_actif(uuid)", "owner_can_publish(uuid)"]) {
      expect((await q<{ ok: boolean }>("select has_function_privilege('anon', $1, 'execute') as ok", [`public.${f}`]))[0]!.ok, f).toBe(true);
    }
    // une transition de statut (déclencheur) par le commerçant fonctionne toujours
    const s = await seed(A, "vitrine-a");
    const r = await order("vitrine-a", [{ variante_id: s.variante, quantite: 2 }]);
    await as("authenticated", A, "update public.commandes set statut = 'annulee' where ref = $1", [r.ref]);
    expect(await stock(s.variante)).toBe(100);
  });

  it("adresses réservées refusées en base (sites et boutiques), liste identique à celle de l'application", async () => {
    await expect(q("insert into public.boutiques (proprietaire_id, slug, nom) values ($1,'admin','x')", [A])).rejects.toThrow(/violates/);
    await q("insert into public.projects (user_id, id, data) values ($1,'proj1','{}'::jsonb)", [A]);
    await expect(q("insert into public.sites (slug, user_id, project_id, data) values ('api',$1,'proj1','{}'::jsonb)", [A])).rejects.toThrow(/violates/);
    const ts = /RESERVED = new Set\(\[([^\]]*)\]\)/.exec(readFileSync("src/lib/publish.ts", "utf8"))![1]!.match(/"([^"]+)"/g)!.map((x) => x.replaceAll('"', "")).sort();
    const sqlList = /array\[([^\]]*)\]\)\s*\n\$\$;\s*\ndo \$\$ begin\s*\n\s*if not exists \(select 1 from pg_constraint where conname = 'sites_slug_non_reserve'/.exec(sql("0007_durcissement.sql"))![1]!.match(/'([^']+)'/g)!.map((x) => x.replaceAll("'", "")).sort();
    expect(sqlList).toEqual(ts);
    await q("insert into public.boutiques (proprietaire_id, slug, nom) values ($1,'chez-awa','x')", [A]);
  });
});

describe("8. rejouabilité", () => {
  it("la migration 0007 peut être rejouée sans erreur ni perte de données", async () => {
    const s = await seed(A, "vitrine-a");
    await order("vitrine-a", [{ variante_id: s.variante, quantite: 2 }]);
    await seedSite(A, "site-de-a");
    await db.exec(sql("0007_durcissement.sql"));
    await db.exec(sql("0007_durcissement.sql"));
    expect(await stock(s.variante)).toBe(98);
    expect(await q("select 1 from public.commandes")).toHaveLength(1);
    expect(await q("select 1 from public.sites")).toHaveLength(1);
  });

  it("A-COLLER-0007.sql est identique à 0007_durcissement.sql", () => {
    expect(readFileSync("supabase/A-COLLER-0007.sql", "utf8")).toBe(sql("0007_durcissement.sql"));
  });
});
