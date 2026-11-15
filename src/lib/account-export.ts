// Export RGPD (accès et portabilité) des données d'UN compte. Le client passé en paramètre est celui de la
// session de l'utilisateur : la RLS de la base ne lui montre déjà que ses propres lignes, et chaque requête
// filtre en plus sur son identifiant (double protection). Les colonnes sont TOUJOURS nommées une à une (jamais « * ») :
// plusieurs tables n'accordent le droit de lecture que colonne par colonne (migrations 0005, 0008, 0009, 0010).
// Aucun secret : ni identifiants Stripe, ni jetons de suivi, ni clés d'idempotence, ni empreintes de jeton.
// Voir docs/CONFIDENTIALITE-ET-EXPORT.md pour le détail de ce qui est exporté et de ce qui ne l'est pas.

type Row = Record<string, unknown>;
type Res = PromiseLike<{ data: Row[] | Row | null; error: unknown }>;
export type ExportQuery = Res & {
  eq(col: string, v: string): ExportQuery;
  in(col: string, v: string[]): ExportQuery;
  order(col: string): ExportQuery;
  range(from: number, to: number): ExportQuery;
};
export type ExportClient = { from(table: string): { select(cols: string): ExportQuery } };
export type ExportUser = { id: string; email?: string | null; created_at?: string; last_sign_in_at?: string | null };

/** Lignes lues par requête (bloc). Les projets contiennent de gros documents : blocs plus petits. */
export const BLOCK_SIZE = 1000;
const PROJECT_BLOCK_SIZE = 100;
/** Plafond de lignes PAR SECTION et PAR PAGE d'export. Au-delà : `page_suivante` = true et ?page=2, 3… donne la suite. */
export const SECTION_MAX = 5000;
const SECTION_MAX_BY_NAME: Record<string, number> = { projets: 500, sites_publies: 500, boutiques: 500 };
/** Plafond de lignes de commande lues pour une page de commandes (une commande a quelques lignes, rarement plus de 20). */
export const LIGNES_MAX = 25000;
/** Numéro de page maximal accepté (protège le serveur d'une lecture démesurée). */
export const PAGE_MAX = 50;
/** Nombre d'identifiants par requête « in » (évite des adresses de requête trop longues). */
const IN_CHUNK = 50;

// Colonnes exportées par table. `base` existe depuis les migrations d'origine ; `extra` vient de migrations plus récentes
// (si elles ne sont pas exécutées, la lecture se rabat proprement sur `base`). Chaque liste respecte les droits de colonnes.
// `guard` : colonne de propriétaire lue UNIQUEMENT pour vérifier côté serveur que la ligne appartient bien au compte ; jamais exportée.
type Spec = { base: string[]; extra?: string[]; guard?: string };
export const COLUMNS = {
  profiles: { guard: "id", base: ["plan", "favorites", "subscription_status", "created_at", "updated_at"] },
  projects: { guard: "user_id", base: ["id", "data", "updated_at"] },
  sites: { guard: "user_id", base: ["slug", "project_id", "data", "published_at", "updated_at"], extra: ["suspended_at"] },
  legal_acceptances: { guard: "user_id", base: ["document", "version", "accepted_at", "contexte", "renonciation_retractation", "formule"] },
  brand_configs: { guard: "user_id", base: ["name", "color_primary", "color_secondary", "color_accent", "color_surface", "color_text", "logo_data", "favicon_data", "version", "updated_at"] },
  brand_entitlements: { guard: "user_id", base: ["enabled", "enabled_at"] },
  boutiques: {
    guard: "proprietaire_id",
    base: ["id", "slug", "nom", "description", "couleur_principale", "couleur_accent", "logo", "adresse", "whatsapp", "email", "telephone", "modes", "statut", "published_at", "created_at", "updated_at"],
    extra: ["theme", "delai_expiration_h", "quantite_max_article"],
  },
  categories: { base: ["id", "boutique_id", "nom", "position", "created_at"] },
  produits: { base: ["id", "boutique_id", "categorie_id", "titre", "description", "prix_centimes", "images", "actif", "position", "created_at", "updated_at"] },
  variantes: { base: ["id", "produit_id", "boutique_id", "nom", "stock", "actif", "position", "created_at"] },
  commandes: {
    base: ["id", "ref", "boutique_id", "client_nom", "client_email", "client_telephone", "adresse_livraison", "note", "mode", "statut", "total_centimes", "paiement", "created_at", "updated_at"],
    extra: ["annulee_le", "annulation_motif"],
  },
  lignes_commande: { base: ["id", "commande_id", "produit_titre", "variante_nom", "prix_unitaire_centimes", "quantite"] },
  waitlist: { base: ["id", "slug", "email", "created_at"], extra: ["consentement_statut", "consentement_le", "consentement_texte"] },
} satisfies Record<string, Spec>;
type TableName = keyof typeof COLUMNS;

