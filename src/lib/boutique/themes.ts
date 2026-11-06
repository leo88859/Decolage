// Les thèmes des boutiques publiées (/b/<adresse>). Mêmes noms et même ambiance que les designs de boutique de la
// galerie. Le thème change la mise en page (cartes, titres, boutons, fonds) ; les deux couleurs choisies par le
// commerçant s'y appliquent toujours. Les styles sont dans components/vitrine/vitrine.css ([data-theme=…]).

export const THEMES = [
  { id: "classique", nom: "Classique", description: "Le style d'origine : bandeau à ta couleur, cartes simples.", fond: "#ffffff", encre: "#1a1a1f" },
  { id: "vitrine", nom: "Vitrine", description: "Blanc, grandes photos arrondies, boutons ronds. Moderne et polyvalent.", fond: "#ffffff", encre: "#111827" },
  { id: "atelier", nom: "Atelier", description: "Crème et titres à empattements. Pour le fait main et l'artisanat.", fond: "#f6efe4", encre: "#3b2414" },
  { id: "marche", nom: "Marché", description: "Vert frais, étiquettes arrondies, cartes gourmandes. Pour l'alimentaire.", fond: "#f7fbf3", encre: "#14321d" },
  { id: "ecrin", nom: "Écrin", description: "Noir et or, beaucoup d'espace. Pour les bijoux, la beauté, le luxe.", fond: "#0c0b09", encre: "#f3ece0" },
  { id: "street", nom: "Street", description: "Contours noirs, ombres pleines, titres massifs. Pour la mode.", fond: "#f4f4f0", encre: "#111111" },
] as const;

export type ThemeId = (typeof THEMES)[number]["id"];
export const THEME_IDS = THEMES.map((t) => t.id) as readonly ThemeId[];
export const THEME_DEFAUT: ThemeId = "classique";

/** Un thème connu, sinon le thème par défaut (valeur absente, ancienne ou modifiée à la main). */
export const themeOf = (v: unknown): ThemeId => ((THEME_IDS as readonly unknown[]).includes(v) ? (v as ThemeId) : THEME_DEFAUT);

/**
 * La colonne « theme » n'existe pas encore en base (migration 0009 pas exécutée) : PostgREST répond PGRST204
 * (colonne inconnue du cache de schéma) ou Postgres 42703 (colonne inexistante). On repasse alors sans le thème.
 */
export const colonneThemeAbsente = (e: { code?: string; message?: string } | null | undefined) =>
  !!e && (e.code === "PGRST204" || e.code === "42703") && /theme/i.test(e.message ?? "");
