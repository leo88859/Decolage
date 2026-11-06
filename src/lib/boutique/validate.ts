import { slugError, EMAIL_RE } from "@/lib/publish";
import { validateColor } from "@/lib/brand/validate";
import { isCentimes, QUANTITE_MAX, QUANTITE_TOTALE_MAX } from "./money";
import { MODES, STATUTS_BOUTIQUE, STATUTS_COMMANDE, type Mode, type StatutBoutique, type StatutCommande } from "./types";
import { THEME_IDS, type ThemeId } from "./themes";

// Validation STRICTE des entrées de l'API boutique. Pure (sans serveur) : réutilisable côté navigateur pour les messages.
// Règles communes : types exacts (pas de conversion silencieuse), champs inconnus refusés (sauf lignes de commande),
// texte normalisé (NFC, espaces nettoyés), balises < > et caractères invisibles/de contrôle refusés.

export type Errors = Record<string, string>;
export type Result<T> = { ok: true; value: T } | { ok: false; errors: Errors };

const BAD_CHARS = /[\u0000-\u0008\u000b-\u001f\u007f-\u009f\u200b-\u200f\u202a-\u202e\u2066-\u2069\ufeff]/; // contrôle (sauf \n et \t) et caractères bidi/invisibles
export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
// Anciennes commandes : 8 caractères ; nouvelles (migration 0007) : 12 caractères.
export const REF_RE = /^CMD-(?:[0-9A-F]{8}|[0-9A-F]{12})$/;
export const CLE_RE = /^[A-Za-z0-9_-]{16,64}$/;
const PHONE_RE = /^\+?[0-9 ().-]{6,20}$/;

type Opt = { min?: number; max: number; multiline?: boolean };
function text(v: unknown, o: Opt): { ok: true; value: string } | { ok: false; error: string } {
  if (typeof v !== "string") return { ok: false, error: "Texte attendu." };
  let s = v.normalize("NFC").trim();
  s = o.multiline ? s.replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n") : s.replace(/\s+/g, " ");
  const len = [...s].length;
  if (len < (o.min ?? 0)) return { ok: false, error: o.min === 1 ? "Ce champ est obligatoire." : `${o.min} caractères au minimum.` };
  if (len > o.max) return { ok: false, error: `${o.max} caractères au maximum.` };
  if (/[<>]/.test(s)) return { ok: false, error: "Les balises (< ou >) ne sont pas autorisées." };
  if (BAD_CHARS.test(s) || (!o.multiline && /[\n\t]/.test(s))) return { ok: false, error: "Caractère invisible ou de contrôle interdit." };
  return { ok: true, value: s };
}

/** Petit constructeur : accumule les erreurs champ par champ, refuse les champs inconnus. */
class Reader {
  readonly errors: Errors = {};
  readonly out: Record<string, unknown> = {};
  readonly src: Record<string, unknown>;
  constructor(input: unknown, allowed: readonly string[], private partial: boolean, private required: readonly string[]) {
    if (typeof input !== "object" || input === null || Array.isArray(input)) {
      this.errors["_"] = "Objet JSON attendu.";
      this.src = {};
      return;
    }
    this.src = input as Record<string, unknown>;
    for (const k of Object.keys(this.src)) if (!allowed.includes(k)) this.errors[k] = "Champ inconnu.";
    if (!partial) for (const k of required) if (!(k in this.src)) this.errors[k] = "Champ obligatoire.";
  }
  has(k: string) {
    return k in this.src && this.src[k] !== undefined;
  }
  run<T>(k: string, check: (v: unknown) => { ok: true; value: T } | { ok: false; error: string }, column = k) {
    if (!this.has(k) || this.errors[k]) return;
    const r = check(this.src[k]);
    if (r.ok) this.out[column] = r.value;
    else this.errors[k] = r.error;
  }
  text(k: string, o: Opt) {
    this.run(k, (v) => text(v, o));
  }
  result<T>(): Result<T> {
    if (this.partial && Object.keys(this.src).length === 0 && !this.errors["_"]) this.errors["_"] = "Aucun champ à modifier.";
    return Object.keys(this.errors).length ? { ok: false, errors: this.errors } : { ok: true, value: this.out as T };
  }
}

