import { buildAccountExport, type ExportClient } from "@/lib/account-export";
import { isCloudConfigured } from "@/lib/env";
import { getUser } from "@/lib/supabase/server";

/** Export RGPD : toutes les données du compte connecté, en JSON, uniquement les siennes. */
export async function GET() {
  const headers = { "cache-control": "no-store" };
  if (!isCloudConfigured()) return Response.json({ error: "Non disponible." }, { status: 503, headers });
  const { supabase, user } = await getUser();
  if (!user) return Response.json({ error: "Connecte-toi." }, { status: 401, headers });
  const data = await buildAccountExport(supabase as unknown as ExportClient, user);
  const day = new Date().toISOString().slice(0, 10);
  return new Response(JSON.stringify(data, null, 2), {
    headers: { ...headers, "content-type": "application/json; charset=utf-8", "content-disposition": `attachment; filename="decollage-mes-donnees-${day}.json"` },
  });
}
