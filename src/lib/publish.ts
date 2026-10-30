import { TEMPLATE_BY_ID } from "@/data/templates";
import { validateConfig } from "@/lib/config";
import { slug as slugify } from "@/lib/export";
import { contenuOf } from "@/lib/project";
import type { Config, Contenu, Landing, Pricing, Project, TemplateId } from "@/lib/types";

// Données d'un site publié. Le HTML n'est JAMAIS stocké : il est recalculé côté serveur à partir
// de ces données validées, ce qui empêche d'injecter du code dans une page publique.

export type SiteData = { config: Config; landing: Landing; pricing: Pricing | null; contenu?: Contenu };

export const SLUG_RE = /^[a-z0-9]([a-z0-9-]{1,38}[a-z0-9])$/;
const RESERVED = new Set(["admin", "api", "app", "www", "decollage", "connexion", "parametres", "guide", "aide", "support", "stripe", "auth"]);

export function slugError(slug: string): string | null {
  if (!SLUG_RE.test(slug)) return "3 à 40 caractères : lettres minuscules, chiffres et tirets (pas au début ni à la fin).";
  if (RESERVED.has(slug)) return "Cette adresse est réservée.";
  return null;
}

export const suggestSlug = (name: string) => slugify(name).slice(0, 40).replace(/-+$/, "") || "mon-saas";

export const siteData = (p: Project): SiteData => {
  const contenu = contenuOf(p);
  return { config: p.config, landing: p.landing, pricing: p.pricing.offres.length ? p.pricing : null, ...(contenu ? { contenu } : {}) };
};

/** Périodes d'offre autorisées (liste blanche : la valeur finit dans une page publique). */
export const PERIODES: readonly string[] = ["mois", "an", "unique"];
const SECTION_TYPES: readonly string[] = ["hero", "features", "etapes", "avantages", "tarifs", "faq", "cta"];

const isStr = (x: unknown, max: number) => typeof x === "string" && x.length <= max;
const strs = (x: unknown, n: number, max: number): x is string[] => Array.isArray(x) && x.length <= n && x.every((s) => isStr(s, max));
const pairs = (x: unknown, n: number, max: number): x is [string, string][] => Array.isArray(x) && x.length <= n && x.every((p) => strs(p, 2, max) && (p as string[]).length === 2);
const num = (x: unknown) => typeof x === "number" && Number.isFinite(x) && Math.abs(x) <= 1e9;

/** Contenu rempli à partir de l'idée : recopié champ par champ, rien d'inattendu ne passe. */
export function cleanContenu(raw: unknown, templateId: TemplateId): Contenu | null {
  const c = raw as Contenu;
  if (!c || typeof c !== "object" || c.type !== templateId || !isStr(c.secteur, 40) || !isStr(c.idee, 600) || !isStr(c.serie, 80)) return null;
  const e = c.entite;
  if (!e || !isStr(e.nom, 60) || !isStr(e.pluriel, 60) || !strs(e.champs, 8, 40) || !e.champs.length) return null;
  if (!Array.isArray(c.lignes) || c.lignes.length > 12 || c.lignes.some((r) => !strs(r, 8, 120) || r.length !== e.champs.length)) return null;
  if (!strs(c.statuts, 10, 40) || !c.statuts.length) return null;
  if (!Array.isArray(c.kpis) || c.kpis.length > 6 || c.kpis.some((k) => !Array.isArray(k) || k.length !== 4 || !isStr(k[0], 60) || !num(k[1]) || !isStr(k[2], 8) || !num(k[3]))) return null;
  if (!pairs(c.fonctionnalites, 8, 300)) return null;
  const p = c.copy;
  if (!p || !isStr(p.heroTitre, 200) || !isStr(p.heroSous, 400) || !isStr(p.cta, 200) || !pairs(p.etapes, 6, 300) || !strs(p.avantages, 6, 300) || !pairs(p.faq, 8, 600)) return null;
  return {
    source: "modele", type: c.type, secteur: c.secteur, idee: c.idee, serie: c.serie,
    entite: { nom: e.nom, pluriel: e.pluriel, champs: [...e.champs] },
    lignes: c.lignes.map((r) => [...r]), statuts: [...c.statuts],
    kpis: c.kpis.map(([a, b, u, d]) => [a, b, u, d] as [string, number, string, number]),
    fonctionnalites: c.fonctionnalites.map(([a, b]) => [a, b] as [string, string]),
    copy: { heroTitre: p.heroTitre, heroSous: p.heroSous, cta: p.cta, etapes: p.etapes.map(([a, b]) => [a, b] as [string, string]), avantages: [...p.avantages], faq: p.faq.map(([a, b]) => [a, b] as [string, string]) },
  };
}