const bool = (v: unknown) => (typeof v === "boolean" ? { ok: true as const, value: v } : { ok: false as const, error: "Vrai ou faux attendu." });
const int = (min: number, max: number) => (v: unknown) =>
  typeof v === "number" && Number.isInteger(v) && v >= min && v <= max ? { ok: true as const, value: v } : { ok: false as const, error: `Entier entre ${min} et ${max} attendu.` };
const uuid = (v: unknown) => (typeof v === "string" && UUID_RE.test(v) ? { ok: true as const, value: v.toLowerCase() } : { ok: false as const, error: "Identifiant invalide." });
/** Optionnel : null ou texte vide = pas de valeur. */
const optional = <T>(f: (v: string) => { ok: true; value: T } | { ok: false; error: string }) => (v: unknown) => {
  if (v === null || v === "") return { ok: true as const, value: null };
  return typeof v === "string" ? f(v.trim()) : { ok: false as const, error: "Texte attendu." };
};

// ─── Boutique ────────────────────────────────────────────────────────────
export type BoutiqueIn = {
  slug: string; nom: string; description: string; couleur_principale: string; couleur_accent: string; logo: string | null;
  adresse: string; whatsapp: string | null; email: string | null; telephone: string | null; modes: Mode[]; statut: StatutBoutique; theme: ThemeId;
};
const BOUTIQUE_KEYS = ["slug", "nom", "description", "couleur_principale", "couleur_accent", "logo", "adresse", "whatsapp", "email", "telephone", "modes", "statut", "theme"] as const;

