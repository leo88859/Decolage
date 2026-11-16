import { DEFAULT_BRAND } from "./types";
import type { EffectiveBrand } from "./effective";
import { brandToCssVars } from "./css";
import { validateLogo, validateFavicon } from "./validate";
import { ratioOf } from "@/lib/a11y/contrast";
import type { Config, Project } from "@/lib/types";

// Marque blanche des sites publiés (landing + démo) : fonctions PURES, sans accès base.
// Le droit vient de EffectiveBrand.entitled (calculé côté serveur) ; sans droit -> null : rien n'est imposé.
// Une couleur ou un nom restés aux valeurs par défaut de marque ne remplacent PAS le thème du projet.

export type SiteBrand = {
  /** Nom commercial, jamais vide. */
  name: string;
  /** Couleurs imposées au thème du site (#rrggbb validées), absentes si non personnalisées. */
  primary?: string;
  accent?: string;
  /** Déclarations --brand-* (hex revalidées uniquement). */
  cssVars: string;
  secondary: string;
  /** Data URL validée, ou null. */
  logo: string | null;
  favicon: string | null;
};

/** Identité publique à appliquer, ou null (droit refusé, ou rien d'enregistré). */
export function siteBrandFrom(eff: EffectiveBrand | null): SiteBrand | null {
  if (!eff || !eff.entitled || !eff.saved) return null;
  const b = eff.brand;
  const logo = b.logo && validateLogo(b.logo).ok ? b.logo : null;
  const favicon = b.favicon && validateFavicon(b.favicon).ok ? b.favicon : null;
  return {
    name: b.name.trim() || DEFAULT_BRAND.name,
    primary: b.primary !== DEFAULT_BRAND.primary ? b.primary : undefined,
    accent: b.accent !== DEFAULT_BRAND.accent ? b.accent : undefined,
    secondary: b.secondary,
    cssVars: brandToCssVars(b),
    logo,
    favicon,
  };
}

const initialesDe = (nom: string) => {
  const mots = nom.trim().split(/\s+/).filter(Boolean);
  const s = mots.length > 1 ? mots[0][0] + mots[1][0] : nom.trim().slice(0, 2);
  return (s || "MM").toUpperCase();
};

/** Config du site avec l'identité de marque (nom, couleurs, logo). Sans marque : la config d'origine, inchangée. */
export function applyBrandToConfig(cfg: Config, brand: SiteBrand | null): Config {
  if (!brand) return cfg;
  const nomChange = brand.name !== cfg.nom;
  return {
    ...cfg,
    nom: brand.name,
    description: nomChange && cfg.nom ? cfg.description.split(cfg.nom).join(brand.name) : cfg.description,
    initiales: nomChange ? initialesDe(brand.name) : cfg.initiales,
    logo: brand.logo ?? cfg.logo,
    couleurs: { primaire: brand.primary ?? cfg.couleurs.primaire, accent: brand.accent ?? cfg.couleurs.accent },
  };
}

/** Remplace l'ancien nom du projet par le nom commercial dans tous les textes d'un objet (copie ; l'original n'est pas modifié). */
export function renameInTexts<T>(value: T, from: string, to: string): T {
  if (!from || from === to) return value;
  const walk = (v: unknown): unknown =>
    typeof v === "string" ? v.split(from).join(to) : Array.isArray(v) ? v.map(walk) : v && typeof v === "object" ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, k === "layout" || k === "type" || k === "id" ? x : walk(x)])) : v;
  return walk(value) as T;
}

/**
 * Projet complet avec l'identité de marque (nom, couleurs, logo) : sert aux exports. Sans marque : le projet d'origine, inchangé.
 * L'ancien nom est remplacé dans la landing, les tarifs, le contenu et la description (copie ; l'original n'est pas modifié).
 */
export function applyBrandToProject(p: Project, brand: SiteBrand | null): Project {
  if (!brand) return p;
  const from = p.config.nom;
  const config = applyBrandToConfig(p.config, brand);
  return {
    ...p,
    config: { ...config, description: renameInTexts(config.description, from, brand.name) },
    landing: renameInTexts(p.landing, from, brand.name),
    pricing: renameInTexts(p.pricing, from, brand.name),
    contenu: p.contenu ? renameInTexts(p.contenu, from, brand.name) : p.contenu,
  };
}

const xmlEsc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

/** Icône d'onglet de repli (SVG en data URL) aux initiales et à la couleur de la marque, quand aucun favicon n'est enregistré. */
export function fallbackFaviconDataUrl(brand: Pick<SiteBrand, "name" | "primary" | "secondary">): string {
  const ini = xmlEsc(initialesDe(brand.name).replace(/[^\p{L}\p{N}]/gu, "").slice(0, 2) || "M");
  const fill = brand.primary ?? DEFAULT_BRAND.primary;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="14" fill="${fill}"/><text x="32" y="42" text-anchor="middle" font-family="system-ui,sans-serif" font-size="28" font-weight="800" fill="${ratioOf("#ffffff", fill) >= ratioOf("#111111", fill) ? "#ffffff" : "#111111"}">${ini}</text></svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}
