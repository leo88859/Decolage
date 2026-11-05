import type { MetadataRoute } from "next";
import { LEGAL, LEGAL_PAGES } from "@/data/legal";

/** Pages publiques du site (sans les sites publiés par les utilisateurs ni l'espace connecté). */
export const PUBLIC_PATHS = ["/", "/creer", "/idees", "/modeles", "/guide", ...LEGAL_PAGES.map((l) => l.href)];

export default function sitemap(): MetadataRoute.Sitemap {
  return PUBLIC_PATHS.map((p) => ({ url: p === "/" ? LEGAL.site : `${LEGAL.site}${p}` }));
}
