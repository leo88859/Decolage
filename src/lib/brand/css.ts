// Marque -> variables CSS. JAMAIS de CSS libre : seules des couleurs #rrggbb revalidées sont écrites,
// toute autre valeur est remplacée par la valeur par défaut. Le nom et les images n'y figurent pas.
import { onPrimary } from "./contrast";
import { COLOR_KEYS, DEFAULT_BRAND, type BrandColors } from "./types";

const HEX = /^#[0-9a-f]{6}$/;

function safe(value: unknown, fallback: string): string {
  return typeof value === "string" && HEX.test(value) ? value : fallback;
}

type ColorInput = Partial<Record<keyof BrandColors, unknown>>;

/** Objet de variables --brand-* (utilisable comme style React). */
export function brandToCssObject(brand: ColorInput): Record<string, string> {
  const c = {} as BrandColors;
  for (const k of COLOR_KEYS) c[k] = safe(brand?.[k], DEFAULT_BRAND[k]);
  return {
    "--brand-primary": c.primary,
    "--brand-secondary": c.secondary,
    "--brand-accent": c.accent,
    "--brand-surface": c.surface,
    "--brand-text": c.text,
    "--brand-on-primary": onPrimary(c),
  };
}

/** Déclarations CSS (« --brand-primary:#2f5bff;… »), à placer dans un sélecteur contrôlé par nous. */
export function brandToCssVars(brand: ColorInput): string {
  return Object.entries(brandToCssObject(brand)).map(([k, v]) => `${k}:${v}`).join(";") + ";";
}
