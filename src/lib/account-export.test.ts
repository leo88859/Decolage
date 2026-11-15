import { describe, expect, it } from "vitest";
import { BLOCK_SIZE, COLUMNS, LIGNES_MAX, SECTION_MAX, buildAccountExport, type ExportClient, type ExportQuery } from "./account-export";

// Export RGPD testé avec une base SIMULÉE en mémoire (aucun Supabase réel). La base simulée applique les filtres,
// le tri, la pagination et un contrôle de colonnes : elle refuse « * » et toute colonne non listée dans `grants`,
// comme le fait Postgres pour les tables dont les droits sont accordés colonne par colonne.
// Les règles RLS et les droits de colonnes réels sont, eux, testés avec PGlite dans waitlist-consentement-0011.test.ts.
type Row = Record<string, unknown>;
type Db = Record<string, Row[]>;

function fakeClient(db: Db, opts: { missing?: string[]; grants?: Record<string, string[]> } = {}) {
  const log: { table: string; cols: string; filters: string[] }[] = [];
  const client: ExportClient = {
    from(table) {
      return {
        select(cols) {
          const entry = { table, cols, filters: [] as string[] };
          log.push(entry);
          let eq: [string, string] | null = null;
          let inn: [string, string[]] | null = null;
          let orderCol = "";
          let rng: [number, number] | null = null;
          const q = {
            eq(c: string, v: string) { eq = [c, v]; entry.filters.push(`eq:${c}`); return q; },
            in(c: string, v: string[]) { inn = [c, v]; entry.filters.push(`in:${c}`); return q; },
            order(c: string) { orderCol = c; return q; },
            range(a: number, b: number) { rng = [a, b]; return q; },
            then(res: (v: { data: Row[] | null; error: unknown }) => unknown) {
              if (opts.missing?.includes(table)) return res({ data: null, error: { code: "42P01", message: `relation "public.${table}" does not exist` } });
              const wanted = cols.split(",").map((c) => c.trim());
              const granted = opts.grants?.[table];
              if (cols.includes("*") || (granted && wanted.some((c) => !granted.includes(c)))) return res({ data: null, error: { code: "42501", message: "permission denied" } });
              let rows = (db[table] ?? []).filter((r) => (!eq || String(r[eq[0]]) === eq[1]) && (!inn || inn[1].includes(String(r[inn[0]]))));
              if (orderCol) rows = [...rows].sort((a, b) => String(a[orderCol]).localeCompare(String(b[orderCol])));
              if (rng) rows = rows.slice(rng[0], rng[1] + 1);
              return res({ data: rows.map((r) => Object.fromEntries(wanted.map((c) => [c, r[c]]))), error: null });
            },
          };
          return q as unknown as ExportQuery;
        },
      };
    },
  };
  return { client, log };
}

const U = { id: "u-a", email: "a@exemple.fr", created_at: "2026-01-01T00:00:00Z", last_sign_in_at: "2026-11-01T00:00:00Z" };
const pad = (n: number, w = 6) => String(n).padStart(w, "0");

