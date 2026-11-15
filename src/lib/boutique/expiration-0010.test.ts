import { readFileSync } from "node:fs";
import { PGlite, type Transaction } from "@electric-sql/pglite";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { dateExpiration, delaiValide, quantiteMaxValide, restantMs, tempsRestantLabel, texteExpirationAcheteur } from "./expiration";
import { QUANTITE_TOTALE_MAX } from "./money";
import { turnstileActif, verifierTurnstile } from "./turnstile";
import { validateBoutique, validateCommande } from "./validate";

// Étape 2 : migration 0010 (expiration réglable + limites anti-abus) dans un VRAI PostgreSQL (PGlite) ; validations, Turnstile
// et calculs d'expiration en TypeScript.
// ATTENTION : PGlite n'a qu'UNE connexion. Les « appels simultanés » ci-dessous sont lancés ensemble (Promise.all) mais exécutés
// l'un après l'autre : ils prouvent l'idempotence (stock remis une seule fois), PAS le comportement de vrais verrous entre deux
// connexions Postgres, qui n'a pas été testé sur la vraie base. Rien ici n'est un test de production.
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

let n = 0;
const key = () => `cle-${String(++n).padStart(6, "0")}-abcdefghij`;
const client = (i = 0) => ({ nom: "Awa Diop", email: `awa${i}@exemple.fr`, telephone: null });
const order = (slug: string, lignes: unknown[], over: { cle?: string; client?: unknown } = {}) =>
  as<{ r: Record<string, unknown> }>("service_role", null, "select public.boutique_creer_commande($1,$2,$3::jsonb,'retrait',$4::jsonb) as r", [
    slug, over.cle ?? key(), JSON.stringify(over.client ?? client()), JSON.stringify(lignes),
  ]).then((rows) => rows[0]!.r);
const stock = async (v: string) => (await q<{ stock: number }>("select stock from public.variantes where id = $1", [v]))[0]!.stock;
const statut = async (ref: unknown) => (await q<{ statut: string }>("select statut from public.commandes where ref = $1", [ref]))[0]!.statut;
const expirer = () => as<{ n: number }>("service_role", null, "select public.boutique_expirer_commandes_nouvelles() as n").then((r) => Number(r[0]!.n));
const vieillir = (ref: unknown, heures: number) => q("update public.commandes set created_at = now() - make_interval(hours => $2) where ref = $1", [ref, heures]);

type Shop = { id: string; slug: string; variante: string; variantes: string[] };
let sn = 0;
async function seed(opts: { stock?: number; nbVariantes?: number; delai?: number; qmax?: number } = {}): Promise<Shop> {
  const slug = `boutique-test-${++sn}`;
  const b = (await q<{ id: string }>(
    "insert into public.boutiques (proprietaire_id, slug, nom, statut, modes, delai_expiration_h, quantite_max_article) values ($1,$2,'Test','publiee','{retrait}',$3,$4) returning id",
    [A, slug, opts.delai ?? 48, opts.qmax ?? 10],
  ))[0]!.id;
  const p = (await q<{ id: string }>("insert into public.produits (boutique_id, titre, prix_centimes) values ($1,'T-shirt',1000) returning id", [b]))[0]!.id;
  const variantes: string[] = [];
  for (let i = 0; i < (opts.nbVariantes ?? 1); i++) {
    variantes.push((await q<{ id: string }>("insert into public.variantes (produit_id, boutique_id, nom, stock) values ($1,$2,$3,$4) returning id", [p, b, `V${i}`, opts.stock ?? 100]))[0]!.id);
  }
  return { id: b, slug, variante: variantes[0]!, variantes };
}
const ligne = (v: string, quantite: number) => ({ variante_id: v, quantite });

beforeAll(async () => {
  db = new PGlite();
  await db.exec(SUPABASE_STUB);
  for (const f of ["0001_schema.sql", "0002_conformite.sql", "0003_marque_blanche.sql", "0004_limites_serveur.sql", "0005_boutique.sql", "0006_regle_gratuit.sql", "0007_durcissement.sql", "0008_suspendus_et_expiration.sql", "0009_theme_boutique.sql"]) await db.exec(sql(f));
  await db.query("insert into auth.users (id) values ($1)", [A]);
  await db.query("update public.profiles set plan = 'illimite' where id = $1", [A]);
  // Une boutique créée AVANT la migration : elle doit survivre intacte.
  await db.query("insert into public.boutiques (proprietaire_id, slug, nom, statut, modes) values ($1, 'avant-0010', 'Avant', 'publiee', '{retrait}')", [A]);
  await db.exec(sql("0010_expiration_antiabus.sql"));
  await db.exec(sql("0010_expiration_antiabus.sql")); // rejouable sans erreur
}, 60_000);

