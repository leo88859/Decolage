import { readFileSync } from "node:fs";
import { PGlite, type Transaction } from "@electric-sql/pglite";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { PLANS } from "@/lib/plans";
import type { Plan } from "@/lib/types";

// Migrations 0001 à 0005 dans un vrai PostgreSQL (PGlite) : persistance, RLS, création de commande, stock, limites.
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
const refused = (p: Promise<unknown>) => expect(p).rejects.toThrow(/permission denied|row-level security|violates|Limite|impossible|propriétaire/);
const setPlan = (uid: string, plan: Plan) => db.query("update public.profiles set plan = $2 where id = $1", [uid, plan]);

type Shop = { id: string; produit: string; variante: string; variante2: string };
/** Boutique complète créée par le serveur (admin) : 1 produit à 10,00 € avec 2 variantes (stock 5 et 1). */
async function seed(owner: string, slug: string, statut = "publiee"): Promise<Shop> {
  const b = (await db.query<{ id: string }>("insert into public.boutiques (proprietaire_id, slug, nom, statut, modes) values ($1,$2,$3,$4,'{retrait,livraison,contact}') returning id", [owner, slug, `Boutique ${slug}`, statut])).rows[0]!.id;
  const p = (await db.query<{ id: string }>("insert into public.produits (boutique_id, titre, prix_centimes) values ($1,'T-shirt',1000) returning id", [b])).rows[0]!.id;
  const v1 = (await db.query<{ id: string }>("insert into public.variantes (produit_id, boutique_id, nom, stock) values ($1,$2,'M',5) returning id", [p, b])).rows[0]!.id;
  const v2 = (await db.query<{ id: string }>("insert into public.variantes (produit_id, boutique_id, nom, stock) values ($1,$2,'L',1) returning id", [p, b])).rows[0]!.id;
  return { id: b, produit: p, variante: v1, variante2: v2 };
}
let n = 0;
const key = () => `cle-${String(++n).padStart(6, "0")}-abcdefghij`;
const CLIENT = { nom: "Awa Diop", email: "awa@exemple.fr", telephone: "+221770000000" };
function order(slug: string, lignes: unknown[], over: { cle?: string; mode?: string; client?: unknown } = {}) {
  return as<{ r: Record<string, unknown> }>("service_role", null, "select public.boutique_creer_commande($1,$2,$3::jsonb,$4,$5::jsonb) as r", [
    slug, over.cle ?? key(), JSON.stringify(over.client ?? CLIENT), over.mode ?? "retrait", JSON.stringify(lignes),
  ]).then((rows) => rows[0]!.r);
}
const stock = async (variante: string) => (await db.query<{ stock: number }>("select stock from public.variantes where id = $1", [variante])).rows[0]!.stock;
const nbCommandes = async () => (await db.query("select 1 from public.commandes")).rows.length;

beforeAll(async () => {
  db = new PGlite();
  await db.exec(SUPABASE_STUB);
  for (const f of ["0001_schema.sql", "0002_conformite.sql", "0003_marque_blanche.sql", "0004_limites_serveur.sql", "0005_boutique.sql", "0006_regle_gratuit.sql", "0007_durcissement.sql"]) await db.exec(sql(f));
  await db.exec(sql("0005_boutique.sql")); // rejouable sans erreur
  await db.exec(sql("0006_regle_gratuit.sql"));
  await db.exec(sql("0007_durcissement.sql")); // rejouable sans erreur (0007 a le dernier mot : rejouée en dernier)
  await db.query("insert into auth.users (id) values ($1), ($2)", [A, B]);
});
beforeEach(async () => {
  await db.query("delete from public.boutiques"); // cascade : catégories, produits, variantes, commandes, lignes
  await db.query("delete from public.sites");
  await setPlan(A, "illimite");
  await setPlan(B, "illimite");
});

