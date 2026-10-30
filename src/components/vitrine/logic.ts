// Logique pure de la vitrine publique (panier, totaux indicatifs, WhatsApp, erreurs de commande, couleurs).
// Aucun accès réseau ni navigateur ici : tout est testable. Le serveur reste l'autorité (prix, stock, total).
import { totalCentimes } from "@/lib/boutique/money";
import { REF_RE, UUID_RE } from "@/lib/boutique/validate";

/** Variante vue par le PUBLIC : jamais la quantité en stock (migration 0007), seulement disponible / stock bas. */
export type VariantePub = { id: string; nom: string; position: number; disponible: boolean; stock_bas: boolean };
export type ProduitPub = {
  id: string;
  categorie_id: string | null;
  titre: string;
  description: string;
  prix_centimes: number;
  images: string[];
  position: number;
  variantes: VariantePub[];
};
export type BoutiquePub = {
  id: string; slug: string; nom: string; description: string;
  couleur_principale: string; couleur_accent: string; logo: string | null; adresse: string;
  whatsapp: string | null; email: string | null; telephone: string | null;
  modes: ("retrait" | "livraison" | "contact")[]; published_at: string | null;
};
export type CataloguePub = { boutique: BoutiquePub; categories: { id: string; nom: string; position: number }[]; produits: ProduitPub[]; marque_blanche?: boolean };

export const MAX_LIGNES = 20;
export const MAX_QTE = 99;
/** Seuil « stock bas » (miroir de la vue SQL variantes_publiques et de la route catalogue). */
export const STOCK_BAS = 5;

// ---------- Panier (seulement variante_id + quantité) ----------
export type Ligne = { variante_id: string; quantite: number };

const clampQte = (n: number) => Math.min(MAX_QTE, Math.max(0, Math.floor(n)));

/** Relit un panier stocké : ignore tout ce qui est invalide, additionne les doublons, limite à 20 lignes. */
export function parseCart(raw: string | null | undefined): Ligne[] {
  if (!raw) return [];
  let data: unknown;
  try { data = JSON.parse(raw); } catch { return []; }
  const arr = Array.isArray(data) ? data : [];
  let lignes: Ligne[] = [];
  for (const l of arr) {
    if (typeof l !== "object" || l === null) continue;
    const { variante_id, quantite } = l as Record<string, unknown>;
    if (typeof variante_id !== "string" || !UUID_RE.test(variante_id) || typeof quantite !== "number" || !Number.isFinite(quantite)) continue;
    lignes = addLigne(lignes, variante_id.toLowerCase(), clampQte(quantite));
  }
  return lignes;
}

export function addLigne(lignes: readonly Ligne[], id: string, qte = 1): Ligne[] {
  const q = clampQte(qte);
  if (q <= 0) return [...lignes];
  const i = lignes.findIndex((l) => l.variante_id === id);
  if (i >= 0) return lignes.map((l, k) => (k === i ? { ...l, quantite: clampQte(l.quantite + q) } : l));
  if (lignes.length >= MAX_LIGNES) return [...lignes];
  return [...lignes, { variante_id: id, quantite: q }];
}
/** Fixe la quantité ; 0 (ou moins) retire la ligne. */
export function setQuantite(lignes: readonly Ligne[], id: string, qte: number): Ligne[] {
  const q = Number.isFinite(qte) ? clampQte(qte) : 0;
  if (q <= 0) return removeLigne(lignes, id);
  return lignes.map((l) => (l.variante_id === id ? { ...l, quantite: q } : l));
}
export const removeLigne = (lignes: readonly Ligne[], id: string): Ligne[] => lignes.filter((l) => l.variante_id !== id);
export const countArticles = (lignes: readonly Ligne[]) => lignes.reduce((s, l) => s + l.quantite, 0);

// ---------- Disponibilité et résolution du panier avec le catalogue ----------
export type Dispo = "disponible" | "bas" | "indisponible";
export const dispoVariante = (v: Pick<VariantePub, "disponible" | "stock_bas">): Dispo => (!v.disponible ? "indisponible" : v.stock_bas ? "bas" : "disponible");
export const dispoProduit = (p: Pick<ProduitPub, "variantes">): Dispo => {
  const d = p.variantes.map(dispoVariante);
  return d.includes("disponible") ? "disponible" : d.includes("bas") ? "bas" : "indisponible";
};
export const DISPO_LABEL: Record<Dispo, string> = { disponible: "Disponible", bas: "Stock bas", indisponible: "Indisponible" };

