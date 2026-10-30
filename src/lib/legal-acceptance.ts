import { VERSIONS } from "@/data/legal";

// Preuve d'acceptation des documents légaux (CGU, CGV, confidentialité). Table `legal_acceptances`
// (migration 0002) : écrite UNIQUEMENT par le serveur, lisible par son propriétaire. Aucune adresse IP n'est
// enregistrée par défaut (minimisation) : date, version, contexte et cases cochées suffisent comme preuve.

/** Documents dont l'acceptation peut être enregistrée. Chacun doit exister dans VERSIONS (src/data/legal.ts). */
export const ACCEPTABLE_DOCS = ["cgu", "cgv", "confidentialite"] as const;
export type AcceptableDoc = (typeof ACCEPTABLE_DOCS)[number];
export type Contexte = "inscription" | "achat";

export const isAcceptableDoc = (x: unknown): x is AcceptableDoc => typeof x === "string" && (ACCEPTABLE_DOCS as readonly string[]).includes(x);

/** Version en vigueur d'un document. */
export const currentVersion = (doc: AcceptableDoc): string => VERSIONS[doc];

/** Documents à accepter à l'inscription / à la première connexion. */
export const SIGNUP_DOCS: readonly AcceptableDoc[] = ["cgu", "confidentialite"];

export type AcceptanceRow = {
  user_id: string;
  document: AcceptableDoc;
  version: string;
  contexte: Contexte;
  renonciation_retractation: boolean;
  formule: string | null;
};

type Checked = { ok: true; documents: { document: AcceptableDoc; version: string }[] } | { ok: false; status: number; error: string };

/**
 * Vérifie une demande d'enregistrement : documents connus, versions EXACTEMENT égales à celles en vigueur.
 * (Une page restée ouverte avec d'anciennes conditions est refusée : l'utilisateur doit relire.)
 */
export function checkAcceptance(body: unknown, allowed: readonly AcceptableDoc[] = ACCEPTABLE_DOCS): Checked {
  const list = (body as { documents?: unknown } | null)?.documents;
  if (!Array.isArray(list) || list.length === 0 || list.length > ACCEPTABLE_DOCS.length) return { ok: false, status: 400, error: "Demande invalide." };
  const seen = new Set<string>();
  const documents: { document: AcceptableDoc; version: string }[] = [];
  for (const item of list) {
    const { document, version } = (item ?? {}) as { document?: unknown; version?: unknown };
    if (!isAcceptableDoc(document) || !allowed.includes(document) || typeof version !== "string" || seen.has(document)) return { ok: false, status: 400, error: "Document inconnu." };
    if (version !== currentVersion(document)) return { ok: false, status: 409, error: "Les conditions ont été mises à jour depuis que cette page est ouverte : recharge la page et relis-les." };
    seen.add(document);
    documents.push({ document, version });
  }
  return { ok: true, documents };
}

/** Client d'écriture minimal (le client service_role de Supabase, ou un faux dans les tests). */
type Writer = { from(table: string): { insert(rows: unknown): PromiseLike<{ error: { message: string } | null }> } };

/** Enregistre la preuve. Renvoie false en cas d'échec : l'appelant ne doit alors JAMAIS poursuivre comme si c'était fait. */
export async function recordAcceptances(admin: Writer, rows: AcceptanceRow[]): Promise<boolean> {
  if (!rows.length) return false;
  try {
    const { error } = await admin.from("legal_acceptances").insert(rows);
    if (error) {
      console.error("[legal] enregistrement de l'acceptation impossible (migration 0002 exécutée ?)");
      return false;
    }
    return true;
  } catch {
    console.error("[legal] enregistrement de l'acceptation impossible");
    return false;
  }
}

/** Conditions exigées avant un achat (confirmées par le navigateur, revérifiées ici). */
export type PurchaseConsent = { acceptCgv?: unknown; renonciation?: unknown; cgvVersion?: unknown };

export function checkPurchaseConsent(c: PurchaseConsent): { ok: true } | { ok: false; status: number; error: string } {
  if (c.acceptCgv !== true) return { ok: false, status: 400, error: "Coche « J'ai lu et j'accepte les conditions générales de vente » pour continuer." };
  if (c.renonciation !== true) return { ok: false, status: 400, error: "Coche la case de demande d'accès immédiat et de renonciation au droit de rétractation pour continuer (sans elle, le service ne peut pas démarrer tout de suite)." };
  if (c.cgvVersion !== currentVersion("cgv")) return { ok: false, status: 409, error: "Les conditions de vente ont été mises à jour : recharge la page et relis-les avant de commander." };
  return { ok: true };
}

/** Client de lecture minimal (client Supabase lié à la session, soumis à la RLS). */
export type LegalReader = { from(table: string): { select(cols: string): { eq(col: string, v: string): PromiseLike<{ data: { document: string; version: string }[] | null; error: unknown }> } } };

/**
 * Le compte a-t-il accepté la version en vigueur des CGU et de la confidentialité ?
 * Renvoie null si on ne peut pas le savoir (table absente avant la migration, panne) : l'appelant ne doit pas bloquer l'utilisateur dans ce cas.
 */
export async function hasAcceptedSignupDocs(sb: LegalReader, userId: string): Promise<boolean | null> {
  try {
    const { data, error } = await sb.from("legal_acceptances").select("document, version").eq("user_id", userId);
    if (error || !data) return null;
    return SIGNUP_DOCS.every((doc) => data.some((r) => r.document === doc && r.version === currentVersion(doc)));
  } catch {
    return null;
  }
}
