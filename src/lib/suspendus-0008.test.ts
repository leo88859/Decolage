import { readFileSync } from "node:fs";
import { PGlite, type Transaction } from "@electric-sql/pglite";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { PLANS } from "@/lib/plans";
import { splitPublications, type Publication } from "@/lib/site-lifecycle";
import type { Plan } from "@/lib/types";

// Migration 0008 dans un vrai PostgreSQL (PGlite, migrations 0001 à 0008) : sites et boutiques suspendus hors limite,
// et expiration des commandes « nouvelle » après 72 h. Le « serveur » est le rôle service_role (comme /api/sites et le webhook).
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
const setPlan = (uid: string, plan: Plan) => db.query("update public.profiles set plan = $2 where id = $1", [uid, plan]);
const tooMany = (p: Promise<unknown>) => expect(p).rejects.toThrow(/Limite de sites publiés atteinte/);
const noPublish = (p: Promise<unknown>) => expect(p).rejects.toThrow(/publication en ligne n'est pas incluse/);
const denied = (p: Promise<unknown>) => expect(p).rejects.toThrow(/permission denied|row-level security/);

/** Publication d'un site par le serveur (comme /api/sites). `age` : plus petit = plus ancien. */
const serverSite = (uid: string, slug: string) =>
  as("service_role", null, "insert into public.sites (slug, user_id, project_id, data) values ($1,$2,$3,'{}'::jsonb) returning slug", [slug, uid, slug.replace(/-/g, "").slice(0, 20)]);
/** Site/boutique posé par l'administrateur SQL (pas de garde) avec une date de publication précise. */
const adminSite = (uid: string, slug: string, jour: number, suspendu = false) =>
  q("insert into public.sites (slug, user_id, project_id, data, published_at, suspended_at) values ($1,$2,$3,'{}'::jsonb, $4::timestamptz, $5)", [slug, uid, slug.replace(/-/g, "").slice(0, 20), `2026-01-${String(jour).padStart(2, "0")}T10:00:00Z`, suspendu ? "2026-06-01T00:00:00Z" : null]);
const adminShop = async (uid: string, slug: string, jour: number, suspendue = false) =>
  (await q<{ id: string }>("insert into public.boutiques (proprietaire_id, slug, nom, statut, published_at, suspended_at, modes) values ($1,$2,'B','publiee',$3::timestamptz,$4,'{retrait}') returning id", [uid, slug, `2026-01-${String(jour).padStart(2, "0")}T10:00:00Z`, suspendue ? "2026-06-01T00:00:00Z" : null]))[0]!.id;
const reactivateSite = (slug: string) => as("service_role", null, "update public.sites set suspended_at = null where slug = $1 returning slug", [slug]);
const reactivateShop = (id: string) => as("service_role", null, "update public.boutiques set suspended_at = null where id = $1 returning id", [id]);
const online = async (uid: string) =>
  (await q<{ n: number }>("select (select count(*) from public.sites where user_id = $1 and suspended_at is null)::int + (select count(*) from public.boutiques where proprietaire_id = $1 and statut = 'publiee' and suspended_at is null)::int as n", [uid]))[0]!.n;

/** Même algorithme que syncPublicationsWithPlan (splitPublications, suspensions puis réactivations), exécuté par service_role. */
async function sync(uid: string, plan: Plan) {
  const sites = await q<{ slug: string; published_at: string }>("select slug, published_at::text from public.sites where user_id = $1", [uid]);
  const shops = await q<{ id: string; published_at: string }>("select id, published_at::text from public.boutiques where proprietaire_id = $1 and statut = 'publiee'", [uid]);
  const pubs: Publication[] = [
    ...sites.map((s) => ({ kind: "site" as const, key: s.slug, published_at: new Date(s.published_at).toISOString() })),
    ...shops.map((b) => ({ kind: "boutique" as const, key: b.id, published_at: new Date(b.published_at).toISOString() })),
  ];
  const { keep, suspend } = splitPublications(pubs, PLANS[plan].maxSites);
  const set = (list: Publication[], kind: Publication["kind"], v: string | null) => {
    const keys = list.filter((p) => p.kind === kind).map((p) => p.key);
    if (!keys.length) return Promise.resolve([]);
    return kind === "site"
      ? as("service_role", null, "update public.sites set suspended_at = $2 where user_id = $1 and slug = any($3::text[])", [uid, v, keys])
      : as("service_role", null, "update public.boutiques set suspended_at = $2 where proprietaire_id = $1 and id = any($3::uuid[])", [uid, v, keys]);
  };
  for (const k of ["site", "boutique"] as const) await set(suspend, k, new Date().toISOString());
  for (const k of ["site", "boutique"] as const) await set(keep, k, null);
}
const suspendedSlugs = async () => (await q<{ slug: string }>("select slug from public.sites where suspended_at is not null order by slug")).map((r) => r.slug);

beforeAll(async () => {
  db = new PGlite();
  await db.exec(SUPABASE_STUB);
  for (const f of FILES) if (!(process.env.SANS_0008 === "1" && f.startsWith("0008"))) await db.exec(sql(f)); // SANS_0008=1 : prouve que les tests échouent sans la correction
  await q("insert into auth.users (id) values ($1), ($2)", [A, B]);
});
beforeEach(async () => {
  await q("delete from public.boutiques");
  await q("delete from public.sites");
  await setPlan(A, "gratuit");
  await setPlan(B, "gratuit");
});

describe("0008 : rétrogradation, publication et réactivation (sites)", () => {
  it("Pro vers Solo : le plus ancien reste en ligne, les autres sont suspendus (rien n'est supprimé)", async () => {
    await setPlan(A, "pro");
    for (const [i, s] of ["site-un", "site-deux", "site-trois"].entries()) await adminSite(A, s, i + 1);
    await setPlan(A, "solo");
    await sync(A, "solo");
    expect(await suspendedSlugs()).toEqual(["site-deux", "site-trois"]);
    expect(await online(A)).toBe(1);
    expect(await q("select 1 from public.sites")).toHaveLength(3);
  });

  it("Pro vers Gratuit : tout est suspendu ; le serveur peut suspendre mais jamais réactiver", async () => {
    await setPlan(A, "pro");
    await adminSite(A, "site-un", 1);
    await adminSite(A, "site-deux", 2);
    await setPlan(A, "gratuit");
    await sync(A, "gratuit");
    expect(await suspendedSlugs()).toEqual(["site-deux", "site-un"]);
    await noPublish(reactivateSite("site-un"));
    await noPublish(serverSite(A, "site-neuf"));
  });

  it("après rétrogradation, un NOUVEAU site peut être publié dans la limite (les suspendus ne comptent pas)", async () => {
    await setPlan(A, "pro");
    await adminSite(A, "site-un", 1);
    await adminSite(A, "site-deux", 2);
    await setPlan(A, "solo");
    await sync(A, "solo"); // un reste en ligne, un suspendu
    await tooMany(serverSite(A, "site-neuf")); // 1 en ligne = la limite de Solo
    await as("service_role", null, "update public.sites set suspended_at = now() where slug = 'site-un'"); // plus rien en ligne
    expect(await serverSite(A, "site-neuf")).toHaveLength(1); // autorisé : les 2 suspendus ne comptent pas
    expect(await online(A)).toBe(1);
  });

  it("la réactivation d'un suspendu au-delà de la limite est refusée, y compris par le serveur (service_role)", async () => {
    await setPlan(A, "solo");
    await adminSite(A, "site-en-ligne", 1);
    await adminSite(A, "site-suspendu", 2, true);
    await tooMany(reactivateSite("site-suspendu"));
    expect(await suspendedSlugs()).toEqual(["site-suspendu"]);
    // mettre à jour son contenu sans le réactiver reste possible
    expect(await as("service_role", null, "update public.sites set data = '{\"v\":2}'::jsonb where slug = 'site-suspendu' returning slug")).toHaveLength(1);
    // mettre à jour le site en ligne (déjà compté) reste possible
    expect(await as("service_role", null, "update public.sites set data = '{\"v\":2}'::jsonb where slug = 'site-en-ligne' returning slug")).toHaveLength(1);
  });

  it("le navigateur ne peut jamais écrire suspended_at (sites ni boutiques)", async () => {
    await setPlan(A, "pro");
    await adminSite(A, "site-suspendu", 1, true);
    const id = await adminShop(A, "boutique-a", 2, true);
    await denied(as("authenticated", A, "update public.sites set suspended_at = null where slug = 'site-suspendu'"));
    await denied(as("authenticated", A, "update public.boutiques set suspended_at = null where id = $1", [id]));
    await denied(as("anon", null, "update public.sites set suspended_at = null"));
    expect(await suspendedSlugs()).toEqual(["site-suspendu"]);
  });

  it("réabonnement Solo vers Pro : les suspendus sont réactivés dans la limite de 5, pas au-delà", async () => {
    await setPlan(A, "solo");
    for (let i = 1; i <= 7; i++) await adminSite(A, `site-${i}x`, i, i > 1);
    await setPlan(A, "pro");
    await sync(A, "pro");
    expect(await online(A)).toBe(5);
    expect(await suspendedSlugs()).toEqual(["site-6x", "site-7x"]);
    await tooMany(reactivateSite("site-6x"));
    // en dépublier un (suppression) libère une place
    await q("delete from public.sites where slug = 'site-1x'");
    expect(await reactivateSite("site-6x")).toHaveLength(1);
    await tooMany(reactivateSite("site-7x"));
  });

  it("réactivation seule après réabonnement, dans la limite : autorisée", async () => {
    await setPlan(A, "solo");
    await adminSite(A, "site-suspendu", 1, true);
    expect(await reactivateSite("site-suspendu")).toHaveLength(1);
    expect(await online(A)).toBe(1);
  });
});

describe("0008 : limites par formule et limite commune sites + boutiques", () => {
  it("Solo 1, Pro 5 : la limite est atteinte exactement ; Illimité n'en a pas ; Gratuit jamais", async () => {
    for (const [plan, max] of [["solo", 1], ["pro", 5]] as const) {
      await q("delete from public.sites");
      await setPlan(A, plan);
      for (let i = 1; i <= max; i++) expect(await serverSite(A, `site-${plan}-${i}`)).toHaveLength(1);
      await tooMany(serverSite(A, `site-${plan}-de-trop`));
    }
    await q("delete from public.sites");
    await setPlan(A, "illimite");
    for (let i = 1; i <= 12; i++) await serverSite(A, `site-illimite-${i}`);
    expect(await online(A)).toBe(12);
    await q("delete from public.sites");
    await setPlan(A, "gratuit");
    await noPublish(serverSite(A, "site-gratuit"));
  });

  it("une boutique en ligne et un site partagent la même limite (Pro : 3 sites + 2 boutiques = 5, le 6e refusé)", async () => {
    await setPlan(A, "pro");
    for (let i = 1; i <= 3; i++) await serverSite(A, `site-${i}x`);
    const b1 = await adminShop(A, "boutique-1x", 4);
    await adminShop(A, "boutique-2x", 5);
    await tooMany(serverSite(A, "site-sixieme"));
    // une boutique suspendue ne compte pas ; la réactiver est refusée tant que la limite est atteinte
    await as("service_role", null, "update public.boutiques set suspended_at = now() where id = $1", [b1]);
    expect(await serverSite(A, "site-sixieme")).toHaveLength(1);
    await expect(reactivateShop(b1)).rejects.toThrow(/Limite de sites publiés atteinte/);
  });

  it("boutiques : réactivation refusée au-delà de la limite pour le serveur ; publication par le navigateur dans la limite quand des suspendus existent", async () => {
    await setPlan(A, "solo");
    await adminShop(A, "boutique-en-ligne", 1);
    const susp = await adminShop(A, "boutique-suspendue", 2, true);
    await expect(reactivateShop(susp)).rejects.toThrow(/Limite de sites publiés atteinte/);
    // passer le site en ligne en suspendu libère la place : le navigateur peut publier un brouillon (la suspendue ne compte pas)
    await q("update public.boutiques set suspended_at = now() where slug = 'boutique-en-ligne'");
    await setPlan(B, "solo");
    const shop = (await as<{ id: string }>("authenticated", B, "insert into public.boutiques (proprietaire_id, slug, nom, statut) values ($1,'boutique-de-b','B','brouillon') returning id", [B]))[0]!.id;
    expect(await as("authenticated", B, "update public.boutiques set statut = 'publiee' where id = $1 returning id", [shop])).toHaveLength(1);
  });

  it("boutique Gratuit : réactivation refusée même par le serveur (formule)", async () => {
    await setPlan(A, "pro");
    const id = await adminShop(A, "boutique-a", 1, true);
    await setPlan(A, "gratuit");
    await noPublish(reactivateShop(id));
    // la suspendre (déjà suspendue) ou la mettre à jour sans la réactiver reste permis
    expect(await as("service_role", null, "update public.boutiques set nom = 'Renommée' where id = $1 returning id", [id])).toHaveLength(1);
  });

  it("l'administrateur SQL (postgres) n'est pas bloqué (dépannage manuel)", async () => {
    await setPlan(A, "solo");
    await adminSite(A, "site-un", 1);
    await adminSite(A, "site-deux", 2, true);
    await q("update public.sites set suspended_at = null where slug = 'site-deux'");
    expect(await online(A)).toBe(2);
  });

  it("verrou : sites et boutiques d'un propriétaire partagent un verrou consultatif ; trois réactivations en parallèle pour 2 places n'en laissent passer que 2", async () => {
    await setPlan(A, "pro");
    await adminSite(A, "site-un", 1);
    await adminSite(A, "site-deux", 2);
    await adminSite(A, "site-trois", 3);
    await adminSite(A, "site-a", 4, true);
    await adminSite(A, "site-b", 5, true);
    await adminSite(A, "site-c", 6, true);
    // le verrou est bien pris dans la transaction (clé « boutiques:<propriétaire> »)
    const locks = await db.transaction(async (tx) => {
      await tx.exec("set local role service_role");
      await tx.query("update public.sites set suspended_at = null where slug = 'site-a'");
      return (await tx.query<{ n: number }>("select count(*)::int as n from pg_locks where locktype = 'advisory' and pid = pg_backend_pid()")).rows[0]!.n;
    });
    expect(locks).toBeGreaterThanOrEqual(1);
    await q("update public.sites set suspended_at = now() where slug = 'site-a'");
    const res = await Promise.allSettled(["site-a", "site-b", "site-c"].map((s) => reactivateSite(s)));
    expect(res.filter((r) => r.status === "fulfilled")).toHaveLength(2);
    expect(res.filter((r) => r.status === "rejected")).toHaveLength(1);
    expect(await online(A)).toBe(5);
    // la fonction de 0008 prend bien le verrou commun
    const src = (await q<{ s: string }>("select pg_get_functiondef('public.sites_enforce_plan'::regproc) as s"))[0]!.s + (await q<{ s: string }>("select pg_get_functiondef('public.boutique_enforce_limit'::regproc) as s"))[0]!.s;
    expect(src.match(/pg_advisory_xact_lock\(hashtext\('boutiques:'/g) ?? []).toHaveLength(2);
  });
});

describe("0008 : rejouabilité et fichier à coller", () => {
  it("rejouable sans erreur ni perte de données, A-COLLER-0008.sql identique", async () => {
    await setPlan(A, "pro");
    await adminSite(A, "site-un", 1);
    await adminSite(A, "site-deux", 2, true);
    await db.exec(sql("0008_suspendus_et_expiration.sql"));
    await db.exec(sql("0008_suspendus_et_expiration.sql"));
    expect(await q("select 1 from public.sites")).toHaveLength(2);
    expect(readFileSync("supabase/A-COLLER-0008.sql", "utf8")).toBe(sql("0008_suspendus_et_expiration.sql"));
  });
  it("rejouer 0007 PUIS 0008 : le dernier mot revient à 0008 (expiration et limite)", async () => {
    await db.exec(sql("0007_durcissement.sql"));
    await db.exec(sql("0008_suspendus_et_expiration.sql"));
    expect((await as<{ n: number }>("service_role", null, "select public.boutique_expirer_commandes_nouvelles() as n"))[0]!.n).toBe(0);
  });
});

// ─── Expiration des commandes « nouvelle » ────────────────────────────────────────────────────
let cle = 0;
function order(slug: string, variante: string, quantite: number, email: string) {
  return as<{ r: { ref: string } }>("service_role", null, "select public.boutique_creer_commande($1,$2,$3::jsonb,'retrait',$4::jsonb) as r", [
    slug, `cle-${String(++cle).padStart(6, "0")}-abcdefghij`, JSON.stringify({ nom: "Awa", email }), JSON.stringify([{ variante_id: variante, quantite }]),
  ]).then((rows) => rows[0]!.r.ref);
}
async function seedShop(owner: string, slug: string, stk = 100) {
  const b = (await q<{ id: string }>("insert into public.boutiques (proprietaire_id, slug, nom, statut, modes) values ($1,$2,'B','publiee','{retrait}') returning id", [owner, slug]))[0]!.id;
  const p = (await q<{ id: string }>("insert into public.produits (boutique_id, titre, prix_centimes) values ($1,'T',1000) returning id", [b]))[0]!.id;
  const v = (await q<{ id: string }>("insert into public.variantes (produit_id, boutique_id, nom, stock) values ($1,$2,'M',$3) returning id", [p, b, stk]))[0]!.id;
  return { id: b, variante: v };
}
const stock = async (v: string) => (await q<{ stock: number }>("select stock from public.variantes where id = $1", [v]))[0]!.stock;
const ageHours = (ref: string, h: number) => q("update public.commandes set created_at = now() - ($2 || ' hours')::interval where ref = $1", [ref, String(h)]);
const statutDe = async (ref: string) => (await q<{ statut: string }>("select statut from public.commandes where ref = $1", [ref]))[0]!.statut;
const expire = (arg?: string) =>
  as<{ n: number }>("service_role", null, arg ? "select public.boutique_expirer_commandes_nouvelles($1::interval) as n" : "select public.boutique_expirer_commandes_nouvelles() as n", arg ? [arg] : []).then((r) => r[0]!.n);

describe("0008 : expiration des commandes « nouvelle » après 72 h", () => {
  beforeEach(async () => {
    await setPlan(A, "pro");
    await setPlan(B, "pro");
  });

  it("71 h : non touchée ; 73 h : annulée (défaut 72 h sans argument), stock remis, marqueur posé", async () => {
    const s = await seedShop(A, "vitrine-a");
    const r71 = await order("vitrine-a", s.variante, 3, "a1@exemple.fr");
    const r73 = await order("vitrine-a", s.variante, 4, "a2@exemple.fr");
    await ageHours(r71, 71);
    await ageHours(r73, 73);
    expect(await stock(s.variante)).toBe(93);
    expect(await expire()).toBe(1);
    expect(await statutDe(r71)).toBe("nouvelle");
    expect(await statutDe(r73)).toBe("annulee");
    expect(await stock(s.variante)).toBe(97); // +4 seulement
    const m = (await q<{ annulation_motif: string | null; annulee_le: string | null }>("select annulation_motif, annulee_le from public.commandes where ref = $1", [r73]))[0]!;
    expect(m.annulation_motif).toBe("expiree_automatiquement");
    expect(m.annulee_le).not.toBeNull();
    expect((await q<{ annulation_motif: string | null }>("select annulation_motif from public.commandes where ref = $1", [r71]))[0]!.annulation_motif).toBeNull();
  });

  it("double appel et appels qui se chevauchent : le stock n'est remis qu'une fois", async () => {
    const s = await seedShop(A, "vitrine-a");
    const r = await order("vitrine-a", s.variante, 5, "a1@exemple.fr");
    await ageHours(r, 100);
    const res = await Promise.all([expire(), expire(), expire("72 hours")]);
    expect(res.reduce((a, b) => a + b, 0)).toBe(1);
    expect(await stock(s.variante)).toBe(100);
    expect(await expire()).toBe(0);
    expect(await stock(s.variante)).toBe(100);
  });

  it("confirmée / prête / terminée / annulée intactes (même très anciennes), stock inchangé ; autre boutique intacte", async () => {
    const s = await seedShop(A, "vitrine-a");
    const o = await seedShop(B, "vitrine-b");
    const refs = {
      confirmee: await order("vitrine-a", s.variante, 1, "c1@exemple.fr"),
      prete: await order("vitrine-a", s.variante, 1, "c2@exemple.fr"),
      terminee: await order("vitrine-a", s.variante, 1, "c3@exemple.fr"),
      annulee: await order("vitrine-a", s.variante, 1, "c4@exemple.fr"),
    };
    await q("update public.commandes set statut = 'confirmee' where ref = $1", [refs.confirmee]);
    await q("update public.commandes set statut = 'confirmee' where ref in ($1,$2)", [refs.prete, refs.terminee]);
    await q("update public.commandes set statut = 'prete' where ref in ($1,$2)", [refs.prete, refs.terminee]);
    await q("update public.commandes set statut = 'terminee' where ref = $1", [refs.terminee]);
    await q("update public.commandes set statut = 'annulee' where ref = $1", [refs.annulee]); // stock remis une fois ici
    const autre = await order("vitrine-b", o.variante, 2, "b1@exemple.fr");
    for (const r of [...Object.values(refs), autre]) await ageHours(r, 500);
    expect(await stock(s.variante)).toBe(97);
    // seule la boutique B a une « nouvelle » ancienne : elle est annulée (l'expiration vise toutes les boutiques), A ne bouge pas
    expect(await expire()).toBe(1);
    expect(await stock(s.variante)).toBe(97);
    for (const [k, r] of Object.entries(refs)) expect(await statutDe(r), k).toBe(k === "annulee" ? "annulee" : k);
    expect(await statutDe(autre)).toBe("annulee");
    expect(await stock(o.variante)).toBe(100);
    // la commande annulée à la main n'a pas de marqueur « expirée »
    expect((await q<{ annulation_motif: string | null }>("select annulation_motif from public.commandes where ref = $1", [refs.annulee]))[0]!.annulation_motif).toBeNull();
  });

  it("une commande « nouvelle » dont paiement indiquerait un paiement n'est jamais annulée automatiquement (cas futur)", async () => {
    const s = await seedShop(A, "vitrine-a");
    const r = await order("vitrine-a", s.variante, 2, "a1@exemple.fr");
    await ageHours(r, 200);
    const nom = (await q<{ conname: string }>("select conname from pg_constraint where conrelid = 'public.commandes'::regclass and contype = 'c' and pg_get_constraintdef(oid) like '%paiement%'"))[0]!.conname;
    await q(`alter table public.commandes drop constraint "${nom}"`);
    try {
      await q("update public.commandes set paiement = 'payee' where ref = $1", [r]);
      expect(await expire()).toBe(0);
      expect(await statutDe(r)).toBe("nouvelle");
      expect(await stock(s.variante)).toBe(98);
    } finally {
      await q("update public.commandes set paiement = 'non_payee'");
      await q(`alter table public.commandes add constraint "${nom}" check (paiement = 'non_payee')`);
    }
  });

  it("âge minimum d'une heure, exécutable par service_role seulement (avec ou sans argument)", async () => {
    await expect(expire("10 minutes")).rejects.toThrow(/E_AGE_INVALIDE/);
    for (const role of ["anon", "authenticated"] as const) {
      await denied(as(role, A, "select public.boutique_expirer_commandes_nouvelles()"));
      await denied(as(role, A, "select public.boutique_expirer_commandes_nouvelles('72 hours')"));
    }
  });

  it("le commerçant lit le marqueur de SES commandes, pas celui des autres", async () => {
    const s = await seedShop(A, "vitrine-a");
    const r = await order("vitrine-a", s.variante, 1, "a1@exemple.fr");
    await ageHours(r, 100);
    await expire();
    expect(await as("authenticated", A, "select annulation_motif from public.commandes where ref = $1", [r])).toEqual([{ annulation_motif: "expiree_automatiquement" }]);
    expect(await as("authenticated", B, "select annulation_motif from public.commandes where ref = $1", [r])).toEqual([]);
    await denied(as("authenticated", A, "update public.commandes set annulation_motif = null where ref = $1", [r]));
  });
});
