import { buildAccountExport, PAGE_MAX, type ExportClient, type ExportUser } from "@/lib/account-export";
import { isCloudConfigured } from "@/lib/env";
import { getUser } from "@/lib/supabase/server";

/**
 * Export RGPD : les données du compte connecté, en JSON, uniquement les siennes.
 * Gros comptes : chaque section est plafonnée par page ; « ?page=2 » (3, 4…) télécharge la suite.
 */
export async function GET(req?: Request) {
  const headers = { "cache-control": "no-store" };
  if (!isCloudConfigured()) return Response.json({ error: "Non disponible." }, { status: 503, headers });
  const { supabase, user } = await getUser();
  if (!user) return Response.json({ error: "Connecte-toi." }, { status: 401, headers });

  let page = 1;
  const raw = req ? new URL(req.url).searchParams.get("page") : null;
  if (raw !== null) {
    page = /^\d{1,3}$/.test(raw) ? Number(raw) : 0;
    if (page < 1 || page > PAGE_MAX) return Response.json({ error: `Le numéro de page doit être un entier de 1 à ${PAGE_MAX}.` }, { status: 400, headers });
  }

  const data = await buildAccountExport(supabase as unknown as ExportClient, user as ExportUser, { page });
  const day = new Date().toISOString().slice(0, 10);
  const suffix = page > 1 ? `-page-${page}` : "";
  return new Response(JSON.stringify(data, null, 2), {
    headers: { ...headers, "content-type": "application/json; charset=utf-8", "content-disposition": `attachment; filename="decollage-mes-donnees-${day}${suffix}.json"` },
  });
}