describe("migration 0010 : colonnes et contraintes SQL", () => {
  it("les boutiques existantes prennent 48 h et 10 par article", async () => {
    const [b] = await q<{ delai_expiration_h: number; quantite_max_article: number }>("select delai_expiration_h, quantite_max_article from public.boutiques where slug = 'avant-0010'");
    expect(b).toEqual({ delai_expiration_h: 48, quantite_max_article: 10 });
  });
  it("CHECK du délai : 6 et 168 acceptés, 5 et 169 refusés", async () => {
    const s = await seed();
    for (const ok of [6, 168]) await q("update public.boutiques set delai_expiration_h = $2 where id = $1", [s.id, ok]);
    for (const ko of [5, 169, 0, -1]) await expect(q("update public.boutiques set delai_expiration_h = $2 where id = $1", [s.id, ko])).rejects.toThrow(/check|violates/);
  });
  it("CHECK de la quantité maximale : 1 et 99 acceptés, 0 et 100 refusés", async () => {
    const s = await seed();
    for (const ok of [1, 99]) await q("update public.boutiques set quantite_max_article = $2 where id = $1", [s.id, ok]);
    for (const ko of [0, 100]) await expect(q("update public.boutiques set quantite_max_article = $2 where id = $1", [s.id, ko])).rejects.toThrow(/check|violates/);
  });
  it("le commerçant règle ses deux valeurs ; le public les lit ; la base refuse une valeur hors plage", async () => {
    const s = await seed();
    await as("authenticated", A, "update public.boutiques set delai_expiration_h = 24, quantite_max_article = 5 where id = $1", [s.id]);
    expect(await as("anon", null, "select delai_expiration_h, quantite_max_article from public.boutiques where id = $1", [s.id])).toEqual([{ delai_expiration_h: 24, quantite_max_article: 5 }]);
    await expect(as("authenticated", A, "update public.boutiques set delai_expiration_h = 3 where id = $1", [s.id])).rejects.toThrow(/check|violates/);
  });
  it("le fichier à coller est identique à la migration ; la planification n'active pas l'extension", () => {
    expect(sql("A-COLLER-0010.sql")).toBe(sql("0010_expiration_antiabus.sql"));
    const cron = sql("0010b_planification_pg_cron.sql");
    const code = cron.split("\n").filter((l) => !l.trim().startsWith("--")).join("\n");
    expect(code).toContain("*/15 * * * *");
    expect(code).toContain("public.boutique_expirer_commandes_nouvelles()");
    expect(code).not.toMatch(/create\s+extension/i);
    expect(sql("0010_expiration_antiabus.sql")).not.toMatch(/cron\.(schedule|job)/);
  });
});

