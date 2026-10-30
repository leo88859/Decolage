// Couleurs d'accent utilisées comme TEXTE ou comme fond de texte blanc (univers des idées, parcours « Apprendre »).
// Toutes sont assez foncées pour tenir 4,5:1 avec du blanc, donc aussi sur fond crème ou papier.
// Partagé entre l'interface et le test de contraste (src/lib/a11y/contrast.test.ts).

/** Une couleur par univers d'idées (12 teintes, réutilisées en boucle). */
export const CAT_COLORS = [
  "#2f5bff", // bleu électrique (marque)
  "#bd3a19", // corail foncé (marque, version texte)
  "#0a1433", // bleu nuit
  "#0b7a5a", // vert
  "#6d28d9", // violet
  "#9a3412", // brique
  "#1f45e0", // bleu foncé
  "#8f5508", // ocre
  "#be185d", // rose
  "#0e7490", // cyan foncé
  "#3f6212", // olive
  "#6b21a8", // pourpre
] as const;

/** Couleurs des quatre parcours « Apprendre ». */
export const PARCOURS_COLORS = {
  valider: "#2f5bff",
  mvp: "#bd3a19",
  prix: "#0b7a5a",
  lancer: "#6d28d9",
} as const;