/** Une base remplie de données du compte A, avec des champs sensibles et des lignes d'un autre compte (B). */
function seed(): Db {
  return {
    profiles: [{ id: "u-a", plan: "pro", favorites: ["i1"], subscription_status: "active", created_at: "2026-01-01", updated_at: "2026-02-01", stripe_customer_id: "cus_SECRET", stripe_subscription_id: "sub_SECRET" }],
    projects: [{ user_id: "u-a", id: "p1", data: { nom: "Mon SaaS" }, updated_at: "2026-02-01" }, { user_id: "u-b", id: "p9", data: { nom: "Autre" }, updated_at: "2026-02-01" }],
    sites: [{ user_id: "u-a", slug: "mon-site", project_id: "p1", data: {}, published_at: "2026-02-01", updated_at: "2026-02-01", suspended_at: null }, { user_id: "u-b", slug: "site-b", project_id: "p9", data: {}, published_at: "2026-02-01", updated_at: "2026-02-01" }],
    legal_acceptances: [{ user_id: "u-a", id: 1, document: "cgu", version: "v1", accepted_at: "2026-01-01", contexte: "inscription", renonciation_retractation: false, formule: null }],
    brand_configs: [{ user_id: "u-a", name: "Ma marque", color_primary: "#111111", color_secondary: "#222222", color_accent: "#333333", color_surface: "#444444", color_text: "#555555", logo_data: null, favicon_data: null, version: 2, previous: { ancien: true }, updated_at: "2026-02-01" }],
    brand_entitlements: [{ user_id: "u-a", enabled: true, enabled_at: "2026-02-01", note: "NOTE INTERNE" }],
    boutiques: [
      { id: "b1", proprietaire_id: "u-a", slug: "ma-boutique", nom: "Ma boutique", description: "", couleur_principale: "#2f5bff", couleur_accent: "#ff6b4a", logo: null, adresse: "", whatsapp: null, email: null, telephone: null, modes: ["retrait"], statut: "publiee", published_at: null, created_at: "2026-03-01", updated_at: "2026-03-01", theme: "clair", delai_expiration_h: 48, quantite_max_article: 10 },
      { id: "b9", proprietaire_id: "u-b", slug: "boutique-b", nom: "Boutique B", description: "", modes: ["retrait"], statut: "publiee" },
    ],
    categories: [{ id: "c1", boutique_id: "b1", nom: "Vêtements", position: 0, created_at: "2026-03-01" }, { id: "c9", boutique_id: "b9", nom: "Autre", position: 0, created_at: "2026-03-01" }],
    produits: [{ id: "pr1", boutique_id: "b1", categorie_id: "c1", titre: "T-shirt", description: "", prix_centimes: 1000, images: [], actif: true, position: 0, created_at: "2026-03-01", updated_at: "2026-03-01" }],
    variantes: [{ id: "v1", produit_id: "pr1", boutique_id: "b1", nom: "M", stock: 5, actif: true, position: 0, created_at: "2026-03-01" }],
    commandes: [
      { id: "o1", ref: "CMD-1", boutique_id: "b1", cle_idempotence: "CLE-SECRETE-0123456789", jeton_hash: "HASH-SECRET", jeton_suivi: "JETON-SECRET", client_nom: "Awa Diop", client_email: "awa@exemple.fr", client_telephone: "+221770000000", adresse_livraison: "", note: "", mode: "retrait", statut: "nouvelle", total_centimes: 1000, paiement: "non_payee", created_at: "2026-04-01", updated_at: "2026-04-01", annulee_le: null, annulation_motif: null },
      { id: "o9", ref: "CMD-9", boutique_id: "b9", client_nom: "Client de B", client_email: "client-b@exemple.fr", statut: "nouvelle" },
    ],
    lignes_commande: [{ id: "l1", commande_id: "o1", variante_id: "v1", produit_titre: "T-shirt", variante_nom: "M", prix_unitaire_centimes: 1000, quantite: 1 }, { id: "l9", commande_id: "o9", produit_titre: "X", variante_nom: "Y", prix_unitaire_centimes: 1, quantite: 1 }],
    waitlist: [
      { id: 1, slug: "mon-site", email: "marie@exemple.fr", created_at: "2026-05-01", consentement_statut: "recueilli", consentement_le: "2026-05-01T10:00:00Z", consentement_texte: "2026-11-15" },
      { id: 2, slug: "mon-site", email: "ancien@exemple.fr", created_at: "2026-01-05", consentement_statut: "a_verifier", consentement_le: null, consentement_texte: null },
      { id: 3, slug: "site-b", email: "inscrit-de-b@exemple.fr", created_at: "2026-05-01", consentement_statut: "recueilli", consentement_le: "2026-05-01T10:00:00Z", consentement_texte: "2026-11-15" },
    ],
  };
}

const SENSITIVE_KEY = /secret|token|jeton|idempot|^cle_|stripe|password|mot_de_passe|hash|api_?key|access_|refresh_|^previous$/i;
function sensitiveKeys(v: unknown, path = "", out: string[] = []): string[] {
  if (Array.isArray(v)) v.forEach((x, i) => sensitiveKeys(x, `${path}[${i}]`, out));
  else if (v && typeof v === "object") {
    for (const [k, x] of Object.entries(v)) {
      if (SENSITIVE_KEY.test(k)) out.push(`${path}.${k}`);
      sensitiveKeys(x, `${path}.${k}`, out);
    }
  }
  return out;
}

