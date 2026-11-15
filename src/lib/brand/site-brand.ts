import { DEFAULT_BRAND } from "./types";
import type { EffectiveBrand } from "./effective";
import { brandToCssVars } from "./css";
import { validateLogo, validateFavicon } from "./validate";
import type { Config } from "@/lib/types";

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
