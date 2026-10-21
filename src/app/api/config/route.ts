import { isCloudConfigured, isPaymentConfigured } from "@/lib/env";

/** Fonctions en ligne disponibles sur ce déploiement (aucune donnée sensible). */
export async function GET() {
  return Response.json({ cloud: isCloudConfigured(), payments: isPaymentConfigured() }, { headers: { "cache-control": "no-store" } });
}
