// Plan de génération : liste des pages produites par le générateur Next.js. Module SANS code payant :
// il peut être importé par l'interface (aperçu « Pages générées »). Le générateur lui-même (index.ts) est réservé au serveur.
import { archOf, ARCHETYPES } from "@/data/archetypes";
import { activePages } from "@/lib/modules";
import type { ArchPageKind, PageKind, Project } from "@/lib/types";

/** Écrans d'architecture (rendus par components/screens.tsx). */
export const ARCH_VIEWS = new Set<string>(Object.values(ARCHETYPES).flatMap((a) => a.screens.map((s) => s.view)));

export type GenKind = "accueil" | "dashboard" | "table" | "cards" | "grid" | "kanban" | "agenda" | "form" | "todo" | "goals" | "settings" | "pricing" | "login" | "activity" | "waitlist";

/** Pages du prototype et leur équivalent dans le projet généré. Les autres ne sont pas générées. */
export const KIND_MAP: Partial<Record<PageKind, GenKind>> = {
  accueil: "accueil", dashboard: "dashboard", graphique: "dashboard", resultats: "dashboard",
  tableau: "table", liste: "cards", grille: "grid", kanban: "kanban", calendrier: "agenda", mois: "agenda",
  formulaire: "form", relances: "todo", objectifs: "goals", parametres: "settings", profil: "settings",
  tarifs: "pricing", facturation: "pricing", connexion: "login", historique: "activity", notifications: "activity", waitlist: "waitlist",
};

export const routeId = (id: string) => id.toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-+|-+$/g, "") || "page";

export type GenPage = { id: string; titre: string; kind: GenKind | ArchPageKind; href: string; nav: boolean; zone?: "site" | "app" };

/** Ce que le générateur produit, et ce qu'il laisse de côté (affiché dans Décollage et le README). */
export function generationPlan(p: Project): { gen: GenPage[]; skipped: string[] } {
  const pages = activePages(p.config);
  const gen: GenPage[] = [];
  const skipped: string[] = [];
  // Architecture dédiée : site public à la racine, espace utilisateur sous /app.
  if (archOf(p.config.templateId).id !== "classic") {
    for (const pg of pages) {
      const k = String(pg.kind);
      if (k.startsWith("site-")) gen.push({ id: pg.id, titre: pg.titre, kind: pg.kind as ArchPageKind, href: pg.id === "accueil" ? "/" : `/${routeId(pg.id)}`, nav: true, zone: "site" });
      else if (ARCH_VIEWS.has(k)) gen.push({ id: pg.id, titre: pg.titre, kind: pg.kind as ArchPageKind, href: pg.id === "app" ? "/app" : `/app/${routeId(pg.id)}`, nav: true, zone: "app" });
      else {
        const kind = KIND_MAP[pg.kind as PageKind];
        if (kind) gen.push({ id: routeId(pg.id), titre: pg.titre, kind, href: `/app/${routeId(pg.id)}`, nav: true, zone: "app" });
        else if (pg.kind !== "detail") skipped.push(pg.titre);
      }
    }
    return { gen, skipped };
  }
  const used = new Set<string>();
  for (const pg of pages) {
    const kind = KIND_MAP[pg.kind as PageKind];
    if (!kind) { if (pg.kind !== "detail") skipped.push(pg.titre); continue; }
    let id = kind === "accueil" ? "" : routeId(pg.id);
    while (id && used.has(id)) id += "-2";
    used.add(id);
    gen.push({ id: id || "accueil", titre: pg.titre, kind, href: id ? `/${id}` : "/", nav: pg.nav || kind === "settings" });
  }
  // Une page « Paramètres » est toujours présente : c'est là que se trouvent l'import et l'export CSV.
  if (!gen.some((g) => g.kind === "settings")) gen.push({ id: "donnees", titre: "Données", kind: "settings", href: "/donnees", nav: true });
  return { gen, skipped };
}