describe("persistance et isolation entre commerçants (RLS)", () => {
  it("le commerçant crée sa boutique, une catégorie, un produit et une variante depuis le navigateur, et les relit", async () => {
    const [b] = await as<{ id: string }>("authenticated", A, "insert into public.boutiques (proprietaire_id, slug, nom) values ($1,'chez-awa','Chez Awa') returning id", [A]);
    const [c] = await as<{ id: string }>("authenticated", A, "insert into public.categories (boutique_id, nom) values ($1,'Habits') returning id", [b!.id]);
    const [p] = await as<{ id: string }>("authenticated", A, "insert into public.produits (boutique_id, categorie_id, titre, prix_centimes) values ($1,$2,'Robe',2599) returning id", [b!.id, c!.id]);
    await as("authenticated", A, "insert into public.variantes (produit_id, boutique_id, nom, stock) values ($1,$2,'M',3)", [p!.id, b!.id]);
    const rows = await as<{ titre: string; prix_centimes: number; stock: number }>("authenticated", A, "select p.titre, p.prix_centimes, v.stock from public.produits p join public.variantes v on v.produit_id = p.id");
    expect(rows).toEqual([{ titre: "Robe", prix_centimes: 2599, stock: 3 }]);
    expect((await as<{ statut: string }>("authenticated", A, "select statut from public.boutiques"))[0]!.statut).toBe("brouillon");
  });

  it("un commerçant ne voit, ne modifie et ne supprime rien chez l'autre (même en brouillon)", async () => {
    const sb = await seed(B, "boutique-b", "brouillon");
    expect(await as("authenticated", A, "select id from public.boutiques where id = $1", [sb.id])).toEqual([]);
    expect(await as("authenticated", A, "select id from public.produits")).toEqual([]);
    expect(await as("authenticated", A, "select id from public.variantes")).toEqual([]);
    expect(await as("authenticated", A, "update public.produits set prix_centimes = 1 where id = $1 returning id", [sb.produit])).toEqual([]);
    expect(await as("authenticated", A, "update public.variantes set stock = 999 where id = $1 returning id", [sb.variante])).toEqual([]);
    expect(await as("authenticated", A, "delete from public.produits where id = $1 returning id", [sb.produit])).toEqual([]);
    expect(await as("authenticated", A, "update public.boutiques set nom = 'volée' where id = $1 returning id", [sb.id])).toEqual([]);
    await refused(as("authenticated", A, "insert into public.produits (boutique_id, titre, prix_centimes) values ($1,'intrus',100)", [sb.id]));
    await refused(as("authenticated", A, "insert into public.variantes (produit_id, boutique_id, nom) values ($1,$2,'X')", [sb.produit, sb.id]));
    await refused(as("authenticated", A, "insert into public.boutiques (proprietaire_id, slug, nom) values ($1,'usurpee','x')", [B]));
    expect(await stock(sb.variante)).toBe(5);
  });

  it("le propriétaire d'une boutique ne peut pas être changé", async () => {
    const sa = await seed(A, "boutique-a");
    await refused(as("authenticated", A, "update public.boutiques set proprietaire_id = $2 where id = $1", [sa.id, B]));
  });

  it("une catégorie d'une autre boutique ne peut pas être rattachée à un produit", async () => {
    const sa = await seed(A, "boutique-a");
    const sb = await seed(B, "boutique-b");
    const [cat] = await as<{ id: string }>("authenticated", B, "insert into public.categories (boutique_id, nom) values ($1,'Privée') returning id", [sb.id]);
    await refused(as("authenticated", A, "update public.produits set categorie_id = $2 where id = $1", [sa.produit, cat!.id]));
  });
});

describe("lecture publique : seulement les boutiques publiées et les produits actifs", () => {
  it("un brouillon est invisible pour le public, avec ses produits et variantes", async () => {
    const d = await seed(A, "brouillon-a", "brouillon");
    expect(await as("anon", null, "select id from public.boutiques")).toEqual([]);
    expect(await as("anon", null, "select id from public.produits")).toEqual([]);
    expect(await as("anon", null, "select id from public.variantes_publiques")).toEqual([]);
    expect(await as("authenticated", A, "select id from public.boutiques where id = $1", [d.id])).toHaveLength(1);
  });

  it("une boutique publiée montre ses produits actifs seulement ; un produit inactif disparaît", async () => {
    const s = await seed(A, "vitrine-a");
    expect(await as("anon", null, "select id from public.produits")).toHaveLength(1);
    expect(await as("anon", null, "select id from public.variantes_publiques")).toHaveLength(2); // 0007 : le public lit la vue (sans stock exact)
    await db.query("update public.produits set actif = false where id = $1", [s.produit]);
    expect(await as("anon", null, "select id from public.produits")).toEqual([]);
    expect(await as("anon", null, "select id from public.variantes_publiques")).toEqual([]);
  });

  it("le public ne lit pas l'identifiant du propriétaire et ne peut rien écrire", async () => {
    const s = await seed(A, "vitrine-a");
    await refused(as("anon", null, "select proprietaire_id from public.boutiques"));
    await refused(as("anon", null, "select * from public.boutiques"));
    await refused(as("anon", null, "update public.variantes set stock = 100 where id = $1", [s.variante]));
    await refused(as("anon", null, "update public.produits set prix_centimes = 1 where id = $1", [s.produit]));
    await refused(as("anon", null, "insert into public.produits (boutique_id, titre, prix_centimes) values ($1,'x',1)", [s.id]));
    await refused(as("anon", null, "delete from public.boutiques where id = $1", [s.id]));
  });
});