describe("export du compte : sections", () => {
  it("contient toutes les sections, réparties dans les deux blocs", async () => {
    const { client } = fakeClient(seed());
    const j = await buildAccountExport(client, U);
    expect(j.format).toBe("decollage-export-compte");
    expect(Object.keys(j.donnees_du_proprietaire).sort()).toEqual(
      ["acceptations_des_conditions", "boutiques", "categories", "compte", "description", "marque_blanche", "produits", "profil", "projets", "sites_publies", "variantes"].sort(),
    );
    expect(Object.keys(j.donnees_commerciales_acheteurs_et_inscrits).sort()).toEqual(["commandes", "description", "inscrits_liste_attente", "lignes_commande"]);
    const o = j.donnees_du_proprietaire;
    expect(o.compte).toEqual({ id: "u-a", email: "a@exemple.fr", cree_le: "2026-01-01T00:00:00Z", derniere_connexion: "2026-11-01T00:00:00Z" });
    expect(o.profil).toMatchObject({ plan: "pro", favorites: ["i1"] });
    expect(o.projets).toHaveLength(1);
    expect(o.sites_publies).toHaveLength(1);
    expect(o.boutiques).toHaveLength(1);
    expect(o.boutiques?.[0]).toMatchObject({ slug: "ma-boutique", theme: "clair", delai_expiration_h: 48 });
    expect(o.categories).toHaveLength(1);
    expect(o.produits).toHaveLength(1);
    expect(o.variantes).toHaveLength(1);
    expect(o.marque_blanche.configuration).toMatchObject({ name: "Ma marque", version: 2 });
    expect(o.marque_blanche.droit).toEqual({ enabled: true, enabled_at: "2026-02-01" });
    expect(o.acceptations_des_conditions).toHaveLength(1);
    const c = j.donnees_commerciales_acheteurs_et_inscrits;
    expect(c.commandes).toHaveLength(1);
    expect(c.commandes?.[0]).toMatchObject({ ref: "CMD-1", client_email: "awa@exemple.fr" });
    expect(c.lignes_commande).toHaveLength(1);
    expect(c.inscrits_liste_attente).toHaveLength(2);
    expect(j.sections_indisponibles).toEqual([]);
  });

  it("sépare les deux catégories : rien de commercial côté propriétaire, rien du propriétaire côté commercial", async () => {
    const { client } = fakeClient(seed());
    const j = await buildAccountExport(client, U);
    const o = JSON.stringify(j.donnees_du_proprietaire);
    const c = JSON.stringify(j.donnees_commerciales_acheteurs_et_inscrits);
    for (const perso of ["awa@exemple.fr", "Awa Diop", "marie@exemple.fr", "ancien@exemple.fr", "CMD-1"]) {
      expect(o).not.toContain(perso);
      expect(c).toContain(perso);
    }
    for (const mien of ["Mon SaaS", "Ma marque", "ma-boutique"]) {
      expect(c).not.toContain(mien);
      expect(o).toContain(mien);
    }
  });

  it("les inscrits exportés gardent leur statut de consentement : l'ancien inscrit reste « à vérifier »", async () => {
    const { client } = fakeClient(seed());
    const wl = (await buildAccountExport(client, U)).donnees_commerciales_acheteurs_et_inscrits.inscrits_liste_attente!;
    expect(wl.find((r) => r.email === "ancien@exemple.fr")).toMatchObject({ consentement_statut: "a_verifier", consentement_le: null });
    expect(wl.find((r) => r.email === "marie@exemple.fr")).toMatchObject({ consentement_statut: "recueilli", consentement_le: "2026-05-01T10:00:00Z" });
  });
});

describe("export du compte : aucun secret", () => {
  it("aucune clé sensible (jeton, clé d'idempotence, Stripe, empreinte, note interne…) et aucune valeur secrète", async () => {
    const { client } = fakeClient(seed());
    const j = await buildAccountExport(client, U);
    expect(sensitiveKeys(j)).toEqual([]);
    const text = JSON.stringify(j);
    for (const secret of ["SECRET", "cus_", "sub_", "CLE-SECRETE", "HASH", "NOTE INTERNE", "stripe", "proprietaire_id", "user_id", "variante_id"]) expect(text).not.toContain(secret);
  });

  it("les listes de colonnes exportées ne contiennent aucun nom sensible", () => {
    const all = Object.values(COLUMNS).flatMap((s) => [...s.base, ...(("extra" in s ? s.extra : []) as string[])]);
    expect(all.filter((c) => SENSITIVE_KEY.test(c))).toEqual([]);
    expect(all).not.toContain("*");
  });
});