describe("expiration automatique (fonction SQL)", () => {
  it("annule après 48 h par défaut, pas avant, et remet le stock", async () => {
    const s = await seed({ stock: 20 });
    const jeune = await order(s.slug, [ligne(s.variante, 3)], { client: client(1) });
    const vieille = await order(s.slug, [ligne(s.variante, 4)], { client: client(2) });
    expect(await stock(s.variante)).toBe(13);
    await vieillir(jeune.ref, 47);
    await vieillir(vieille.ref, 49);
    expect(await expirer()).toBe(1);
    expect(await statut(jeune.ref)).toBe("nouvelle");
    expect(await statut(vieille.ref)).toBe("annulee");
    expect(await stock(s.variante)).toBe(17);
    const [m] = await q<{ annulation_motif: string; annulee_le: string | null }>("select annulation_motif, annulee_le from public.commandes where ref = $1", [vieille.ref]);
    expect(m!.annulation_motif).toBe("expiree_automatiquement");
    expect(m!.annulee_le).not.toBeNull();
  });
  it("respecte le délai réglé par le commerçant (6 h et 168 h)", async () => {
    const court = await seed({ delai: 6 });
    const long = await seed({ delai: 168 });
    const c = await order(court.slug, [ligne(court.variante, 1)]);
    const l = await order(long.slug, [ligne(long.variante, 1)]);
    await vieillir(c.ref, 7);
    await vieillir(l.ref, 100);
    await expirer();
    expect(await statut(c.ref)).toBe("annulee");
    expect(await statut(l.ref)).toBe("nouvelle"); // 100 h < 168 h
    await vieillir(l.ref, 169);
    await expirer();
    expect(await statut(l.ref)).toBe("annulee");
  });
  it("ne touche JAMAIS une commande confirmée (ni prête, ni terminée), même très ancienne ; son stock reste pris", async () => {
    const s = await seed({ stock: 10 });
    const refs: string[] = [];
    for (let i = 0; i < 3; i++) refs.push((await order(s.slug, [ligne(s.variante, 1)], { client: client(10 + i) })).ref as string);
    await q("update public.commandes set statut = 'confirmee' where ref = $1", [refs[0]]);
    await q("update public.commandes set statut = 'confirmee' where ref = $1", [refs[1]]);
    await q("update public.commandes set statut = 'prete' where ref = $1", [refs[1]]);
    await q("update public.commandes set statut = 'confirmee' where ref = $1", [refs[2]]);
    await q("update public.commandes set statut = 'prete' where ref = $1", [refs[2]]);
    await q("update public.commandes set statut = 'terminee' where ref = $1", [refs[2]]);
    for (const r of refs) await vieillir(r, 5000);
    expect(await expirer()).toBe(0);
    expect(await Promise.all(refs.map(statut))).toEqual(["confirmee", "prete", "terminee"]);
    expect(await stock(s.variante)).toBe(7);
  });
  it("remet le stock UNE SEULE FOIS : 2 passages, puis un changement tardif de statut refusé", async () => {
    const s = await seed({ stock: 10 });
    const c = await order(s.slug, [ligne(s.variante, 5)]);
    await vieillir(c.ref, 60);
    expect(await expirer()).toBe(1);
    expect(await expirer()).toBe(0);
    expect(await stock(s.variante)).toBe(10);
    await q("update public.commandes set statut = 'annulee' where ref = $1", [c.ref]); // même statut : sans effet
    await expect(q("update public.commandes set statut = 'confirmee' where ref = $1", [c.ref])).rejects.toThrow(/statut/i);
    expect(await stock(s.variante)).toBe(10);
  });
  it("appels simultanés (simulation sur une seule connexion) : une commande n'est annulée qu'une fois, le stock aussi", async () => {
    const s = await seed({ stock: 10 });
    const c = await order(s.slug, [ligne(s.variante, 6)]);
    await vieillir(c.ref, 60);
    const r = await Promise.all([expirer(), expirer(), expirer()]);
    expect(r.reduce((a, b) => a + b, 0)).toBe(1);
    expect(await stock(s.variante)).toBe(10);
  });
  it("les boutiques sont indépendantes : chacune son délai, et l'échec de l'une n'empêche pas l'autre", async () => {
    const x = await seed({ delai: 6, stock: 10 });
    const y = await seed({ delai: 168, stock: 10 });
    const z = await seed({ delai: 6, stock: 10 });
    const cx = await order(x.slug, [ligne(x.variante, 2)]);
    const cy = await order(y.slug, [ligne(y.variante, 2)]);
    const cz = await order(z.slug, [ligne(z.variante, 2)]);
    for (const r of [cx.ref, cy.ref, cz.ref]) await vieillir(r, 10);
    // Panne simulée sur la boutique Z : toute annulation y échoue.
    await db.exec(`create function public.zz_panne() returns trigger language plpgsql as $$ begin
      if new.boutique_id = '${z.id}' and new.statut = 'annulee' then raise exception 'panne simulée'; end if; return new; end $$;
      create trigger zz_panne before update on public.commandes for each row execute function public.zz_panne();`);
    try {
      expect(await expirer()).toBe(1);
    } finally {
      await db.exec("drop trigger zz_panne on public.commandes; drop function public.zz_panne();");
    }
    expect(await statut(cx.ref)).toBe("annulee");
    expect(await statut(cy.ref)).toBe("nouvelle"); // délai de 168 h
    expect(await statut(cz.ref)).toBe("nouvelle"); // en échec, rien de partiel
    expect(await stock(x.variante)).toBe(10); // annulée : stock remis
    expect(await stock(z.variante)).toBe(8); // Z : toujours réservé, rien de partiel (sous-transaction annulée)
    expect(await expirer()).toBe(1); // la panne a disparu : Z est traitée au passage suivant
    expect(await stock(z.variante)).toBe(10);
  });
  it("réservée au serveur : anon et authenticated refusés", async () => {
    await expect(as("anon", null, "select public.boutique_expirer_commandes_nouvelles()")).rejects.toThrow(/permission denied/);
    await expect(as("authenticated", A, "select public.boutique_expirer_commandes_nouvelles()")).rejects.toThrow(/permission denied/);
  });
  it("la version à argument de 0008 reste utilisable (âge forcé pour toutes les boutiques)", async () => {
    const s = await seed({ delai: 168 });
    const c = await order(s.slug, [ligne(s.variante, 1)]);
    await vieillir(c.ref, 30);
    const r = await as<{ n: number }>("service_role", null, "select public.boutique_expirer_commandes_nouvelles(interval '24 hours') as n");
    expect(Number(r[0]!.n)).toBeGreaterThanOrEqual(1);
    expect(await statut(c.ref)).toBe("annulee");
  });
});

