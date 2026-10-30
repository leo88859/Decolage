// Contraste WCAG 2.x (SC 1.4.3, 1.4.6, 1.4.11). Sans dépendance, utilisable dans les tests et en script.

export type RGB = { r: number; g: number; b: number };
export type RGBA = RGB & { a: number };

/** Lit #rgb, #rrggbb, #rrggbbaa, rgb(...) et rgba(...). Lève une erreur sur toute autre syntaxe. */
export function parseColor(input: string): RGBA {
  const s = input.trim().toLowerCase();
  if (s === "transparent") return { r: 0, g: 0, b: 0, a: 0 };
  if (s === "white") return { r: 255, g: 255, b: 255, a: 1 };
  if (s === "black") return { r: 0, g: 0, b: 0, a: 1 };
  if (s.startsWith("#")) {
    let h = s.slice(1);
    if (h.length === 3 || h.length === 4) h = [...h].map((c) => c + c).join("");
    if (h.length !== 6 && h.length !== 8) throw new Error(`Couleur illisible : ${input}`);
    const n = (i: number) => parseInt(h.slice(i, i + 2), 16);
    return { r: n(0), g: n(2), b: n(4), a: h.length === 8 ? n(6) / 255 : 1 };
  }
  const m = s.match(/^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)(?:\s*[,/]\s*([\d.]+)(%?))?\s*\)$/);
  if (m) {
    const a = m[4] === undefined ? 1 : m[5] ? Number(m[4]) / 100 : Number(m[4]);
    return { r: Number(m[1]), g: Number(m[2]), b: Number(m[3]), a };
  }
  throw new Error(`Couleur illisible : ${input}`);
}

/** Pose `top` (avec son alpha) sur `bottom` opaque. */
export function over(top: RGBA, bottom: RGB): RGB {
  const a = top.a;
  return { r: top.r * a + bottom.r * (1 - a), g: top.g * a + bottom.g * (1 - a), b: top.b * a + bottom.b * (1 - a) };
}

/** Empile des calques du plus bas au plus haut. Le premier doit être opaque. */
export function flatten(layers: string[]): RGB {
  let acc: RGB | null = null;
  for (const l of layers) {
    const c = parseColor(l);
    if (!acc) {
      if (c.a < 1) throw new Error(`Le calque du fond doit être opaque : ${l}`);
      acc = { r: c.r, g: c.g, b: c.b };
    } else acc = over(c, acc);
  }
  if (!acc) throw new Error("Aucun calque");
  return acc;
}

const lin = (v: number) => {
  const c = v / 255;
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
};

/** Luminance relative (WCAG 2.x). */
export function luminance({ r, g, b }: RGB): number {
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

/** Rapport de contraste entre deux couleurs opaques, de 1 à 21. */
export function contrastRatio(a: RGB, b: RGB): number {
  const la = luminance(a);
  const lb = luminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

/**
 * Rapport entre un avant-plan (éventuellement translucide) et un fond (un ou plusieurs calques).
 * Un avant-plan translucide est d'abord posé sur le fond aplati.
 */
export function ratioOf(fg: string, bg: string | string[]): number {
  const base = flatten(Array.isArray(bg) ? bg : [bg]);
  const top = over(parseColor(fg), base);
  return contrastRatio(top, base);
}

export const THRESHOLD = { text: 4.5, large: 3, ui: 3 } as const;