const allColumns = (t: TableName): string[] => [...COLUMNS[t].base, ...(("extra" in COLUMNS[t] ? COLUMNS[t].extra : []) as string[])];
const guardOf = (t: TableName): string | null => ("guard" in COLUMNS[t] ? (COLUMNS[t].guard as string) : null);
const pick = (row: Row, keys: string[]): Row => Object.fromEntries(keys.filter((k) => k in row).map((k) => [k, row[k]]));

type Filter = { col: string; values: string[] };
type Read = { rows: Row[] } | null;

/** Lit au plus `want` lignes, par blocs, en essayant d'abord toutes les colonnes puis seulement les colonnes d'origine. */
async function readRows(sb: ExportClient, table: TableName, filter: Filter, orderCol: string, want: number, block = BLOCK_SIZE): Promise<Read> {
  const variants = [allColumns(table), COLUMNS[table].base];
  const tried = new Set<string>();
  for (const cols of variants) {
    const key = cols.join(",");
    if (tried.has(key)) continue;
    tried.add(key);
    const g = guardOf(table);
    const out = await readWith(sb, table, (g ? [...cols, g] : cols).join(", "), filter, orderCol, want, block);
    if (out) return out;
  }
  return null; // table ou colonnes absentes, ou droit refusé : la section sera signalée « indisponible »
}

async function readWith(sb: ExportClient, table: string, cols: string, filter: Filter, orderCol: string, want: number, block: number): Promise<Read> {
  const rows: Row[] = [];
  const groups: string[][] = [];
  for (let i = 0; i < filter.values.length; i += IN_CHUNK) groups.push(filter.values.slice(i, i + IN_CHUNK));
  try {
    for (const group of groups) {
      for (let from = 0; rows.length < want; from += block) {
        const base = sb.from(table).select(cols);
        const q = (group.length === 1 ? base.eq(filter.col, group[0]!) : base.in(filter.col, group)).order(orderCol).range(from, from + block - 1);
        const { data, error } = await q;
        if (error || !Array.isArray(data)) return null;
        rows.push(...data);
        if (data.length < block) break;
      }
      if (rows.length >= want) break;
    }
  } catch {
    return null;
  }
  return { rows: rows.slice(0, want) };
}

export type SectionInfo = { lignes: number; par_page: number; page_suivante: boolean };