describe("limites anti-abus en base (boutique_creer_commande)", () => {
  it("quantité par article : 10 par défaut (10 passe, 11 refusé), y compris répartie sur plusieurs lignes", async () => {
    const s = await seed();
    await order(s.slug, [ligne(s.variante, 10)], { client: client(20) });
    await expect(order(s.slug, [ligne(s.variante, 11)], { client: client(21) })).rejects.toThrow(/E_QUANTITE_MAX/);
    await expect(order(s.slug, [ligne(s.variante, 6), ligne(s.variante, 5)], { client: client(22) })).rejects.toThrow(/E_QUANTITE_MAX/);
  });
  it("quantité réglable par la boutique, jusqu'à 99", async () => {
    const s = await seed({ qmax: 3, stock: 500 });
    await order(s.slug, [ligne(s.variante, 3)], { client: client(30) });
    await expect(order(s.slug, [ligne(s.variante, 4)], { client: client(31) })).rejects.toThrow(/E_QUANTITE_MAX/);
    await q("update public.boutiques set quantite_max_article = 99 where id = $1", [s.id]);
    await expect(order(s.slug, [ligne(s.variante, 51)], { client: client(32) })).rejects.toThrow(/E_ARTICLES_MAX/); // 99 par article mais 50 par commande
  });
  it("articles par commande : 50 passent, 51 refusés", async () => {
    const s = await seed({ qmax: 25, nbVariantes: 3, stock: 100 });
    await order(s.slug, [ligne(s.variantes[0]!, 25), ligne(s.variantes[1]!, 25)], { client: client(40) });
    await expect(order(s.slug, [ligne(s.variantes[0]!, 17), ligne(s.variantes[1]!, 17), ligne(s.variantes[2]!, 17)], { client: client(41) })).rejects.toThrow(/E_ARTICLES_MAX/);
    expect(QUANTITE_TOTALE_MAX).toBe(50); // même valeur côté TypeScript
  });
  it("commandes en attente par contact : 2 au plus ; confirmer ou expirer libère une place ; autre contact libre", async () => {
    const s = await seed();
    const c = client(50);
    const a = await order(s.slug, [ligne(s.variante, 1)], { client: c });
    const b = await order(s.slug, [ligne(s.variante, 1)], { client: c });
    await expect(order(s.slug, [ligne(s.variante, 1)], { client: c })).rejects.toThrow(/E_CONTACT_TROP_DE_COMMANDES/);
    await order(s.slug, [ligne(s.variante, 1)], { client: client(51) });
    await q("update public.commandes set statut = 'confirmee' where ref = $1", [a.ref]);
    await order(s.slug, [ligne(s.variante, 1)], { client: c }); // une place libérée
    await expect(order(s.slug, [ligne(s.variante, 1)], { client: c })).rejects.toThrow(/E_CONTACT_TROP_DE_COMMANDES/);
    await vieillir(b.ref, 60);
    await expirer();
    await order(s.slug, [ligne(s.variante, 1)], { client: c });
  });
  it("commandes « nouvelle » simultanées par boutique : 50 au plus", async () => {
    const s = await seed({ stock: 1000 });
    for (let i = 0; i < 50; i++) await order(s.slug, [ligne(s.variante, 1)], { client: client(1000 + i) });
    await expect(order(s.slug, [ligne(s.variante, 1)], { client: client(2000) })).rejects.toThrow(/E_TROP_DE_NOUVELLES/);
    // Une confirmation libère une place.
    const [une] = await q<{ ref: string }>("select ref from public.commandes where boutique_id = $1 limit 1", [s.id]);
    await q("update public.commandes set statut = 'confirmee' where ref = $1", [une!.ref]);
    await order(s.slug, [ligne(s.variante, 1)], { client: client(2001) });
  });
  it("données invalides : quantité nulle, négative, décimale, texte, trop longue ; article inconnu ; stock insuffisant", async () => {
    const s = await seed({ stock: 2 });
    for (const bad of [0, -1, 1.5, "3", 100, null]) await expect(order(s.slug, [{ variante_id: s.variante, quantite: bad }], { client: client(60) })).rejects.toThrow(/E_QUANTITE_INVALIDE/);
    await expect(order(s.slug, [{ variante_id: "pas-un-uuid", quantite: 1 }], { client: client(61) })).rejects.toThrow(/E_QUANTITE_INVALIDE/);
    await expect(order(s.slug, [], { client: client(62) })).rejects.toThrow(/E_QUANTITE_INVALIDE/);
    await expect(order(s.slug, [ligne("33333333-3333-4333-8333-333333333333", 1)], { client: client(63) })).rejects.toThrow(/E_PRODUIT_INDISPONIBLE/);
    await expect(order(s.slug, [ligne(s.variante, 3)], { client: client(64) })).rejects.toThrow(/E_STOCK_INSUFFISANT/);
    expect(await stock(s.variante)).toBe(2); // aucun échec n'a réservé de stock
  });
});

