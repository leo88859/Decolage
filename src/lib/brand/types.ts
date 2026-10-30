// Marque blanche : types partagés (serveur et navigateur). Aucun import serveur ici.

export type BrandColors = { primary: string; secondary: string; accent: string; surface: string; text: string };

export type Brand = BrandColors & {
  name: string;
  /** Data URL PNG, JPEG ou WebP (jamais SVG), ou null. */
  logo: string | null;
  /** Data URL PNG, ou null. */
  favicon: string | null;
};

export const COLOR_KEYS = ["primary", "secondary", "accent", "surface", "text"] as const;
export type ColorKey = (typeof COLOR_KEYS)[number];

/** Valeurs par défaut : l'identité Décollage (crème, bleu nuit, bleu électrique, corail). */
export const DEFAULT_BRAND: Brand = {
  name: "Ma marque",
  primary: "#2f5bff",
  secondary: "#0a1433",
  accent: "#ff6b4a",
  surface: "#f6f1e7",
  text: "#0b1330",
  logo: null,
  favicon: null,
};

export const NAME_MAX = 40;
/** Tailles décodées maximales (octets). */
export const LOGO_MAX_BYTES = 200_000;
export const FAVICON_MAX_BYTES = 50_000;
/** Taille maximale du corps JSON accepté par l'API (logo + favicon en base64 inclus). */
export const BODY_MAX_BYTES = 450_000;

/** Réponse de GET /api/brand (et, avec ok, des écritures). */
export type BrandState = {
  entitled: true;
  brand: Brand;
  /** false = aucune marque enregistrée, ce sont les valeurs par défaut. */
  saved: boolean;
  version: number;
  updatedAt: string | null;
  canRestore: boolean;
};