export async function buildAccountExport(sb: ExportClient, user: ExportUser, opts: { page?: number } = {}) {
  const page = Math.min(PAGE_MAX, Math.max(1, Math.floor(opts.page ?? 1)));
  const infos: Record<string, SectionInfo> = {};
  const indisponibles: { section: string; message: string }[] = [];

  const unavailable = (name: string, why = "la table ou ses colonnes ne sont pas accessibles pour le moment (migration non appliquée ou erreur temporaire)") => {
    indisponibles.push({ section: name, message: `Section « ${name} » non exportée : ${why}.` });
    return null;
  };

  /** Lit une section paginée ; renvoie les lignes de la page demandée (déjà réduites aux colonnes autorisées) ou null. */
  async function paged(name: string, table: TableName, filter: Filter, orderCol: string, extraGuard?: (r: Row) => boolean, block = BLOCK_SIZE): Promise<{ out: Row[]; all: Row[] } | null> {
    const cap = SECTION_MAX_BY_NAME[name] ?? SECTION_MAX;
    const offset = (page - 1) * cap;
    const res = await readRows(sb, table, filter, orderCol, offset + cap + 1, block);
    if (!res) return unavailable(name);
    const g = guardOf(table);
    const mine = g ? res.rows.filter((r) => String(r[g]) === user.id) : res.rows; // double protection : jamais la ligne d'un autre compte
    const safe = extraGuard ? mine.filter(extraGuard) : mine;
    const slice = safe.slice(offset, offset + cap);
    infos[name] = { lignes: slice.length, par_page: cap, page_suivante: safe.length > offset + cap };
    return { out: slice.map((r) => pick(r, allColumns(table))), all: safe };
  }
  const one = async (name: string, table: TableName, col: string): Promise<Row | null> => {
    const res = await readRows(sb, table, { col, values: [user.id] }, col, 1);
    if (!res) { unavailable(name); return null; }
    const g = guardOf(table);
    const mine = res.rows.find((r) => !g || String(r[g]) === user.id);
    return mine ? pick(mine, allColumns(table)) : null;
  };

  // Étape 1 : tout ce qui se retrouve par l'identifiant du compte.
  const [profil, projets, sites, acceptations, marqueCfg, marqueDroit, boutiques] = await Promise.all([
    one("profil", "profiles", "id"),
    paged("projets", "projects", { col: "user_id", values: [user.id] }, "id", undefined, PROJECT_BLOCK_SIZE),
    paged("sites_publies", "sites", { col: "user_id", values: [user.id] }, "slug"),
    paged("acceptations_des_conditions", "legal_acceptances", { col: "user_id", values: [user.id] }, "id"),
    one("marque_blanche.configuration", "brand_configs", "user_id"),
    one("marque_blanche.droit", "brand_entitlements", "user_id"),
    paged("boutiques", "boutiques", { col: "proprietaire_id", values: [user.id] }, "id"),
  ]);

  // Étape 2 : ce qui dépend des boutiques et des sites du compte. Une ligne qui ne leur appartient pas est écartée.
  const boutiqueIds = (boutiques?.all ?? []).map((b) => String(b.id));
  const boutiqueSet = new Set(boutiqueIds);
  const slugs = (sites?.all ?? []).map((s) => String(s.slug));
  const slugSet = new Set(slugs);
  const byBoutique = (r: Row) => boutiqueSet.has(String(r.boutique_id));
  const child = (name: string, table: TableName) => {
    if (boutiques === null) return Promise.resolve(unavailable(name, "les boutiques n'ont pas pu être lues"));
    return boutiqueIds.length ? paged(name, table, { col: "boutique_id", values: boutiqueIds }, "id", byBoutique) : Promise.resolve({ out: [] as Row[], all: [] as Row[] });
  };
  const [categories, produits, variantes, commandes, inscrits] = await Promise.all([
    child("categories", "categories"),
    child("produits", "produits"),
    child("variantes", "variantes"),
    child("commandes", "commandes"),
    sites === null
      ? Promise.resolve(unavailable("inscrits_liste_attente", "les sites publiés n'ont pas pu être lus"))
      : slugs.length
        ? paged("inscrits_liste_attente", "waitlist", { col: "slug", values: slugs }, "id", (r) => slugSet.has(String(r.slug)))
        : Promise.resolve({ out: [] as Row[], all: [] as Row[] }),
  ]);

  // Étape 3 : les lignes des commandes de CETTE page.
  let lignes: Row[] | null;
  let lignesTronquees = false;
  if (commandes === null) lignes = unavailable("lignes_commande", "les commandes n'ont pas pu être lues");
  else {
    const ids = commandes.out.map((c) => String(c.id));
    const idSet = new Set(ids);
    if (!ids.length) lignes = [];
    else {
      const res = await readRows(sb, "lignes_commande", { col: "commande_id", values: ids }, "id", LIGNES_MAX + 1);
      if (!res) lignes = unavailable("lignes_commande");
      else {
        const ok = res.rows.filter((l) => idSet.has(String(l.commande_id)));
        lignesTronquees = ok.length > LIGNES_MAX;
        lignes = ok.slice(0, LIGNES_MAX).map((l) => pick(l, allColumns("lignes_commande")));
        infos.lignes_commande = { lignes: lignes.length, par_page: LIGNES_MAX, page_suivante: false };
      }
    }
  }

  const plusDePages = Object.entries(infos).filter(([, i]) => i.page_suivante).map(([n]) => n);
  return {
    format: "decollage-export-compte",
    version_format: 2,
    exporte_le: new Date().toISOString(),
    page,
    donnees_du_proprietaire: {
      description: "Les données de ton compte et de ce que tu as créé : ton compte, ton profil, tes projets, tes sites, tes boutiques et leur catalogue, ta marque blanche, les conditions que tu as acceptées.",
      compte: { id: user.id, email: user.email ?? null, cree_le: user.created_at ?? null, derniere_connexion: user.last_sign_in_at ?? null },
      profil,
      projets: projets?.out ?? null,
      sites_publies: sites?.out ?? null,
      boutiques: boutiques?.out ?? null,
      categories: categories?.out ?? null,
      produits: produits?.out ?? null,
      variantes: variantes?.out ?? null,
      marque_blanche: { configuration: marqueCfg, droit: marqueDroit },
      acceptations_des_conditions: acceptations?.out ?? null,
    },
    donnees_commerciales_acheteurs_et_inscrits: {
      description: "Données concernant d'AUTRES personnes (tes acheteurs et les inscrits à tes listes d'attente), que tu détiens pour ton activité. Elles te sont fournies parce que tu les consultes déjà dans ton espace ; tu restes responsable de leur bon usage. Ne les republie pas.",
      commandes: commandes?.out ?? null,
      lignes_commande: lignes,
      inscrits_liste_attente: inscrits?.out ?? null,
    },
    pagination: { page, page_max: PAGE_MAX, sections: infos },
    sections_indisponibles: indisponibles,
    remarques: [
      "Ne figurent pas ici : les identifiants internes de paiement (conservés par Stripe, qui garde aussi vos factures), les jetons de suivi et clés techniques des commandes, la connexion (mot de passe ou lien magique, gérés par le fournisseur de connexion), et les adresses IP (jamais écrites en base).",
      ...(plusDePages.length ? [`Export partiel : les sections ${plusDePages.join(", ")} dépassent le plafond d'une page. Télécharge la suite avec « ?page=${page + 1} » à la fin de l'adresse de l'export.`] : []),
      ...(lignesTronquees ? [`Les lignes de commande de cette page dépassent ${LIGNES_MAX} : télécharge les pages suivantes pour les commandes restantes.`] : []),
      ...indisponibles.map((i) => i.message),
    ],
  };
}
