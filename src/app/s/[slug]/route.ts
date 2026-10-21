import type { NextRequest } from "next/server";
import { renderLanding } from "@/lib/landing";
import { loadSite, notFoundPage, SITE_HEADERS } from "@/lib/site-server";

/** Landing publique d'un SaaS publié, avec sa vraie liste d'attente. */
export async function GET(req: NextRequest, ctx: RouteContext<"/s/[slug]">) {
  const { slug } = await ctx.params;
  const site = await loadSite(slug);
  if (!site) return notFoundPage();
  const q = req.nextUrl.searchParams;
  const html = renderLanding(site.config, site.landing, site.pricing, {
    inlineCss: true,
    contenu: site.contenu,
    waitlist: { action: `/api/waitlist/${slug}`, merci: q.get("merci") === "1", erreur: q.get("erreur") === "1", appHref: `/s/${slug}/app` },
  });
  // Les messages de confirmation ne doivent pas être mis en cache.
  return new Response(html, { headers: q.size ? { ...SITE_HEADERS, "cache-control": "no-store" } : SITE_HEADERS });
}
