import "server-only";
import { isCloudConfigured } from "@/lib/env";
import { validateSiteData, type SiteData } from "@/lib/publish";
import { createPublicClient } from "@/lib/supabase/server";

/** Données validées d'un site publié, ou null. */
export async function loadSite(slug: string): Promise<SiteData | null> {
  if (!isCloudConfigured() || !/^[a-z0-9-]{3,40}$/.test(slug)) return null;
  const { data } = await createPublicClient().from("sites").select("data").eq("slug", slug).maybeSingle();
  if (!data) return null;
  const v = validateSiteData(data.data);
  return v.ok ? v.data : null;
}

/** En-têtes des pages publiées : uniquement nos scripts en ligne, aucune ressource externe sauf images et polices. */
export const SITE_HEADERS = {
  "content-type": "text/html; charset=utf-8",
  "content-security-policy":
    "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; img-src data: https:; form-action 'self'; base-uri 'none'; frame-ancestors 'self'",
  "x-content-type-options": "nosniff",
  "referrer-policy": "strict-origin-when-cross-origin",
  "cache-control": "public, max-age=0, s-maxage=60",
};

export const notFoundPage = () =>
  new Response(
    `<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Site introuvable</title></head><body style="font-family:system-ui;display:grid;place-items:center;min-height:90vh;color:#0f172a;text-align:center"><div><h1>Ce site n'existe pas (ou plus)</h1><p>Il a peut-être été dépublié par son créateur.</p></div></body></html>`,
    { status: 404, headers: SITE_HEADERS },
  );