describe("commandes : le client anonyme ne lit jamais une commande ; le commerçant ne lit que les siennes", () => {
  it("anon : aucune lecture (même sa propre commande), aucune écriture, aucun appel direct à la fonction", async () => {
    const s = await seed(A, "vitrine-a");
    await order("vitrine-a", [{ variante_id: s.variante, quantite: 1 }]);
    await refused(as("anon", null, "select * from public.commandes"));
    await refused(as("anon", null, "select id from public.commandes"));
    await refused(as("anon", null, "select * from public.lignes_commande"));
    await refused(as("anon", null, "insert into public.commandes (ref, boutique_id, cle_idempotence, client_nom, mode, jeton_hash) values ('CMD-X',$1,'cle-0000000000000000','x','retrait','h')", [s.id]));
    await refused(as("anon", null, "select public.boutique_creer_commande('vitrine-a','cle-1234567890123456','{}'::jsonb,'retrait','[]'::jsonb)"));
    await refused(as("authenticated", B, "select public.boutique_creer_commande('vitrine-a','cle-1234567890123456','{}'::jsonb,'retrait','[]'::jsonb)"));
    await refused(as("anon", null, "select public.boutique_suivre_commande('CMD-X','x')"));
  });

  it("isolation : B ne voit pas les commandes de A, ne peut pas changer leur statut ; A les voit avec leurs lignes", async () => {
    const s = await seed(A, "vitrine-a");
    await seed(B, "vitrine-b");
    const r = await order("vitrine-a", [{ variante_id: s.variante, quantite: 2 }]);
    expect(await as("authenticated", B, "select ref from public.commandes")).toEqual([]);
    expect(await as("authenticated", B, "select * from public.lignes_commande")).toEqual([]);
    expect(await as("authenticated", B, "update public.commandes set statut = 'annulee' where ref = $1 returning ref", [r.ref])).toEqual([]);
    const mine = await as("authenticated", A, "select ref, total_centimes::int as total_centimes, paiement from public.commandes");
    expect(mine).toEqual([{ ref: r.ref, total_centimes: 2000, paiement: "non_payee" }]);
    expect(await as("authenticated", A, "select produit_titre, prix_unitaire_centimes, quantite from public.lignes_commande")).toEqual([{ produit_titre: "T-shirt", prix_unitaire_centimes: 1000, quantite: 2 }]);
  });

  it("le commerçant ne peut modifier que le statut : ni total, ni paiement, ni lignes, ni création, ni suppression", async () => {
    const s = await seed(A, "vitrine-a");
    const r = await order("vitrine-a", [{ variante_id: s.variante, quantite: 1 }]);
    await refused(as("authenticated", A, "update public.commandes set total_centimes = 1 where ref = $1", [r.ref]));
    await refused(as("authenticated", A, "update public.commandes set paiement = 'payee' where ref = $1", [r.ref]));
    await refused(as("authenticated", A, "update public.lignes_commande set quantite = 9"));
    await refused(as("authenticated", A, "delete from public.commandes"));
    await refused(as("authenticated", A, "select jeton_hash from public.commandes"));
    // même l'administrateur ne peut pas écrire « payée » (contrainte)
    await expect(db.query("update public.commandes set paiement = 'payee' where ref = $1", [r.ref])).rejects.toThrow(/violates/);
  });
});

