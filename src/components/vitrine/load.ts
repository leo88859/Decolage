import "server-only";
import { cache } from "react";
import { GET } from "@/app/api/boutique/catalogue/[slug]/route";
import type { CataloguePub } from "./logic";

export type Chargement = { etat: "ok"; data: CataloguePub } | { etat: "absent" } | { etat: "indisponible" };

/** Lit le catalogue public avec la VRAIE route GET /api/boutique/catalogue/{slug} (une seule lecture par requête). */
export const chargerCatalogue = cache(async (slug: string): Promise<Chargement> => {
  try {
    const res = await GET(new Request(`http://localhost/api/boutique/catalogue/${encodeURIComponent(slug)}`), { params: Promise.resolve({ slug }) });
    if (res.status === 404) return { etat: "absent" };
    if (!res.ok) return { etat: "indisponible" };
    const data = (await res.json()) as CataloguePub;
    if (!data?.boutique || !Array.isArray(data.produits)) return { etat: "indisponible" };
    return { etat: "ok", data };
  } catch {
    return { etat: "indisponible" };
  }
});