describe("validations TypeScript (mêmes valeurs que la base)", () => {
  const V = "44444444-4444-4444-8444-444444444444";
  const W = "55555555-5555-4555-8555-555555555555";
  const base = (lignes: unknown[]) => ({ slug: "chez-awa", cle: "cle-1234567890abcdef", mode: "retrait", client: { nom: "Awa", email: "a@exemple.fr" }, lignes });
  it("délai : 6 à 168, entier", () => {
    for (const ok of [6, 48, 168]) expect(validateBoutique({ delai_expiration_h: ok }, true).ok).toBe(true);
    for (const ko of [5, 169, 0, -3, 48.5, "48", null, NaN]) expect(validateBoutique({ delai_expiration_h: ko }, true).ok).toBe(false);
  });
  it("quantité maximale par article : 1 à 99, entier", () => {
    for (const ok of [1, 10, 99]) expect(validateBoutique({ quantite_max_article: ok }, true).ok).toBe(true);
    for (const ko of [0, 100, 2.5, "10", null]) expect(validateBoutique({ quantite_max_article: ko }, true).ok).toBe(false);
  });
  it("quantité par article selon la boutique", () => {
    expect(validateCommande(base([{ variante_id: V, quantite: 10 }]), 10).ok).toBe(true);
    expect(validateCommande(base([{ variante_id: V, quantite: 11 }]), 10).ok).toBe(false);
    expect(validateCommande(base([{ variante_id: V, quantite: 6 }, { variante_id: V, quantite: 5 }]), 10).ok).toBe(false);
    expect(validateCommande(base([{ variante_id: V, quantite: 99 }])).ok).toBe(false); // 99 > 50 articles par commande
  });
  it("50 articles par commande, pas 51", () => {
    expect(validateCommande(base([{ variante_id: V, quantite: 25 }, { variante_id: W, quantite: 25 }]), 99).ok).toBe(true);
    expect(validateCommande(base([{ variante_id: V, quantite: 26 }, { variante_id: W, quantite: 25 }]), 99).ok).toBe(false);
  });
});

describe("calculs d'expiration et texte acheteur", () => {
  it("délai et quantité : valeurs par défaut si absentes ou invalides", () => {
    expect([delaiValide(undefined), delaiValide(5), delaiValide(169), delaiValide(24)]).toEqual([48, 48, 48, 24]);
    expect([quantiteMaxValide(undefined), quantiteMaxValide(0), quantiteMaxValide(100), quantiteMaxValide(7)]).toEqual([10, 10, 10, 7]);
  });
  it("date d'expiration, temps restant et expiré", () => {
    const cree = "2026-11-15T10:00:00.000Z";
    expect(dateExpiration(cree, 48)).toBe("2026-11-17T10:00:00.000Z");
    expect(dateExpiration(cree, 6)).toBe("2026-11-15T16:00:00.000Z");
    expect(dateExpiration("pas une date", 48)).toBeNull();
    const t0 = Date.parse(cree);
    expect(tempsRestantLabel(restantMs(cree, 48, t0))).toBe("2 j 0 h");
    expect(tempsRestantLabel(restantMs(cree, 6, t0 + 5.5 * 3_600_000))).toBe("30 min");
    expect(tempsRestantLabel(restantMs(cree, 6, t0 + 1 * 3_600_000))).toBe("5 h 00 min");
    expect(tempsRestantLabel(restantMs(cree, 6, t0 + 7 * 3_600_000))).toMatch(/Expirée/);
    expect(tempsRestantLabel(null)).toBe("Date inconnue");
  });
  it("le texte acheteur affiche le délai réel de la boutique", () => {
    expect(texteExpirationAcheteur(48)).toBe("Sans confirmation de la boutique sous 48 heures, ta commande sera automatiquement annulée.");
    expect(texteExpirationAcheteur(24)).toContain("sous 24 heures");
    expect(texteExpirationAcheteur(undefined)).toContain("sous 48 heures"); // avant la migration 0010
  });
});

