import { DESIGN_BY_ID, DESIGNS } from "@/data/designs";
import { defaultConfig, initialsOf } from "@/lib/config";
import { buildContenu, cibleEtDescription } from "@/lib/remplissage";
import { buildLanding } from "@/lib/landing";
import { applyFonctions } from "@/lib/fonctions";
import { activePages } from "@/lib/modules";
import { launchActionsFor, roadmapFor } from "@/lib/plan-builder";
import { defaultPricing } from "@/lib/pricing";
import { buildReport } from "@/lib/validation";
import type { Idea, Project, TemplateId } from "@/lib/types";

export const newId = () => Math.random().toString(36).slice(2, 10);

export function newProject(templateId: TemplateId, idea?: Idea, now = new Date()): Project {
  const config = defaultConfig(templateId, idea);
  const iso = now.toISOString();
  return {
    id: newId(),
    createdAt: iso,
    updatedAt: iso,
    ideaId: idea?.id ?? null,
    config,
    landing: buildLanding(config),
    validation: idea ? { probleme: idea.probleme, qui: idea.cible } : {},
    roadmap: {},
    pricing: defaultPricing(config),
    launch: { date: "", items: {} },
    metrics: [],
    activity: [{ date: iso, label: "Projet créé" }],
  };
}

/** Nouveau projet rempli à partir d'une idée libre, avec le design choisi. */
export function newProjectFromIdee(input: { idee: string; type: TemplateId; secteur: string; nom: string; design: string; fonctions?: string[] }, now = new Date()): Project {
  const d = DESIGN_BY_ID[input.design] ?? DESIGNS[0]!;
  const nom = input.nom.trim().slice(0, 40) || "Mon SaaS";
  const contenu = buildContenu(input.idee, input.type, input.secteur);
  const { cible, description } = cibleEtDescription(input.type, input.secteur, nom);
  // Chaque design a son propre tableau de bord : la brique est ajoutée si le modèle n'en a pas
  // (refusée pour une liste d'attente, qui fonctionne sans compte). Puis les fonctions demandées dans l'idée.
  const def = defaultConfig(input.type);
  const wanted = [...(activePages(def).some((p) => p.kind === "dashboard") ? [] : ["dashboard"]), ...(input.fonctions ?? [])];
  const base = applyFonctions(def, wanted).config;
  const config = { ...base, nom, initiales: initialsOf(nom), description, cible, style: d.style, couleurs: { ...d.couleurs }, police: d.police, design: d.id };
  const iso = now.toISOString();
  return {
    id: newId(),
    createdAt: iso,
    updatedAt: iso,
    ideaId: null,
    config,
    landing: { ...buildLanding(config, contenu), layout: d.layout },
    validation: { probleme: input.idee.slice(0, 600) },
    roadmap: {},
    pricing: defaultPricing(config),
    launch: { date: "", items: {} },
    metrics: [],
    activity: [{ date: iso, label: "Projet créé à partir de ton idée" }],
    contenu,
  };
}

/** Contenu rempli à partir de l'idée, seulement s'il correspond encore au modèle du projet. */
export const contenuOf = (p: Pick<Project, "config" | "contenu">) => (p.contenu && p.contenu.type === p.config.templateId ? p.contenu : undefined);

export function duplicateProject(p: Project, now = new Date()): Project {
  const iso = now.toISOString();
  const copy = structuredClone(p);
  return { ...copy, id: newId(), createdAt: iso, updatedAt: iso, config: { ...copy.config, nom: `${p.config.nom} (copie)`.slice(0, 40) }, activity: [{ date: iso, label: `Dupliqué depuis « ${p.config.nom} »` }] };
}

/** Avancement réel, calculé à partir des données du projet. */
export function projectProgress(p: Project, detaille: boolean) {
  const tasks = roadmapFor(p.config, detaille).flatMap((s) => s.tasks);
  const done = tasks.filter((t) => p.roadmap[t.id]?.status === "termine").length;
  const actions = launchActionsFor(p.config);
  const launched = actions.filter((a) => p.launch.items[a.id]?.status === "termine").length;
  const next = tasks.find((t) => p.roadmap[t.id]?.status !== "termine");
  const etapes = [
    { id: "valider", label: "Validation", done: buildReport(p.validation).complet },
    { id: "construire", label: "Constructeur", done: p.activity.some((a) => a.label.startsWith("Constructeur")) },
    { id: "landing", label: "Landing", done: p.landing.edited || p.activity.some((a) => a.label.startsWith("Landing")) },
    { id: "feuille", label: "Feuille de route", done: tasks.length > 0 && done === tasks.length },
    { id: "lancement", label: "Lancement", done: actions.length > 0 && launched === actions.length },
  ];
  return {
    tasks: tasks.length,
    done,
    pct: tasks.length ? Math.round((done / tasks.length) * 100) : 0,
    next: next ?? null,
    pages: activePages(p.config).length,
    etape: etapes.find((e) => !e.done)?.label ?? "Lancé",
    etapes,
  };
}