export type Probleme = "retire" | "indisponible" | "stock_insuffisant";
export type LigneResolue = {
  ligne: Ligne;
  produit: ProduitPub | null;
  variante: VariantePub | null;
  prix_unitaire_centimes: number;
  probleme: Probleme | null;
  /** Quantité maximale commandable d'après le catalogue chargé (indicatif : le stock exact n'est plus public, la base tranche à la commande). */
  max: number;
};

export function resolveCart(lignes: readonly Ligne[], produits: readonly ProduitPub[]): LigneResolue[] {
  const idx = new Map<string, { p: ProduitPub; v: VariantePub }>();
  for (const p of produits) for (const v of p.variantes) idx.set(v.id, { p, v });
  return lignes.map((ligne) => {
    const hit = idx.get(ligne.variante_id);
    if (!hit) return { ligne, produit: null, variante: null, prix_unitaire_centimes: 0, probleme: "retire", max: 0 };
    const { p, v } = hit;
    const probleme: Probleme | null = !v.disponible ? "indisponible" : null;
    return { ligne, produit: p, variante: v, prix_unitaire_centimes: p.prix_centimes, probleme, max: v.disponible ? MAX_QTE : 0 };
  });
}
/** Total INDICATIF des seules lignes sans problème (le serveur recalcule à la commande). */
export const totalIndicatif = (items: readonly LigneResolue[]) =>
  totalCentimes(items.filter((i) => !i.probleme).map((i) => ({ prix_unitaire_centimes: i.prix_unitaire_centimes, quantite: i.ligne.quantite })));
export const hasProbleme = (items: readonly LigneResolue[]) => items.some((i) => i.probleme);
export const PROBLEME_LABEL: Record<Probleme, string> = {
  retire: "Cet article n'est plus proposé par la boutique.",
  indisponible: "Cet article n'est plus disponible.",
  stock_insuffisant: "Quantité supérieure au stock disponible.",
};