/** Vérifie des données envoyées par un navigateur avant de les rendre publiques. */
export function validateSiteData(raw: unknown): { ok: true; data: SiteData } | { ok: false; error: string } {
  // Données malformées (champ manquant, mauvais type) : refus propre plutôt qu'une erreur serveur.
  try {
    return validateSiteDataUnsafe(raw);
  } catch {
    return { ok: false, error: "Données invalides." };
  }
}

function validateSiteDataUnsafe(raw: unknown): { ok: true; data: SiteData } | { ok: false; error: string } {
  const d = raw as SiteData;
  if (!d || typeof d !== "object" || !d.config || !d.landing) return { ok: false, error: "Données manquantes." };
  if (!TEMPLATE_BY_ID[d.config.templateId]) return { ok: false, error: "Modèle inconnu." };
  const errors = validateConfig(d.config);
  const first = Object.values(errors)[0];
  if (first) return { ok: false, error: `Configuration invalide : ${first}` };
  const l = d.landing;
  if (!["centre", "split", "editorial"].includes(l.layout) || !Array.isArray(l.sections) || l.sections.length > 12) return { ok: false, error: "Landing invalide." };
  if (!isStr(l.boutonPrincipal, 60) || !isStr(l.boutonSecondaire, 60)) return { ok: false, error: "Textes des boutons invalides." };
  for (const s of l.sections) {
    if (!s || typeof s !== "object" || !isStr(s.id, 40) || !SECTION_TYPES.includes(s.type) || typeof s.visible !== "boolean") return { ok: false, error: "Section invalide." };
    if (!isStr(s.titre, 200) || !isStr(s.texte, 600) || !Array.isArray(s.items) || s.items.length > 12) return { ok: false, error: "Section invalide." };
    if (s.items.some((i) => !i || typeof i !== "object" || !isStr(i.titre, 200) || !isStr(i.texte, 600))) return { ok: false, error: "Élément de section invalide." };
  }
  if (d.pricing) {
    const offres = d.pricing.offres;
    if (!Array.isArray(offres) || offres.length > 6) return { ok: false, error: "Offres invalides." };
    if (offres.some((o) => !o || typeof o !== "object" || !isStr(o.id, 40) || !PERIODES.includes(o.periode) || !isStr(o.nom, 60) || typeof o.prix !== "number" || !Number.isFinite(o.prix) || o.prix < 0 || o.prix > 100000 || !Array.isArray(o.features) || o.features.length > 20 || o.features.some((f) => !isStr(f, 200)))) {
      return { ok: false, error: "Offre invalide." };
    }
  }
  // Taille totale raisonnable (le logo en image est déjà limité par validateConfig).
  if (JSON.stringify(d).length > 600_000) return { ok: false, error: "Données trop volumineuses." };
  let contenu: Contenu | undefined;
  if (d.contenu !== undefined && d.contenu !== null) {
    const c = cleanContenu(d.contenu, d.config.templateId);
    if (!c) return { ok: false, error: "Contenu invalide." };
    contenu = c;
  }
  return { ok: true, data: { config: d.config, landing: d.landing, pricing: d.pricing ?? null, ...(contenu ? { contenu } : {}) } };
}

export const EMAIL_RE = /^[^\s@]{1,64}@[^\s@]{1,190}\.[^\s@]{2,}$/;