describe("Cloudflare Turnstile (vérification serveur, faux Cloudflare)", () => {
  afterEach(() => vi.unstubAllEnvs());
  const cf = (body: unknown, status = 200) => vi.fn(async () => new Response(JSON.stringify(body), { status })) as unknown as typeof fetch;
  it("non configuré : ignoré, la commande passe sans jeton (comportement local)", async () => {
    vi.stubEnv("TURNSTILE_SECRET_KEY", "");
    const f = cf({ success: false });
    expect(turnstileActif()).toBe(false);
    expect(await verifierTurnstile(undefined, "1.2.3.4", f)).toEqual({ ok: true, skipped: true });
    expect(f).not.toHaveBeenCalled();
  });
  it("activé : jeton absent ou vide = refus, sans appeler Cloudflare", async () => {
    vi.stubEnv("TURNSTILE_SECRET_KEY", "secret-de-test");
    const f = cf({ success: true });
    for (const t of [undefined, null, "", "   ", 42]) expect(await verifierTurnstile(t, "1.2.3.4", f)).toEqual({ ok: false, reason: "absent" });
    expect(f).not.toHaveBeenCalled();
  });
  it("activé : jeton invalide = refus ; jeton valide = autorisé ; la clé secrète part vers Cloudflare seulement", async () => {
    vi.stubEnv("TURNSTILE_SECRET_KEY", "secret-de-test");
    expect(await verifierTurnstile("mauvais", "1.2.3.4", cf({ success: false, "error-codes": ["invalid-input-response"] }))).toEqual({ ok: false, reason: "invalide" });
    const f = cf({ success: true });
    expect(await verifierTurnstile("bon-jeton", "1.2.3.4", f)).toEqual({ ok: true, skipped: false });
    const [url, init] = (f as unknown as { mock: { calls: [string, RequestInit][] } }).mock.calls[0]!;
    expect(url).toBe("https://challenges.cloudflare.com/turnstile/v0/siteverify");
    const corps = String((init.body as URLSearchParams).toString());
    expect(corps).toContain("secret=secret-de-test");
    expect(corps).toContain("response=bon-jeton");
    expect(corps).toContain("remoteip=1.2.3.4");
  });
  it("erreurs temporaires (Cloudflare en panne, réseau, erreur interne) : refus « indisponible », jamais un passage", async () => {
    vi.stubEnv("TURNSTILE_SECRET_KEY", "secret-de-test");
    expect(await verifierTurnstile("j", "1.1.1.1", cf({}, 500))).toEqual({ ok: false, reason: "indisponible" });
    expect(await verifierTurnstile("j", "1.1.1.1", (async () => { throw new Error("réseau"); }) as unknown as typeof fetch)).toEqual({ ok: false, reason: "indisponible" });
    expect(await verifierTurnstile("j", "1.1.1.1", cf({ success: false, "error-codes": ["internal-error"] }))).toEqual({ ok: false, reason: "indisponible" });
    expect(await verifierTurnstile("j", "1.1.1.1", (async () => new Response("pas du json", { status: 200 })) as unknown as typeof fetch)).toEqual({ ok: false, reason: "invalide" });
  });
  it("jeton démesuré refusé sans appel réseau", async () => {
    vi.stubEnv("TURNSTILE_SECRET_KEY", "secret-de-test");
    const f = cf({ success: true });
    expect(await verifierTurnstile("x".repeat(5000), "1.1.1.1", f)).toEqual({ ok: false, reason: "invalide" });
    expect(f).not.toHaveBeenCalled();
  });
});
