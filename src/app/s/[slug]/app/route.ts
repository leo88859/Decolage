import type { NextRequest } from "next/server";
import { renderPrototype } from "@/lib/prototype";
import { loadSite, notFoundPage, SITE_HEADERS } from "@/lib/site-server";

/** Démo interactive publique de l'application (données d'exemple, rien n'est enregistré). */
export async function GET(_req: NextRequest, ctx: RouteContext<"/s/[slug]/app">) {
  const { slug } = await ctx.params;
  const site = await loadSite(slug);
  if (!site) return notFoundPage();
  return new Response(renderPrototype(site.config, "accueil", site.contenu, { persist: true, storeKey: `site:${slug}` }), { headers: SITE_HEADERS });
}