describe("création de commande : prix, stock, statuts", () => {
  it("ignore tout prix, total ou paiement envoyé : le total vient des prix en base", async () => {
    const s = await seed(A, "vitrine-a");
    const r = await order("vitrine-a", [{ variante_id: s.variante, quantite: 3, prix_centimes: 1, prix: 0.01, total_centimes: 1 }], {
      client: { ...CLIENT, total_centimes: 1, paiement: "payee", statut: "terminee" },
    });
    expect(r).toMatchObject({ total_centimes: 3000, paiement: "non_payee", statut: "nouvelle", rejouee: false });
    expect(String(r.ref)).toMatch(/^CMD-[0-9A-F]{12}$/);
    expect(typeof r.jeton_suivi).toBe("string");
    const row = (await db.query<{ statut: string; paiement: string }>("select statut, paiement from public.commandes")).rows[0]!;
    expect(row).toEqual({ statut: "nouvelle", paiement: "non_payee" });
  });

  it("la ligne garde une copie du titre et du prix : changer le prix ensuite ne modifie pas la commande", async () => {
    const s = await seed(A, "vitrine-a");
    await order("vitrine-a", [{ variante_id: s.variante, quantite: 1 }]);
    await db.query("update public.produits set titre = 'Autre', prix_centimes = 5000 where id = $1", [s.produit]);
    const l = (await db.query<{ produit_titre: string; prix_unitaire_centimes: number }>("select produit_titre, prix_unitaire_centimes from public.lignes_commande")).rows[0]!;
    expect(l).toEqual({ produit_titre: "T-shirt", prix_unitaire_centimes: 1000 });
  });

  it("décrémente le stock ; refuse un stock insuffisant sans rien écrire (tout ou rien)", async () => {
    const s = await seed(A, "vitrine-a");
    await order("vitrine-a", [{ variante_id: s.variante, quantite: 5 }]);
    expect(await stock(s.variante)).toBe(0);
    await expect(order("vitrine-a", [{ variante_id: s.variante2, quantite: 1 }, { variante_id: s.variante, quantite: 1 }])).rejects.toThrow(/E_STOCK_INSUFFISANT/);
    expect(await stock(s.variante2)).toBe(1); // la ligne valide n'a pas été prélevée
    expect(await nbCommandes()).toBe(1);
  });

  it("deux commandes simultanées sur le dernier article : une seule passe", async () => {
    const s = await seed(A, "vitrine-a");
    const res = await Promise.allSettled([
      order("vitrine-a", [{ variante_id: s.variante2, quantite: 1 }]),
      order("vitrine-a", [{ variante_id: s.variante2, quantite: 1 }]),
      order("vitrine-a", [{ variante_id: s.variante2, quantite: 1 }]),
    ]);
    expect(res.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(res.filter((r) => r.status === "rejected")).toHaveLength(2);
    expect(await stock(s.variante2)).toBe(0);
    expect(await nbCommandes()).toBe(1);
  });

  it("idempotence : même clé = même commande, une seule décrémentation, y compris envois simultanés", async () => {
    const s = await seed(A, "vitrine-a");
    const cle = key();
    const [r1, r2, r3] = await Promise.all([1, 2, 3].map(() => order("vitrine-a", [{ variante_id: s.variante, quantite: 2 }], { cle })));
    expect(new Set([r1!.ref, r2!.ref, r3!.ref]).size).toBe(1);
    expect([r1, r2, r3].filter((r) => r!.rejouee === false)).toHaveLength(1);
    expect(await stock(s.variante)).toBe(3);
    const again = await order("vitrine-a", [{ variante_id: s.variante, quantite: 2 }], { cle });
    expect(again).toMatchObject({ ref: r1!.ref, rejouee: true });
    expect(again.jeton_suivi).toBeUndefined(); // le jeton n'est donné qu'une fois
  });

  it("refuse : boutique brouillon ou inconnue, produit/variante inactif, variante d'une autre boutique, quantités invalides", async () => {
    const d = await seed(A, "brouillon-a", "brouillon");
    const s = await seed(A, "vitrine-a");
    const o = await seed(B, "vitrine-b");
    await expect(order("brouillon-a", [{ variante_id: d.variante, quantite: 1 }])).rejects.toThrow(/E_BOUTIQUE_INTROUVABLE/);
    await expect(order("inconnue-x", [{ variante_id: s.variante, quantite: 1 }])).rejects.toThrow(/E_BOUTIQUE_INTROUVABLE/);
    await expect(order("vitrine-a", [{ variante_id: o.variante, quantite: 1 }])).rejects.toThrow(/E_PRODUIT_INDISPONIBLE/);
    await expect(order("vitrine-a", [{ variante_id: "00000000-0000-4000-8000-0000000000ff", quantite: 1 }])).rejects.toThrow(/E_PRODUIT_INDISPONIBLE/);
    for (const q of [0, -1, 1.5, 100, "2", null]) {
      await expect(order("vitrine-a", [{ variante_id: s.variante, quantite: q }])).rejects.toThrow(/E_QUANTITE_INVALIDE/);
    }
    await expect(order("vitrine-a", [])).rejects.toThrow(/E_QUANTITE_INVALIDE/);
    await expect(order("vitrine-a", [{ variante_id: "pas-un-uuid", quantite: 1 }])).rejects.toThrow(/E_QUANTITE_INVALIDE/);
    await db.query("update public.variantes set actif = false where id = $1", [s.variante]);
    await expect(order("vitrine-a", [{ variante_id: s.variante, quantite: 1 }])).rejects.toThrow(/E_PRODUIT_INDISPONIBLE/);
    await db.query("update public.variantes set actif = true where id = $1", [s.variante]);
    await db.query("update public.produits set actif = false where id = $1", [s.produit]);
    await expect(order("vitrine-a", [{ variante_id: s.variante, quantite: 1 }])).rejects.toThrow(/E_PRODUIT_INDISPONIBLE/);
    expect(await nbCommandes()).toBe(0);
  });

  it("refuse les coordonnées invalides, un mode non proposé, une clé d'idempotence invalide", async () => {
    const s = await seed(A, "vitrine-a");
    const l = [{ variante_id: s.variante, quantite: 1 }];
    await expect(order("vitrine-a", l, { client: { nom: "A", email: "pas-un-mail" } })).rejects.toThrow(/E_CLIENT_INVALIDE/);
    await expect(order("vitrine-a", l, { client: { nom: "", email: "a@b.fr" } })).rejects.toThrow(/E_CLIENT_INVALIDE/);
    await expect(order("vitrine-a", l, { client: { nom: "A" } })).rejects.toThrow(/E_CLIENT_INVALIDE/);
    await expect(order("vitrine-a", l, { mode: "livraison" })).rejects.toThrow(/E_CLIENT_INVALIDE/); // adresse obligatoire
    await expect(order("vitrine-a", l, { mode: "poste" })).rejects.toThrow(/E_MODE_INVALIDE/);
    await expect(order("vitrine-a", l, { cle: "court" })).rejects.toThrow(/E_CLE_INVALIDE/);
    await db.query("update public.boutiques set modes = '{retrait}' where id = $1", [s.id]);
    await expect(order("vitrine-a", l, { mode: "livraison", client: { ...CLIENT, adresse: "1 rue X" } })).rejects.toThrow(/E_MODE_INVALIDE/);
  });

  it("une injection SQL dans le nom ou la note est stockée comme du texte, sans effet", async () => {
    const s = await seed(A, "vitrine-a");
    await order("vitrine-a", [{ variante_id: s.variante, quantite: 1 }], { client: { ...CLIENT, nom: "x'); drop table public.commandes; --", note: "'; delete from public.produits; --" } });
    expect((await db.query("select 1 from public.produits")).rows).toHaveLength(1);
    expect((await db.query<{ client_nom: string }>("select client_nom from public.commandes")).rows[0]!.client_nom).toContain("drop table");
  });

  it("lignes répétées de la même variante : additionnées, vérifiées ensemble contre le stock", async () => {
    const s = await seed(A, "vitrine-a");
    await expect(order("vitrine-a", [{ variante_id: s.variante, quantite: 3 }, { variante_id: s.variante, quantite: 3 }])).rejects.toThrow(/E_STOCK_INSUFFISANT/);
    const r = await order("vitrine-a", [{ variante_id: s.variante, quantite: 2 }, { variante_id: s.variante, quantite: 2 }]);
    expect(r.total_centimes).toBe(4000);
    expect(await stock(s.variante)).toBe(1);
  });

  it("statuts : parcours autorisé, retours et sauts refusés, annulation = stock remis une seule fois", async () => {
    const s = await seed(A, "vitrine-a");
    const r = await order("vitrine-a", [{ variante_id: s.variante, quantite: 2 }]);
    const set = (st: string) => as("authenticated", A, "update public.commandes set statut = $2 where ref = $1 returning statut", [r.ref, st]);
    await refused(set("terminee")); // saut
    await refused(set("prete"));
    expect(await set("confirmee")).toEqual([{ statut: "confirmee" }]);
    await refused(set("nouvelle")); // retour
    await refused(set("bidon"));
    expect(await stock(s.variante)).toBe(3);
    expect(await set("annulee")).toEqual([{ statut: "annulee" }]);
    expect(await stock(s.variante)).toBe(5);
    await refused(set("confirmee")); // annulée = définitif
    await refused(set("prete"));
    expect(await stock(s.variante)).toBe(5);
    const r2 = await order("vitrine-a", [{ variante_id: s.variante, quantite: 1 }]);
    for (const st of ["confirmee", "prete", "terminee"]) await as("authenticated", A, "update public.commandes set statut = $2 where ref = $1", [r2.ref, st]);
    await refused(as("authenticated", A, "update public.commandes set statut = 'annulee' where ref = $1", [r2.ref]));
  });

  it("suivi par jeton : bon jeton oui, mauvais jeton ou mauvaise référence non ; le jeton n'est pas stocké en clair", async () => {
    const s = await seed(A, "vitrine-a");
    const r = await order("vitrine-a", [{ variante_id: s.variante, quantite: 1 }]);
    const suivre = (ref: string, j: string) => as<{ r: Record<string, unknown> | null }>("service_role", null, "select public.boutique_suivre_commande($1,$2) as r", [ref, j]).then((x) => x[0]!.r);
    expect(await suivre(r.ref as string, r.jeton_suivi as string)).toMatchObject({ statut: "nouvelle", paiement: "non_payee", total_centimes: 1000 });
    expect(await suivre(r.ref as string, "mauvais")).toBeNull();
    expect(await suivre("CMD-00000000", r.jeton_suivi as string)).toBeNull();
    expect(JSON.stringify((await db.query("select * from public.commandes")).rows)).not.toContain(r.jeton_suivi as string);
  });
});

describe("limites de formule", () => {
  it("plan_max_sites reprend maxSites de plans.ts", async () => {
    for (const p of Object.keys(PLANS) as Plan[]) {
      const v = (await db.query<{ v: number | null }>("select public.plan_max_sites($1) as v", [p])).rows[0]!.v;
      expect(v ?? Infinity).toBe(PLANS[p].maxSites);
    }
  });

  it("Gratuit : 1 boutique (règle 0006) ; Solo en a 1 ; Pro 5 ; Illimité sans limite", async () => {
    const make = (slug: string) => as("authenticated", A, "insert into public.boutiques (proprietaire_id, slug, nom) values ($1,$2,'x')", [A, slug]);
    await setPlan(A, "gratuit");
    await make("une-boutique");
    await refused(make("deux-boutiques"));
    await db.query("delete from public.boutiques");
    await setPlan(A, "solo");
    await make("boutique-un");
    await refused(make("boutique-deux"));
    await setPlan(A, "pro");
    for (let i = 2; i <= 5; i++) await make(`boutique-${i}x`);
    await refused(make("boutique-6x"));
    await setPlan(A, "illimite");
    await make("boutique-6x");
  });

  it("publier une boutique compte avec les sites publiés (Solo : 1 site OU 1 boutique)", async () => {
    await setPlan(A, "solo");
    await db.query("insert into public.projects (user_id, id, data) values ($1,'proj1','{}'::jsonb)", [A]);
    await db.query("insert into public.sites (slug, user_id, project_id, data) values ('mon-site',$1,'proj1','{}'::jsonb)", [A]);
    const [b] = await as<{ id: string }>("authenticated", A, "insert into public.boutiques (proprietaire_id, slug, nom) values ($1,'ma-boutique','x') returning id", [A]);
    await refused(as("authenticated", A, "update public.boutiques set statut = 'publiee' where id = $1", [b!.id]));
    await db.query("delete from public.sites");
    expect(await as("authenticated", A, "update public.boutiques set statut = 'publiee' where id = $1 returning published_at", [b!.id])).toHaveLength(1);
    await as("authenticated", A, "update public.boutiques set statut = 'brouillon', nom = 'y' where id = $1", [b!.id]);
  });

  it("après une résiliation, les boutiques existantes restent modifiables (rien n'est retiré)", async () => {
    await seed(A, "vitrine-a");
    await setPlan(A, "gratuit");
    expect(await as("authenticated", A, "update public.boutiques set nom = 'nouveau nom' returning id")).toHaveLength(1);
    // règle 0006 : une boutique d'un compte devenu Gratuit n'est plus publique, mais le propriétaire la garde
    expect(await as("anon", null, "select id from public.boutiques")).toHaveLength(0);
    expect(await as("authenticated", A, "select id from public.boutiques")).toHaveLength(1);
  });
});