// ---------- Contact ----------
/** Numéro nettoyé pour wa.me : chiffres seulement (indicatif inclus), « 00 » initial retiré. Null si inutilisable (6 à 15 chiffres). */
export function cleanWhatsapp(raw: string | null | undefined): string | null {
  if (!raw) return null;
  let d = raw.replace(/\D+/g, "");
  if (d.startsWith("00")) d = d.slice(2);
  return d.length >= 6 && d.length <= 15 ? d : null;
}
export function whatsappLink(raw: string | null | undefined, message?: string): string | null {
  const n = cleanWhatsapp(raw);
  if (!n) return null;
  return `https://wa.me/${n}${message ? `?text=${encodeURIComponent(message)}` : ""}`;
}
export function telLink(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const t = raw.trim().replace(/[^\d+]/g, "");
  return /^\+?\d{4,16}$/.test(t) ? `tel:${t}` : null;
}
export const mailLink = (raw: string | null | undefined) => (raw && /^[^\s@<>"]+@[^\s@<>"]+\.[^\s@<>"]+$/.test(raw.trim()) ? `mailto:${raw.trim()}` : null);

// ---------- Commande : succès et erreurs ----------
export type CommandeOk = { ref: string; jeton: string | null; total_centimes: number | null; rejouee: boolean };

/** N'accepte comme « réussie » qu'une réponse 200/201 complète. Le faux succès anti-spam (sans jeton ni total) est refusé. */
export function parseCommandeSuccess(status: number, body: unknown): CommandeOk | null {
  if (status !== 200 && status !== 201) return null;
  const b = (typeof body === "object" && body !== null ? body : {}) as Record<string, unknown>;
  const c = (typeof b.commande === "object" && b.commande !== null ? b.commande : {}) as Record<string, unknown>;
  if (typeof c.ref !== "string" || !REF_RE.test(c.ref) || c.ref === "CMD-00000000") return null;
  const rejouee = b.rejouee === true;
  const jeton = typeof c.jeton_suivi === "string" && /^[0-9a-f]{64}$/.test(c.jeton_suivi) ? c.jeton_suivi : null;
  const total = typeof c.total_centimes === "number" && Number.isInteger(c.total_centimes) ? c.total_centimes : null;
  if (!rejouee && (!jeton || total === null)) return null;
  return { ref: c.ref, jeton, total_centimes: total, rejouee };
}

export type CommandeErreur = { message: string; champs: Record<string, string>; rafraichir: boolean; reessayer: boolean };

/** Traduit une réponse d'erreur de POST /api/boutique/commande en message affichable (status null = réseau coupé). */
export function mapCommandeError(status: number | null, body: unknown): CommandeErreur {
  const b = (typeof body === "object" && body !== null ? body : {}) as { error?: unknown; code?: unknown; errors?: unknown };
  const code = typeof b.code === "string" ? b.code : "";
  const serveur = typeof b.error === "string" && b.error ? b.error : "";
  const champs: Record<string, string> = {};
  if (typeof b.errors === "object" && b.errors !== null) for (const [k, v] of Object.entries(b.errors)) if (typeof v === "string") champs[k] = v;
  const e = (message: string, o: Partial<CommandeErreur> = {}): CommandeErreur => ({ message, champs, rafraichir: false, reessayer: false, ...o });
  if (status === null) return e("Connexion impossible : ta commande n'a pas été confirmée. Vérifie ta connexion puis réessaie (aucun doublon ne sera créé).", { reessayer: true });
  switch (code) {
    case "stock_insuffisant": return e(serveur || "Un article n'est plus disponible en quantité suffisante. Mets à jour ton panier.", { rafraichir: true });
    case "produit_indisponible": return e(serveur || "Un article du panier n'est plus disponible.", { rafraichir: true });
    case "boutique_introuvable": return e("Cette boutique n'est plus ouverte aux commandes.");
    case "mode_invalide": return e("Ce mode de commande n'est pas proposé par la boutique.");
    case "invalid": case "client_invalide": return e(serveur || "Certains champs sont invalides.");
    case "quantite_invalide": return e("Le panier est invalide (quantité de 1 à 99, 200 articles au maximum, 20 articles différents au maximum).");
    case "cle_invalide": return e("Commande interrompue, réessaie.", { reessayer: true });
    case "rate_limit": return e("Trop de tentatives. Réessaie dans une minute.", { reessayer: true });
    case "trop_de_commandes_contact": return e("Tu as déjà plusieurs commandes en attente de confirmation dans cette boutique. Attends qu'elles soient traitées ou contacte la boutique.");
    case "trop_de_commandes": return e("Cette boutique reçoit trop de commandes en ce moment. Réessaie plus tard.", { reessayer: true });
    case "origin": return e("Requête refusée par le site. Recharge la page puis réessaie.");
    case "demo": return e("Les commandes ne sont pas disponibles pour le moment.");
  }
  if (status >= 500) return e(serveur || "Commande impossible pour le moment. Réessaie dans un instant.", { reessayer: true });
  return e(serveur || "Commande refusée.");
}

/** Clé d'idempotence : UUID aléatoire (16 à 64 caractères exigés par l'API). */
export function newCle(): string {
  const c = globalThis.crypto;
  if (c?.randomUUID) return c.randomUUID();
  const b = new Uint8Array(16);
  c.getRandomValues(b);
  return Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");
}

// ---------- Couleurs de la boutique ----------
const HEX = /^#[0-9a-fA-F]{6}$/;
export const safeColor = (c: string | null | undefined, fallback: string) => (c && HEX.test(c) ? c.toLowerCase() : fallback);
const lum = (hex: string) => {
  const ch = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * ch[0]! + 0.7152 * ch[1]! + 0.0722 * ch[2]!;
};
export const contrast = (a: string, b: string) => {
  const hi = Math.max(lum(a), lum(b));
  const lo = Math.min(lum(a), lum(b));
  return (hi + 0.05) / (lo + 0.05);
};
/** Texte lisible (blanc ou presque noir) sur un fond donné. */
export const readableOn = (bg: string) => (contrast(bg, "#ffffff") >= contrast(bg, "#111111") ? "#ffffff" : "#111111");
/** Couleur utilisable comme TEXTE sur fond blanc : la couleur de la boutique si assez contrastée (4,5:1), sinon assombrie. */
export function textOnWhite(hex: string): string {
  let c = hex;
  for (let i = 0; i < 30 && contrast(c, "#ffffff") < 4.5; i++) {
    c = "#" + [1, 3, 5].map((k) => Math.round(parseInt(c.slice(k, k + 2), 16) * 0.88).toString(16).padStart(2, "0")).join("");
  }
  return c;
}

/** Images : seules les URL https sont affichées. */
export const imagesSures = (imgs: readonly string[] | null | undefined) => (imgs ?? []).filter((u) => typeof u === "string" && /^https:\/\//i.test(u));
