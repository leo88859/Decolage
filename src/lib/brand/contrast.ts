// Avertissements de contraste pour une marque (réutilise le calcul WCAG du projet).
import { ratioOf, THRESHOLD } from "@/lib/a11y/contrast";
import type { BrandColors } from "./types";

const WHITE = "#ffffff";

export type BrandPair = { id: string; label: string; ratio: number; ok: boolean };

const r2 = (n: number) => Math.round(n * 100) / 100;

/** Couleur de texte lisible (blanc ou texte de la marque) à poser sur la couleur principale. */
export function onPrimary(c: BrandColors): string {
  return ratioOf(WHITE, c.primary) >= ratioOf(c.text, c.primary) ? WHITE : c.text;
}

/**
 * Paires évaluées (seuil 4,5:1 pour du texte normal) :
 *  - texte clair (blanc) sur la couleur principale ;
 *  - texte sombre (couleur du texte) sur la couleur principale ;
 *  - texte sur fond.
 * La couleur principale est « lisible » si AU MOINS un des deux textes passe.
 */
export function brandContrast(c: BrandColors): { pairs: BrandPair[]; warnings: string[] } {
  const light = ratioOf(WHITE, c.primary);
  const dark = ratioOf(c.text, c.primary);
  const body = ratioOf(c.text, c.surface);
  const t = THRESHOLD.text;
  const pairs: BrandPair[] = [
    { id: "primary-light", label: "Texte blanc sur la couleur principale", ratio: r2(light), ok: light >= t },
    { id: "primary-dark", label: "Texte de la marque sur la couleur principale", ratio: r2(dark), ok: dark >= t },
    { id: "text-surface", label: "Texte sur le fond", ratio: r2(body), ok: body >= t },
  ];
  const warnings: string[] = [];
  if (light < t && dark < t) {
    warnings.push(`Ta couleur principale n'atteint 4,5:1 ni avec du texte blanc (${r2(light)}:1) ni avec ta couleur de texte (${r2(dark)}:1) : les boutons seront difficiles à lire. Assombris ou éclaircis-la.`);
  }
  if (body < t) warnings.push(`Le texte sur le fond n'atteint que ${r2(body)}:1 (4,5:1 recommandé) : change la couleur du texte ou du fond.`);
  return { pairs, warnings };
}
