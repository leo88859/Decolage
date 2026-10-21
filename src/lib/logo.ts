import type { Config } from "@/lib/types";

// Générateur de logo : initiales + couleurs + forme, en SVG (aucune ressource externe).

export const LOGO_FORMES = {
  cercle: "Cercle",
  carre: "Carré arrondi",
  hexagone: "Hexagone",
  goutte: "Goutte",
  badge: "Badge",
} as const;
export type LogoForme = keyof typeof LOGO_FORMES;

const HEX = /^#[0-9a-f]{6}$/i;

export function logoSvg(initiales: string, primaire: string, accent: string, forme: LogoForme): string {
  const p = HEX.test(primaire) ? primaire : "#2f5bff";
  const a = HEX.test(accent) ? accent : "#ff6b4a";
  const txt = (initiales || "?").replace(/[^\p{L}\p{N}]/gu, "").slice(0, 3).toUpperCase() || "?";
  const size = txt.length >= 3 ? 30 : txt.length === 2 ? 38 : 48;
  const shapes: Record<LogoForme, string> = {
    cercle: `<circle cx="64" cy="64" r="60" fill="url(#g)"/>`,
    carre: `<rect x="4" y="4" width="120" height="120" rx="30" fill="url(#g)"/>`,
    hexagone: `<path d="M64 4l52 30v60l-52 30-52-30V34z" fill="url(#g)"/>`,
    goutte: `<path d="M64 4C64 4 124 4 124 64s-27 60-60 60S4 97 4 64 30 4 64 4z" fill="url(#g)"/>`,
    badge: `<rect x="4" y="4" width="120" height="120" rx="30" fill="${p}"/><circle cx="104" cy="104" r="26" fill="${a}"/>`,
  };
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${p}"/><stop offset="1" stop-color="${a}"/></linearGradient></defs>${shapes[forme]}<text x="64" y="${64 + size * 0.36}" text-anchor="middle" font-family="system-ui,Segoe UI,sans-serif" font-weight="800" font-size="${size}" fill="#fff">${txt}</text></svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

export const logoFor = (cfg: Config, forme: LogoForme) => logoSvg(cfg.initiales, cfg.couleurs.primaire, cfg.couleurs.accent, forme);