export function validateBoutique(input: unknown, partial = false): Result<Partial<BoutiqueIn>> {
  const r = new Reader(input, BOUTIQUE_KEYS, partial, ["slug", "nom"]);
  r.run("slug", (v) => {
    if (typeof v !== "string") return { ok: false, error: "Texte attendu." };
    const s = v.trim().toLowerCase();
    const e = slugError(s);
    return e ? { ok: false, error: e } : { ok: true, value: s };
  });
  r.text("nom", { min: 1, max: 80 });
  r.text("description", { max: 1000, multiline: true });
  r.text("adresse", { max: 200 });
  for (const k of ["couleur_principale", "couleur_accent"] as const) r.run(k, (v) => { const c = validateColor(v); return c.ok ? c : { ok: false, error: c.error }; });
  r.run("logo", optional((s) => (s.length <= 500 && /^https:\/\/[^\s<>"']+$/.test(s) ? { ok: true, value: s } : { ok: false, error: "Adresse https:// attendue (500 caractères au maximum)." })));
  r.run("whatsapp", optional((s) => { const d = s.replace(/[\s().-]/g, ""); return /^\+?[0-9]{6,15}$/.test(d) ? { ok: true, value: d } : { ok: false, error: "Numéro invalide (chiffres, avec + éventuel)." }; }));
  r.run("telephone", optional((s) => { const d = s.replace(/[\s().-]/g, ""); return /^\+?[0-9]{6,15}$/.test(d) ? { ok: true, value: d } : { ok: false, error: "Numéro invalide (chiffres, avec + éventuel)." }; }));
  r.run("email", optional((s) => { const e = s.toLowerCase(); return e.length <= 254 && EMAIL_RE.test(e) ? { ok: true, value: e } : { ok: false, error: "Adresse e-mail invalide." }; }));
  r.run("modes", (v) => {
    if (!Array.isArray(v) || v.length < 1 || v.length > 3 || !v.every((m) => (MODES as readonly unknown[]).includes(m)) || new Set(v).size !== v.length)
      return { ok: false, error: "Un à trois modes parmi retrait, livraison, contact." };
    return { ok: true, value: v as Mode[] };
  });
  r.run("statut", (v) => ((STATUTS_BOUTIQUE as readonly unknown[]).includes(v) ? { ok: true, value: v as StatutBoutique } : { ok: false, error: "brouillon ou publiee attendu." }));
  r.run("theme", (v) => ((THEME_IDS as readonly unknown[]).includes(v) ? { ok: true, value: v as ThemeId } : { ok: false, error: "Thème inconnu." }));
  return r.result();
}

// ─── Catégorie ───────────────────────────────────────────────────────────
export function validateCategorie(input: unknown, partial = false): Result<{ nom?: string; position?: number }> {
  const r = new Reader(input, ["nom", "position"], partial, ["nom"]);
  r.text("nom", { min: 1, max: 60 });
  r.run("position", int(0, 10000));
  return r.result();
}

// ─── Variante ────────────────────────────────────────────────────────────
export type VarianteIn = { nom: string; stock: number; actif: boolean; position: number };
export function validateVariante(input: unknown, partial = false): Result<Partial<VarianteIn>> {
  const r = new Reader(input, ["nom", "stock", "actif", "position"], partial, ["nom"]);
  r.text("nom", { min: 1, max: 80 });
  r.run("stock", int(0, 1_000_000));
  r.run("actif", bool);
  r.run("position", int(0, 1000));
  return r.result();
}

// ─── Produit ─────────────────────────────────────────────────────────────
export type ProduitIn = { titre: string; description: string; prix_centimes: number; images: string[]; actif: boolean; position: number; categorie_id: string | null };
export function validateProduit(input: unknown, partial = false): Result<Partial<ProduitIn> & { variantes?: Partial<VarianteIn>[] }> {
  const r = new Reader(input, ["titre", "description", "prix_centimes", "images", "actif", "position", "categorie_id", ...(partial ? [] : ["variantes"])], partial, ["titre", "prix_centimes"]);
  r.text("titre", { min: 1, max: 120 });
  r.text("description", { max: 2000, multiline: true });
  r.run("prix_centimes", (v) => (isCentimes(v) ? { ok: true, value: v } : { ok: false, error: "Prix en centimes : entier entre 0 et 99999999 (jamais négatif, jamais décimal)." }));
  r.run("images", (v) => {
    if (!Array.isArray(v) || v.length > 5) return { ok: false, error: "5 images au maximum." };
    if (!v.every((u) => typeof u === "string" && u.length <= 500 && /^https:\/\/[^\s<>"']+$/.test(u))) return { ok: false, error: "Chaque image doit être une adresse https:// valide." };
    return { ok: true, value: v as string[] };
  });
  r.run("actif", bool);
  r.run("position", int(0, 100000));
  r.run("categorie_id", (v) => (v === null ? { ok: true, value: null } : uuid(v)));
  r.run("variantes", (v) => {
    if (!Array.isArray(v) || v.length < 1 || v.length > 50) return { ok: false, error: "1 à 50 variantes." };
    const list: Partial<VarianteIn>[] = [];
    for (const item of v) {
      const x = validateVariante(item);
      if (!x.ok) return { ok: false, error: Object.values(x.errors)[0] ?? "Variante invalide." };
      list.push(x.value);
    }
    if (new Set(list.map((x) => x.nom)).size !== list.length) return { ok: false, error: "Deux variantes ne peuvent pas avoir le même nom." };
    return { ok: true, value: list };
  });
  return r.result();
}

// ─── Statut de commande ──────────────────────────────────────────────────
export function validateStatut(input: unknown): Result<{ statut: StatutCommande }> {
  const r = new Reader(input, ["statut"], false, ["statut"]);
  r.run("statut", (v) => ((STATUTS_COMMANDE as readonly unknown[]).includes(v) ? { ok: true, value: v as StatutCommande } : { ok: false, error: "Statut inconnu." }));
  return r.result();
}

// ─── Commande publique ───────────────────────────────────────────────────
export type CommandeIn = {
  slug: string; cle: string; mode: Mode;
  client: { nom: string; email: string | null; telephone: string | null; adresse: string; note: string };
  lignes: { variante_id: string; quantite: number }[];
};
/**
 * Entrée de la commande publique. Les clés inconnues (prix, total, paiement, statut…) sont IGNORÉES : seuls
 * variante_id et quantite de chaque ligne sont gardés ; la base relit prix et stock.
 */
export function validateCommande(input: unknown): Result<CommandeIn> {
  const errors: Errors = {};
  if (typeof input !== "object" || input === null || Array.isArray(input)) return { ok: false, errors: { _: "Objet JSON attendu." } };
  const o = input as Record<string, unknown>;

  const slug = typeof o.slug === "string" ? o.slug.trim().toLowerCase() : "";
  if (slugError(slug)) errors.slug = "Boutique invalide.";
  const cle = typeof o.cle === "string" ? o.cle : "";
  if (!CLE_RE.test(cle)) errors.cle = "Clé de commande invalide (16 à 64 caractères : lettres, chiffres, - et _).";
  const mode = (MODES as readonly unknown[]).includes(o.mode) ? (o.mode as Mode) : null;
  if (!mode) errors.mode = "Mode de commande invalide.";

  const c = typeof o.client === "object" && o.client !== null && !Array.isArray(o.client) ? (o.client as Record<string, unknown>) : null;
  const client = { nom: "", email: null as string | null, telephone: null as string | null, adresse: "", note: "" };
  if (!c) errors.client = "Coordonnées du client manquantes.";
  else {
    const nom = text(c.nom, { min: 1, max: 80 });
    if (nom.ok) client.nom = nom.value; else errors["client.nom"] = nom.error;
    if (c.email !== undefined && c.email !== null && c.email !== "") {
      const e = typeof c.email === "string" ? c.email.trim().toLowerCase() : "";
      if (e.length <= 254 && EMAIL_RE.test(e) && !/[<>]/.test(e)) client.email = e; else errors["client.email"] = "Adresse e-mail invalide.";
    }
    if (c.telephone !== undefined && c.telephone !== null && c.telephone !== "") {
      const t = typeof c.telephone === "string" ? c.telephone.trim() : "";
      if (PHONE_RE.test(t)) client.telephone = t; else errors["client.telephone"] = "Numéro de téléphone invalide.";
    }
    if (!errors["client.email"] && !errors["client.telephone"] && !client.email && !client.telephone) errors["client.email"] = "Indique un e-mail ou un téléphone pour être recontacté.";
    for (const [k, max] of [["adresse", 300], ["note", 500]] as const) {
      if (c[k] === undefined || c[k] === null || c[k] === "") continue;
      const t = text(c[k], { max, multiline: k === "note" });
      if (t.ok) client[k] = t.value; else errors[`client.${k}`] = t.error;
    }
    if (mode === "livraison" && !client.adresse && !errors["client.adresse"]) errors["client.adresse"] = "L'adresse est obligatoire pour une livraison.";
  }

  const lignes: CommandeIn["lignes"] = [];
  if (!Array.isArray(o.lignes) || o.lignes.length < 1 || o.lignes.length > 20) errors.lignes = "Le panier doit contenir entre 1 et 20 lignes.";
  else {
    for (const [i, l] of o.lignes.entries()) {
      const x = typeof l === "object" && l !== null ? (l as Record<string, unknown>) : {};
      const id = typeof x.variante_id === "string" && UUID_RE.test(x.variante_id) ? x.variante_id.toLowerCase() : null;
      const q = x.quantite;
      if (!id) errors[`lignes.${i}`] = "Article invalide.";
      else if (typeof q !== "number" || !Number.isInteger(q) || q < 1 || q > QUANTITE_MAX) errors[`lignes.${i}`] = `Quantité : entier entre 1 et ${QUANTITE_MAX}.`;
      else lignes.push({ variante_id: id, quantite: q });
    }
  }
  if (!errors.lignes && lignes.reduce((s, l) => s + l.quantite, 0) > QUANTITE_TOTALE_MAX) errors.lignes = `${QUANTITE_TOTALE_MAX} articles au maximum par commande.`;
  if (Object.keys(errors).length || !mode) return { ok: false, errors };
  return { ok: true, value: { slug, cle, mode, client, lignes } };
}
