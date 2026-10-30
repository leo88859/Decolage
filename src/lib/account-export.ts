// Export RGPD (accès et portabilité) des données d'UN compte. Le client passé en paramètre est celui de la
// session de l'utilisateur : la RLS de la base ne lui montre déjà que ses propres lignes, et chaque requête
// filtre en plus sur son identifiant (double protection). Aucun secret : ni identifiants Stripe, ni jetons.

type Row = Record<string, unknown>;
type Res = PromiseLike<{ data: Row[] | Row | null; error: unknown }>;
export type ExportClient = { from(table: string): { select(cols: string): { eq(col: string, v: string): Res & { maybeSingle?: () => Res } } } };

const pick = (row: Row, keys: string[]): Row => Object.fromEntries(keys.filter((k) => k in row).map((k) => [k, row[k]]));

export async function buildAccountExport(sb: ExportClient, user: { id: string; email?: string | null; created_at?: string }) {
  const rows = async (table: string, cols: string, keyCol: string): Promise<Row[] | null> => {
    try {
      const { data, error } = await sb.from(table).select(cols).eq(keyCol, user.id);
      return error || !Array.isArray(data) ? null : data;
    } catch {
      return null;
    }
  };
  const [profil, projets, sites, acceptations] = await Promise.all([
    rows("profiles", "plan, favorites, subscription_status, created_at, updated_at", "id"),
    rows("projects", "id, data, updated_at", "user_id"),
    rows("sites", "*", "user_id"),
    rows("legal_acceptances", "document, version, accepted_at, contexte, renonciation_retractation, formule", "user_id"),
  ]);
  return {
    format: "decollage-export-compte",
    exporte_le: new Date().toISOString(),
    compte: { id: user.id, email: user.email ?? null, cree_le: user.created_at ?? null },
    profil: profil?.[0] ? pick(profil[0], ["plan", "favorites", "subscription_status", "created_at", "updated_at"]) : null,
    projets: (projets ?? []).map((p) => pick(p, ["id", "data", "updated_at"])),
    sites_publies: (sites ?? []).map((s) => pick(s, ["slug", "project_id", "data", "published_at", "updated_at", "suspended_at"])),
    acceptations_des_conditions: (acceptations ?? []).map((a) => pick(a, ["document", "version", "accepted_at", "contexte", "renonciation_retractation", "formule"])),
    remarques: [
      "Ne figurent pas ici : les identifiants internes de paiement (conservés par Stripe, qui garde aussi vos factures) et les adresses e-mail des personnes inscrites sur les listes d'attente de vos sites (consultables et exportables depuis l'onglet « En ligne » de chaque projet).",
      ...(acceptations === null ? ["Les acceptations des conditions n'ont pas pu être lues pour le moment."] : []),
    ],
  };
}