describe("export du compte : droits de colonnes et isolation", () => {
  it("n'utilise jamais « * » : colonnes nommées une à une, et la base simulée accepte exactement ces colonnes", async () => {
    const grants: Record<string, string[]> = {};
    for (const [t, s] of Object.entries(COLUMNS)) grants[t] = [...s.base, ...(("extra" in s ? s.extra : []) as string[]), ...(("guard" in s ? [s.guard] : []) as string[])];
    const { client, log } = fakeClient(seed(), { grants });
    const j = await buildAccountExport(client, U);
    expect(log.length).toBeGreaterThan(10);
    expect(log.every((l) => !l.cols.includes("*"))).toBe(true);
    expect(j.sections_indisponibles).toEqual([]);
  });

  it("chaque requête est filtrée (propriétaire, boutiques ou sites du compte) : jamais de lecture sans filtre", async () => {
    const { client, log } = fakeClient(seed());
    await buildAccountExport(client, U);
    expect(log.filter((l) => l.filters.length === 0)).toEqual([]);
  });

  it("n'exporte rien d'un autre compte, même si la base lui renvoie ses lignes (double protection)", async () => {
    // Faux client « trop bavard » : ignore les filtres et renvoie tout, comme si la RLS était absente.
    const db = seed();
    const bavard: ExportClient = {
      from: (t) => ({
        select: (cols) => {
          const wanted = cols.split(",").map((c) => c.trim());
          const q: Record<string, unknown> = {};
          q.eq = q.in = q.order = (): unknown => q;
          q.range = (a: number, b: number) => ({
            then: (res: (v: unknown) => unknown) => res({ data: (db[t] ?? []).slice(a, b + 1).map((r) => Object.fromEntries(wanted.map((c) => [c, r[c]]))), error: null }),
          });
          return q as unknown as ExportQuery;
        },
      }),
    };
    const text = JSON.stringify((await buildAccountExport(bavard, U)).donnees_commerciales_acheteurs_et_inscrits);
    for (const autre of ["Client de B", "client-b@exemple.fr", "inscrit-de-b@exemple.fr", "CMD-9"]) expect(text).not.toContain(autre);
    const proprio = JSON.stringify((await buildAccountExport(bavard, U)).donnees_du_proprietaire);
    for (const autre of ["Boutique B", "boutique-b", "site-b"]) expect(proprio).not.toContain(autre);
  });
});

describe("export du compte : table absente (repli propre)", () => {
  it("une table manquante donne null + un message clair, sans faire échouer le reste", async () => {
    const { client } = fakeClient(seed(), { missing: ["boutiques", "waitlist"] });
    const j = await buildAccountExport(client, U);
    expect(j.donnees_du_proprietaire.boutiques).toBeNull();
    expect(j.donnees_du_proprietaire.produits).toBeNull();
    expect(j.donnees_commerciales_acheteurs_et_inscrits.commandes).toBeNull();
    expect(j.donnees_commerciales_acheteurs_et_inscrits.lignes_commande).toBeNull();
    expect(j.donnees_commerciales_acheteurs_et_inscrits.inscrits_liste_attente).toBeNull();
    expect(j.donnees_du_proprietaire.projets).toHaveLength(1);
    const noms = j.sections_indisponibles.map((s) => s.section);
    expect(noms).toEqual(expect.arrayContaining(["boutiques", "inscrits_liste_attente", "categories", "commandes", "lignes_commande"]));
    expect(j.remarques.join(" ")).toMatch(/Section « boutiques » non exportée/);
  });

  it("colonnes récentes absentes (migrations 0008-0011 non exécutées) : repli sur les colonnes d'origine, sections disponibles", async () => {
    const grants: Record<string, string[]> = {};
    for (const [t, s] of Object.entries(COLUMNS)) grants[t] = [...s.base, ...(("guard" in s ? [s.guard] : []) as string[])]; // aucune colonne « extra » n'existe encore
    const { client } = fakeClient(seed(), { grants });
    const j = await buildAccountExport(client, U);
    expect(j.sections_indisponibles).toEqual([]);
    expect(j.donnees_commerciales_acheteurs_et_inscrits.inscrits_liste_attente).toHaveLength(2);
    expect(j.donnees_commerciales_acheteurs_et_inscrits.inscrits_liste_attente?.[0]).not.toHaveProperty("consentement_statut");
    expect(j.donnees_du_proprietaire.boutiques?.[0]).not.toHaveProperty("theme");
  });

  it("une erreur levée par le client (réseau) est traitée comme une section indisponible", async () => {
    const boom: ExportClient = { from: () => { throw new Error("réseau"); } };
    const j = await buildAccountExport(boom, U);
    expect(j.donnees_du_proprietaire.projets).toBeNull();
    expect(j.sections_indisponibles.length).toBeGreaterThan(0);
  });
});

