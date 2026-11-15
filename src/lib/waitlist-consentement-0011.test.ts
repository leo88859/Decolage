import { readFileSync } from "node:fs";
import { PGlite, type Transaction } from "@electric-sql/pglite";
import { beforeAll, describe, expect, it } from "vitest";
import { buildAccountExport, type ExportClient, type ExportQuery } from "./account-export";

// Migration 0011 (consentement de la liste d'attente) et export du compte, exécutés dans un vrai PostgreSQL EN MÉMOIRE (PGlite)
// avec les migrations 0001 à 0010. Ce sont des SIMULATIONS locales : la migration 0011 n'a PAS été exécutée sur la vraie base
// Supabase, et ces tests ne prouvent rien sur la production (rôles Supabase reproduits au minimum, une seule connexion).
const SUPABASE_STUB = `
create role anon nologin;
create role authenticated nologin;
create role service_role nologin bypassrls;
create schema auth;
create table auth.users (id uuid primary key, email text);
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

/** Client d'export branché sur PGlite : requêtes exécutées avec le rôle « authenticated » et l'identité du compte (RLS et droits de colonnes réels). */
function pgClient(uid: string): ExportClient {
  return {
    from: (table) => ({
      select: (cols) => {
        let where = "";
        let params: unknown[] = [];
        let order = "";
        let limit = "";
        const run = () => as<Record<string, unknown>>("authenticated", uid, `select ${cols} from public.${table}${where}${order}${limit}`, params);
        const query = {
          eq(c: string, v: string) { where = ` where ${c}::text = $1`; params = [v]; return query; },
          in(c: string, v: string[]) { where = ` where ${c}::text = any($1::text[])`; params = [v]; return query; },
          order(c: string) { order = ` order by ${c}`; return query; },
          range(a: number, b: number) { limit = ` limit ${b - a + 1} offset ${a}`; return query; },
          then(ok: (v: unknown) => unknown, ko?: (e: unknown) => unknown) {
            return run().then((data) => ({ data, error: null }), (e: unknown) => ({ data: null, error: { message: String(e) } })).then(ok, ko);
          },
        };
        return query as unknown as ExportQuery;
      },
    }),
  };
}

const waitlist = (slug: string) => q<{ email: string; consentement_statut: string; consentement_le: string | null; consentement_texte: string | null }>(
  "select email, consentement_statut, consentement_le, consentement_texte from public.waitlist where slug = $1 order by email", [slug]);
const inscrire = (slug: string, email: string, consent: boolean | null, version: string | null = "2026-11-15") =>
  as<{ r: string }>("service_role", null, "select public.waitlist_inscrire_consent($1,$2,$3,$4) as r", [slug, email, consent, version]).then((x) => x[0]!.r);

async function seedOwner(uid: string, tag: string) {
  await q("insert into public.projects (user_id, id, data) values ($1,$2,$3::jsonb)", [uid, `proj-${tag}`, JSON.stringify({ nom: `Projet ${tag}` })]);
  await q("insert into public.sites (slug, user_id, project_id, data) values ($1,$2,$3,'{\"a\":1}'::jsonb)", [`site-de-${tag}`, uid, `proj-${tag}`]);
  const b = (await q<{ id: string }>("insert into public.boutiques (proprietaire_id, slug, nom, statut) values ($1,$2,$3,'publiee') returning id", [uid, `boutique-${tag}`, `Boutique ${tag}`]))[0]!.id;
  const c = (await q<{ id: string }>("insert into public.categories (boutique_id, nom) values ($1,'Vêtements') returning id", [b]))[0]!.id;
  const p = (await q<{ id: string }>("insert into public.produits (boutique_id, categorie_id, titre, prix_centimes) values ($1,$2,$3,1000) returning id", [b, c, `Produit ${tag}`]))[0]!.id;
  const v = (await q<{ id: string }>("insert into public.variantes (produit_id, boutique_id, nom, stock) values ($1,$2,'M',5) returning id", [p, b]))[0]!.id;
  const o = (await q<{ id: string }>(
    "insert into public.commandes (ref, boutique_id, cle_idempotence, client_nom, client_email, mode, jeton_hash) values ($1,$2,$3,$4,$5,'retrait','HASH-SECRET-DU-JETON') returning id",
    [`CMD-${tag.toUpperCase()}`, b, `cle-secrete-${tag}-0123456789`, `Acheteur ${tag}`, `acheteur-${tag}@exemple.fr`]))[0]!.id;
  await q("insert into public.lignes_commande (commande_id, variante_id, produit_titre, variante_nom, prix_unitaire_centimes, quantite) values ($1,$2,$3,'M',1000,1)", [o, v, `Produit ${tag}`]);
  await q("insert into public.brand_configs (user_id, name, color_primary, color_secondary, color_accent, color_surface, color_text) values ($1,$2,'#111111','#222222','#333333','#444444','#555555')", [uid, `Marque ${tag}`]);
  await q("insert into public.brand_entitlements (user_id, enabled, enabled_at, note) values ($1,true,now(),$2)", [uid, `NOTE-INTERNE-${tag}`]);
}

beforeAll(async () => {
  db = new PGlite();
  await db.exec(SUPABASE_STUB);
  for (const f of ["0001_schema.sql", "0002_conformite.sql", "0003_marque_blanche.sql", "0004_limites_serveur.sql", "0005_boutique.sql", "0006_regle_gratuit.sql", "0007_durcissement.sql", "0008_suspendus_et_expiration.sql", "0009_theme_boutique.sql", "0010_expiration_antiabus.sql"]) await db.exec(sql(f));
  await q("insert into auth.users (id, email) values ($1,'a@exemple.fr'), ($2,'b@exemple.fr')", [A, B]);
  await q("update public.profiles set plan = 'illimite' where id in ($1,$2)", [A, B]);
  await seedOwner(A, "a");
  await seedOwner(B, "b");
  // Anciens inscrits, créés AVANT la migration 0011 (avec la structure d'origine).
  await q("insert into public.waitlist (slug, email) values ('site-de-a','ancien1@exemple.fr'), ('site-de-a','ancien2@exemple.fr'), ('site-de-b','ancien-de-b@exemple.fr')");
  await db.exec(sql("0011_waitlist_consentement.sql"));
  await db.exec(sql("0011_waitlist_consentement.sql")); // rejouable sans erreur
});

describe("0011 : anciens inscrits (jamais de consentement automatique)", () => {
  it("tous les anciens inscrits sont « a_verifier », sans date ni texte de consentement, et rien n'a été supprimé", async () => {
    const rows = await q<{ consentement_statut: string; consentement_le: unknown; consentement_texte: unknown }>("select consentement_statut, consentement_le, consentement_texte from public.waitlist");
    expect(rows).toHaveLength(3);
    for (const r of rows) expect(r).toEqual({ consentement_statut: "a_verifier", consentement_le: null, consentement_texte: null });
    expect(await q("select 1 from public.waitlist where consentement_statut = 'recueilli'")).toHaveLength(0);
  });

  it("une insertion directe qui ne précise rien reste « a_verifier » (jamais « recueilli » par défaut)", async () => {
    await q("insert into public.waitlist (slug, email) values ('site-de-a','direct@exemple.fr')");
    expect((await waitlist("site-de-a")).find((r) => r.email === "direct@exemple.fr")?.consentement_statut).toBe("a_verifier");
    await q("delete from public.waitlist where email = 'direct@exemple.fr'");
  });
});

describe("0011 : contraintes SQL", () => {
  it("« recueilli » exige date ET version du texte ; « a_verifier » n'en a pas ; valeurs inconnues refusées", async () => {
    const ins = (statut: string, le: string | null, texte: string | null) =>
      q("insert into public.waitlist (slug, email, consentement_statut, consentement_le, consentement_texte) values ('site-de-a', $1, $2, $3, $4)", [`c${Math.random()}@exemple.fr`, statut, le, texte]);
    await expect(ins("recueilli", null, null)).rejects.toThrow(/violates/);
    await expect(ins("recueilli", "2026-11-15T10:00:00Z", null)).rejects.toThrow(/violates/);
    await expect(ins("recueilli", null, "2026-11-15")).rejects.toThrow(/violates/);
    await expect(ins("a_verifier", "2026-11-15T10:00:00Z", null)).rejects.toThrow(/violates/);
    await expect(ins("a_verifier", null, "2026-11-15")).rejects.toThrow(/violates/);
    await expect(ins("consenti", "2026-11-15T10:00:00Z", "2026-11-15")).rejects.toThrow(/violates/);
    await expect(ins("recueilli", "2026-11-15T10:00:00Z", "x".repeat(41))).rejects.toThrow(/violates/);
    await ins("recueilli", "2026-11-15T10:00:00Z", "2026-11-15");
    await q("delete from public.waitlist where consentement_statut = 'recueilli'");
  });

  it("la migration ne supprime rien et ne touche à aucune politique RLS ni aucun droit de table (lecture du fichier)", () => {
    const f = sql("0011_waitlist_consentement.sql");
    const code = f.split("\n").filter((l) => !l.trim().startsWith("--")).join("\n");
    expect(code).not.toMatch(/\b(create|drop|alter)\s+policy\b/i);
    expect(code).not.toMatch(/row level security/i);
    expect(code).not.toMatch(/\b(grant|revoke)\b[^;]*\bon\s+(table\s+)?public\.\w+\s+(to|from)/i); // droits de FONCTION seulement ci-dessous
    expect(code).not.toMatch(/\b(delete\s+from|truncate|drop\s+table|drop\s+column)\b/i);
    expect(code).not.toMatch(/\bupdate\s+public\.waitlist\b/i); // aucun UPDATE de masse des anciens inscrits
  });

  it("le fichier se déclare NON EXÉCUTÉ sur la vraie base ; aucune version « à coller » n'a été préparée", () => {
    expect(sql("0011_waitlist_consentement.sql")).toMatch(/NON EXÉCUTÉ/);
  });
});

describe("0011 : inscription avec consentement obligatoire (côté base)", () => {
  it("sans consentement (faux, nul) ou sans version de texte : « consentement_requis », rien n'est écrit", async () => {
    const avant = (await q<{ n: number }>("select count(*)::int n from public.waitlist"))[0]!.n;
    expect(await inscrire("site-de-a", "nouveau@exemple.fr", false)).toBe("consentement_requis");
    expect(await inscrire("site-de-a", "nouveau@exemple.fr", null)).toBe("consentement_requis");
    expect(await inscrire("site-de-a", "nouveau@exemple.fr", true, "")).toBe("consentement_requis");
    expect(await inscrire("site-de-a", "nouveau@exemple.fr", true, null)).toBe("consentement_requis");
    expect((await q<{ n: number }>("select count(*)::int n from public.waitlist"))[0]!.n).toBe(avant);
  });

  it("avec consentement : inscription acceptée, statut « recueilli », horodatage et version du texte enregistrés", async () => {
    const t0 = Date.now();
    expect(await inscrire("site-de-a", "Marie@Exemple.fr", true, "2026-11-15")).toBe("ok");
    const r = (await waitlist("site-de-a")).find((x) => x.email === "marie@exemple.fr")!;
    expect(r.consentement_statut).toBe("recueilli");
    expect(r.consentement_texte).toBe("2026-11-15");
    expect(r.consentement_le).not.toBeNull();
    expect(Math.abs(new Date(r.consentement_le as unknown as string).getTime() - t0)).toBeLessThan(60_000);
  });

  it("un doublon reçoit la même réponse et ne modifie pas un consentement déjà recueilli", async () => {
    const avant = (await waitlist("site-de-a")).find((x) => x.email === "marie@exemple.fr")!;
    expect(await inscrire("site-de-a", "marie@exemple.fr", true, "2099-01-01")).toBe("ok");
    const apres = (await waitlist("site-de-a")).find((x) => x.email === "marie@exemple.fr")!;
    expect(apres).toEqual(avant);
  });

  it("un ancien inscrit qui s'inscrit à nouveau en cochant la case passe à « recueilli » ; les autres anciens restent « a_verifier »", async () => {
    expect(await inscrire("site-de-a", "ancien1@exemple.fr", true, "2026-11-15")).toBe("ok");
    const l = await waitlist("site-de-a");
    expect(l.find((x) => x.email === "ancien1@exemple.fr")).toMatchObject({ consentement_statut: "recueilli", consentement_texte: "2026-11-15" });
    expect(l.find((x) => x.email === "ancien1@exemple.fr")!.consentement_le).not.toBeNull();
    expect(l.find((x) => x.email === "ancien2@exemple.fr")).toMatchObject({ consentement_statut: "a_verifier", consentement_le: null });
    expect(await inscrire("site-de-a", "ancien2@exemple.fr", false)).toBe("consentement_requis"); // refuser ne change rien
    expect((await waitlist("site-de-a")).find((x) => x.email === "ancien2@exemple.fr")?.consentement_statut).toBe("a_verifier");
  });

  it("l'ancienne fonction sans consentement n'existe plus ; la nouvelle n'est exécutable que par service_role", async () => {
    expect(await q("select 1 from pg_proc where proname = 'waitlist_inscrire'")).toHaveLength(0);
    await expect(as("anon", null, "select public.waitlist_inscrire_consent('site-de-a','x@exemple.fr',true,'v')")).rejects.toThrow(DENIED);
    await expect(as("authenticated", B, "select public.waitlist_inscrire_consent('site-de-a','x@exemple.fr',true,'v')")).rejects.toThrow(DENIED);
  });

  it("autres refus conservés : e-mail invalide, site inconnu", async () => {
    expect(await inscrire("site-de-a", "pas-un-email", true)).toBe("email_invalide");
    expect(await inscrire("site-inexistant", "x@exemple.fr", true)).toBe("site_inconnu");
  });

  it("RLS : seul le propriétaire du site lit ses inscrits (consentement compris) ; personne d'autre, ni anon", async () => {
    expect((await as("authenticated", A, "select email from public.waitlist where slug = 'site-de-a'")).length).toBeGreaterThan(0);
    expect(await as("authenticated", B, "select email from public.waitlist where slug = 'site-de-a'")).toEqual([]);
    expect(await as("authenticated", B, "select consentement_statut from public.waitlist where slug = 'site-de-a'")).toEqual([]);
    await expect(as("anon", null, "select consentement_statut from public.waitlist")).rejects.toThrow(DENIED);
    await expect(as("authenticated", A, "update public.waitlist set consentement_statut = 'recueilli', consentement_le = now(), consentement_texte = 'x' where slug = 'site-de-a'")).rejects.toThrow(DENIED);
  });
});

describe("export du compte sur PostgreSQL (PGlite) : droits de colonnes et RLS réels", () => {
  it("« select * » est refusé par la base sur les commandes (colonnes secrètes non accordées) : l'export nomme donc ses colonnes", async () => {
    await expect(as("authenticated", A, "select * from public.commandes")).rejects.toThrow(DENIED);
    await expect(as("authenticated", A, "select jeton_hash from public.commandes")).rejects.toThrow(DENIED);
    await expect(as("authenticated", A, "select cle_idempotence from public.commandes")).rejects.toThrow(DENIED);
  });

  it("le compte A obtient toutes ses sections, sans section indisponible, et aucune donnée de B", async () => {
    const j = await buildAccountExport(pgClient(A), { id: A, email: "a@exemple.fr", created_at: "2026-01-01T00:00:00Z" });
    expect(j.sections_indisponibles).toEqual([]);
    const o = j.donnees_du_proprietaire;
    const c = j.donnees_commerciales_acheteurs_et_inscrits;
    expect(o.projets).toHaveLength(1);
    expect(o.sites_publies).toHaveLength(1);
    expect(o.boutiques).toHaveLength(1);
    expect(o.categories).toHaveLength(1);
    expect(o.produits).toHaveLength(1);
    expect(o.variantes).toHaveLength(1);
    expect(o.marque_blanche.configuration).toMatchObject({ name: "Marque a" });
    expect(o.marque_blanche.droit).toMatchObject({ enabled: true });
    expect(o.profil).toMatchObject({ plan: "illimite" });
    expect(c.commandes).toHaveLength(1);
    expect(c.lignes_commande).toHaveLength(1);
    expect(c.inscrits_liste_attente!.length).toBeGreaterThanOrEqual(3);
    const texte = JSON.stringify(j);
    for (const autre of ["site-de-b", "Boutique b", "Projet b", "Acheteur b", "acheteur-b@", "Marque b", "ancien-de-b@", "CMD-B", "NOTE-INTERNE", "HASH-SECRET", "cle-secrete", `"${B}"`]) expect(texte).not.toContain(autre);
    expect(texte).not.toMatch(/"[a-z_]*(stripe|jeton|idempot|hash)[a-z_]*":/i); // aucune CLÉ sensible (les remarques expliquent seulement ce qui est exclu)
  });

  it("le compte B obtient ses données et aucune de A (isolation dans les deux sens)", async () => {
    const j = await buildAccountExport(pgClient(B), { id: B, email: "b@exemple.fr" });
    expect(j.sections_indisponibles).toEqual([]);
    const texte = JSON.stringify(j);
    expect(texte).toContain("Acheteur b");
    expect(texte).toContain("ancien-de-b@exemple.fr");
    for (const autre of ["site-de-a", "Boutique a", "Projet a", "Acheteur a", "acheteur-a@", "Marque a", "ancien1@", "marie@", "CMD-A"]) expect(texte).not.toContain(autre);
  });

  it("les anciens inscrits exportés gardent le statut « a_verifier » ; les consentements récents gardent leur date", async () => {
    const wl = (await buildAccountExport(pgClient(A), { id: A })).donnees_commerciales_acheteurs_et_inscrits.inscrits_liste_attente!;
    expect(wl.find((r) => r.email === "ancien2@exemple.fr")).toMatchObject({ consentement_statut: "a_verifier", consentement_le: null });
    expect(wl.find((r) => r.email === "marie@exemple.fr")).toMatchObject({ consentement_statut: "recueilli", consentement_texte: "2026-11-15" });
    expect(wl.find((r) => r.email === "marie@exemple.fr")!.consentement_le).toBeTruthy();
  });

  it("un identifiant inconnu (compte sans donnée) donne un export vide mais complet, sans erreur", async () => {
    const j = await buildAccountExport(pgClient("00000000-0000-4000-8000-0000000000ff"), { id: "00000000-0000-4000-8000-0000000000ff" });
    expect(j.sections_indisponibles).toEqual([]);
    expect(j.donnees_du_proprietaire.projets).toEqual([]);
    expect(j.donnees_commerciales_acheteurs_et_inscrits.commandes).toEqual([]);
    expect(j.donnees_commerciales_acheteurs_et_inscrits.inscrits_liste_attente).toEqual([]);
  });

  it("table absente (supprimée dans la copie PGlite) : section signalée indisponible, le reste est exporté", async () => {
    // Table renommée puis remise : on travaille dans une transaction annulée pour ne pas modifier la base des autres tests.
    const sb = pgClient(A);
    const cassé: ExportClient = { from: (t) => sb.from(t === "variantes" ? "variantes_inexistante" : t) };
    const j = await buildAccountExport(cassé, { id: A });
    expect(j.donnees_du_proprietaire.variantes).toBeNull();
    expect(j.sections_indisponibles.map((s) => s.section)).toContain("variantes");
    expect(j.donnees_du_proprietaire.produits).toHaveLength(1);
  });
});
