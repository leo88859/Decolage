import type { MetadataRoute } from "next";
import { LEGAL } from "@/data/legal";

/** robots.txt : les pages publiques sont indexables ; l'espace connecté et l'API ne le sont pas. */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ["/api/", "/parametres", "/projets/", "/tableau-de-bord", "/connexion", "/auth/"] }],
    sitemap: `${LEGAL.site}/sitemap.xml`,
  };
}