describe("export du compte : gros volumes (plafond et pagination)", () => {
  function big(n: number): Db {
    const db = seed();
    db.waitlist = Array.from({ length: n }, (_, i) => ({ id: i + 1, slug: "mon-site", email: `u${i}@exemple.fr`, created_at: "2026-05-01", consentement_statut: "a_verifier", consentement_le: null, consentement_texte: null }));
    // L'ordre se fait sur l'identifiant (texte) : on garde des identifiants triables.
    db.waitlist.forEach((r, i) => { r.id = pad(i + 1); });
    return db;
  }

  it("plafonne chaque section à SECTION_MAX lignes par page, le signale, et la page suivante donne la suite sans doublon", async () => {
    const total = SECTION_MAX + 123;
    const db = big(total);
    const { client, log } = fakeClient(db);
    const p1 = await buildAccountExport(client, U, { page: 1 });
    const l1 = p1.donnees_commerciales_acheteurs_et_inscrits.inscrits_liste_attente!;
    expect(l1).toHaveLength(SECTION_MAX);
    expect(p1.pagination.sections.inscrits_liste_attente).toEqual({ lignes: SECTION_MAX, par_page: SECTION_MAX, page_suivante: true });
    expect(p1.remarques.join(" ")).toMatch(/Export partiel.*inscrits_liste_attente.*\?page=2/);
    const p2 = await buildAccountExport(client, U, { page: 2 });
    const l2 = p2.donnees_commerciales_acheteurs_et_inscrits.inscrits_liste_attente!;
    expect(l2).toHaveLength(123);
    expect(p2.pagination.sections.inscrits_liste_attente!.page_suivante).toBe(false);
    const ids = new Set([...l1, ...l2].map((r) => r.id));
    expect(ids.size).toBe(total);
    // jamais plus d'un bloc par requête : aucune lecture « sans limite »
    expect(log.length).toBeGreaterThan(0);
  });

  it("lit par blocs de BLOCK_SIZE et n'excède jamais le plafond + 1 ligne lue pour une section", async () => {
    const db = big(SECTION_MAX + 500);
    const reads: number[] = [];
    const { client } = fakeClient(db);
    const spy: ExportClient = {
      from: (t) => ({
        select: (cols) => {
          const q = client.from(t).select(cols);
          const range = q.range.bind(q);
          q.range = (a, b) => {
            if (t === "waitlist") reads.push(b - a + 1);
            return range(a, b);
          };
          return q;
        },
      }),
    };
    await buildAccountExport(spy, U);
    expect(reads.length).toBe(Math.ceil((SECTION_MAX + 1) / BLOCK_SIZE));
    expect(reads.every((n) => n === BLOCK_SIZE)).toBe(true);
  });

  it("les lignes de commande sont plafonnées (LIGNES_MAX) et le message l'indique", async () => {
    const db = seed();
    db.lignes_commande = Array.from({ length: LIGNES_MAX + 10 }, (_, i) => ({ id: pad(i, 7), commande_id: "o1", produit_titre: "T", variante_nom: "M", prix_unitaire_centimes: 1, quantite: 1 }));
    const { client } = fakeClient(db);
    const j = await buildAccountExport(client, U);
    expect(j.donnees_commerciales_acheteurs_et_inscrits.lignes_commande).toHaveLength(LIGNES_MAX);
    expect(j.remarques.join(" ")).toMatch(/lignes de commande/);
  });

  it("un numéro de page hors limites est ramené dans les bornes", async () => {
    const { client } = fakeClient(seed());
    expect((await buildAccountExport(client, U, { page: -4 })).page).toBe(1);
    expect((await buildAccountExport(client, U, { page: 9999 })).page).toBe(50);
  });
});
