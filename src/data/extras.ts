import type { ExtraKind, PageDef } from "@/lib/types";

/** Pages qu'une idée peut ajouter à n'importe quel modèle. */
export const EXTRA_PAGES: Record<ExtraKind, PageDef> = {
  carte: { id: "x-carte", titre: "Carte", kind: "carte", nav: true },
  conversation: { id: "x-messages", titre: "Messages", kind: "conversation", nav: true },
  mois: { id: "x-calendrier", titre: "Calendrier", kind: "mois", nav: true },
  kanban: { id: "x-suivi", titre: "Suivi", kind: "kanban", nav: true },
  relances: { id: "x-relances", titre: "Relances", kind: "relances", nav: true },
};

export const isExtraKind = (x: unknown): x is ExtraKind => typeof x === "string" && Object.hasOwn(EXTRA_PAGES, x);
