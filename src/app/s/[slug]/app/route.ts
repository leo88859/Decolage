import type { NextRequest } from "next/server";
import { renderPrototype } from "@/lib/prototype";
import { applyBrandToConfig, renameInTexts } from "@/lib/brand/site-brand";
import { loadSite, loadSiteBrand, notFoundPage, SITE_HEADERS } from "@/lib/site-server";

/** Démo interactive publique de l'application (données d'exemple, rien n'est enregistré). */
export async function GET(_req: NextRequest, ctx: RouteContext<"/s/[slug]/app">) {
  const { slug } = await ctx.params;
  const site = await loadSite(slug);
  if (!site) return notFoundPage();
  const marque = await loadSiteBrand(slug);
  return new Response(renderPrototype(applyBrandToConfig(site.config, marque), "accueil", marque ? renameInTexts(site.contenu, site.config.nom, marque.name) : site.contenu, { persist: true, storeKey: `site:${slug}`, marque }), { headers: SITE_HEADERS });
}
