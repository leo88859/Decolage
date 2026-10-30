import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, expect, it } from "vitest";
import { archOf } from "@/data/archetypes";
import { TEMPLATES } from "@/data/templates";
import { generateNextProject, generationPlan } from "@/lib/codegen";
import { newProjectFromIdee } from "@/lib/project";
import type { Project, TemplateId } from "@/lib/types";

const projet = (type: TemplateId, nom: string, design: string, idee: string, secteur: string): Project =>
  newProjectFromIdee({ idee, type, secteur, nom, design }, new Date("2026-01-01T09:00:00Z"));

// Applications de référence, compilées et testées pour de vrai (voir GEN_OUT ci-dessous) :
// une par architecture, plus un type sans architecture dédiée.
export const REFERENCES: [string, Project][] = [
  ["taches", projet("taches", "Focus Équipe", "bento", "Organiser les tâches d'une petite équipe", "freelance")],
  ["clients", projet("crm", "Atelier CRM", "papier", "Suivre les clients et les relances d'un artisan", "artisanat")],
  ["revenus", projet("suivi-gains", "CréaCash", "ocean", "Suivre ses revenus de créateur de contenu", "createurs")],
  ["cours", projet("formation", "Guitare Facile", "maison", "Cours de guitare en ligne pour débutants", "general")],
  ["documents", projet("documents", "Cabinet Plume", "terminal", "Rédiger et classer les contrats d'un cabinet", "general")],
  ["boutique", projet("boutique", "Bougies Lune", "brutal", "Vendre des bougies artisanales", "general")],
  ["rdv", projet("rendez-vous", "Salon Zen", "aurora", "Prise de rendez-vous pour un salon", "general")],
  ["annuaire", projet("annuaire", "Artisans Près", "maison", "Un annuaire des artisans de ma ville", "general")],
  ["attente", projet("liste-attente", "Bientôt Lancé", "pastel", "Une liste d'attente pour le lancement de mon appli", "general")],
  ["abonnement", projet("abonnement", "Club Recettes", "neon", "Des recettes exclusives par abonnement", "general")],
];

const config = (p: Project) => {
  const src = generateNextProject(p, new Date(2026, 9, 26, 9)).find((f) => f.name === "lib/config.ts")!.content;
  return JSON.parse(src.slice(src.indexOf("= ") + 2, src.lastIndexOf(";")));
};
const ref = (d: string) => REFERENCES.find(([k]) => k === d)![1];

describe("données réelles et règles métier des projets générés", () => {
  it("chaque colonne a un type et les exemples sont convertis", () => {
    const rdv = config(ref("rdv"));
    expect(rdv.types).toEqual(["text", "datetime", "text", "status"]);
    expect(rdv.exemples.every((r: string[]) => /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(r[1]!))).toBe(true);
    const gains = config(ref("revenus"));
    expect(gains.types[3]).toBe("money");
    expect(gains.exemples.every((r: string[]) => /^-?\d+(\.\d+)?$/.test(r[3]!))).toBe(true);
  });
  it("les réservations ont des horaires et un statut d'annulation", () => {
    expect(config(ref("rdv")).booking).toEqual({ date: 1, annule: ["Annulé"], debut: "09:00", fin: "18:00", duree: 30, jours: [1, 2, 3, 4, 5, 6] });
    const res = config(projet("reservations", "Salles", "aurora", "Réserver les salles", "general"));
    expect(res.booking.ressource).toBe(0);
    expect(res.booking.annule).toEqual(["Refusée"]);
    expect(config(ref("taches")).booking).toBeUndefined();
  });
  it("la liste d'attente a une page d'inscription publique et refuse les doublons d'e-mail", () => {
    const p = ref("attente");
    expect(names(p)).toContain("app/inscription/page.tsx");
    expect(file(p, "app/inscription/page.tsx")).toContain("WaitlistPage");
    // Sans base configurée, la page garde le mode local d'origine.
    expect(file(p, "components/cloud.tsx")).toContain("if (cloudState === \"local\") return <WaitlistView");
    expect(config(p).unique).toBe(0);
    expect(generationPlan(p).skipped).toEqual([]);
  });
  it("les projets sans architecture dédiée ont une page de détail", () => {
    for (const d of ["rdv", "annuaire", "attente", "abonnement"]) expect(names(ref(d))).toContain("app/fiche/page.tsx");
    expect(names(ref("taches"))).not.toContain("app/fiche/page.tsx");
  });
  it("les écrans d'architecture lisent les dates ISO enregistrées", () => {
    expect(file(ref("revenus"), "components/arch-kit.tsx")).toContain(String.raw`t.match(/^(\d{4})-(\d{2})-(\d{2})/)`);
  });
  it("la liste d'attente peut enregistrer ses inscriptions dans Supabase, sans clé secrète", () => {
    const p = ref("attente");
    for (const f of ["supabase/migrations/0001_liste_attente.sql", "lib/cloud.ts", "components/cloud.tsx", "app/proprietaire/page.tsx", ".env.example"]) expect(names(p)).toContain(f);
    expect(file(p, "app/inscription/page.tsx")).toContain('import { WaitlistPage } from "@/components/cloud"');
    expect(JSON.parse(file(p, "package.json")).dependencies["@supabase/supabase-js"]).toBeDefined();
    expect(file(p, ".gitignore")).toContain("!.env.example");
    // Uniquement des valeurs publiques, jamais de clé service_role dans le code.
    const code = file(p, "lib/cloud.ts") + file(p, "components/cloud.tsx");
    expect([...code.matchAll(/process\.env\.(\w+)/g)].map((m) => m[1]).sort()).toEqual(["NEXT_PUBLIC_LISTE_ID", "NEXT_PUBLIC_SUPABASE_ANON_KEY", "NEXT_PUBLIC_SUPABASE_URL"]);
    expect(code).not.toMatch(/service_role|secret/i);
    expect(file(p, ".env.example")).not.toMatch(/=\S/);
    expect(file(p, "README.md")).toContain("## Base de données (Supabase)");
    // Le badge ne prétend pas que tout est local quand la base est branchée (et inversement).
    expect(file(p, "components/Shell.tsx")).toContain('cloudState === "local" ? "● Données enregistrées dans ce navigateur" : "● Inscriptions enregistrées en ligne"');
    // Les autres modèles ne changent pas.
    expect(file(ref("rdv"), "components/Shell.tsx")).not.toContain("cloudState");
    expect(names(ref("rdv"))).not.toContain("lib/cloud.ts");
    expect(JSON.parse(file(ref("rdv"), "package.json")).dependencies["@supabase/supabase-js"]).toBeUndefined();
  });
  it("la migration active la RLS partout et ne donne aucun accès direct aux visiteurs", () => {
    const sql = file(ref("attente"), "supabase/migrations/0001_liste_attente.sql");
    const tables = [...sql.matchAll(/create table if not exists (public\.\w+)/g)].map((m) => m[1]);
    expect(tables).toEqual(["public.listes", "public.inscriptions"]);
    for (const t of tables) expect(sql).toContain(`alter table ${t} enable row level security;`);
    expect(sql).toContain("revoke all on table public.listes, public.inscriptions from anon;");
    expect(sql).not.toMatch(/to anon\b(?!, authenticated;)|using \(true\)|with check \(true\)|drop table|truncate|delete from/i);
    expect(sql).toMatch(/security definer\s+set search_path = ''/);
    expect(sql).toContain("unique (liste_id, email)");
  });
  it("les règles sont incluses et branchées sur le stockage", () => {
    const p = ref("rdv");
    expect(names(p)).toContain("lib/rules.ts");
    expect(file(p, "lib/store.ts")).toContain("validate(v, s.items, SCHEMA)");
  });
});

const names = (p: Project) => generateNextProject(p).map((f) => f.name);
const file = (p: Project, n: string) => generateNextProject(p).find((f) => f.name === n)?.content ?? "";

describe("génération de projets Next.js", () => {
  it("produit une structure complète pour les applications de référence", () => {
    for (const [, p] of REFERENCES) {
      const files = generateNextProject(p);
      const ns = files.map((f) => f.name);
      for (const f of ["package.json", "tsconfig.json", "next.config.mjs", "README.md", "app/layout.tsx", "app/globals.css", "components/views.tsx", "lib/store.ts", "lib/config.ts", "lib/types.ts"]) expect(ns).toContain(f);
      expect(new Set(ns).size).toBe(ns.length);
      // Aucune clé, aucun secret, aucune variable d'environnement inventée.
      // Seule exception : les 3 valeurs publiques de la base de données de la liste d'attente.
      const all = files.map((f) => f.content).join("\n").replace(/(process\.env\.)?NEXT_PUBLIC_(SUPABASE_URL|SUPABASE_ANON_KEY|LISTE_ID)\b/g, "");
      expect(all).not.toMatch(/sk_(live|test)_|SUPABASE_|STRIPE_|process\.env|apiKey/i);
      // La configuration ne doit contenir aucune valeur manquante (le code, lui, peut tester undefined).
      expect(files.find((f) => f.name === "lib/config.ts")!.content).not.toMatch(/undefined|null|NaN/);
      expect(JSON.parse(files.find((f) => f.name === "package.json")!.content).dependencies.next).toBe("16.4.2");
      expect(files.find((f) => f.name === "app/globals.css")!.content).toContain(`--p:${p.config.couleurs.primaire}`);
      expect(files.find((f) => f.name === "lib/config.ts")!.content).toContain(JSON.stringify(p.config.nom));
    }
  });

  it("un SaaS à architecture a un site public et un espace utilisateur séparés", () => {
    for (const [, p] of REFERENCES.filter(([, x]) => archOf(x.config.templateId).id !== "classic")) {
      const ns = names(p);
      for (const f of ["app/(site)/layout.tsx", "app/(site)/page.tsx", "app/(site)/fonctionnalites/page.tsx", "app/app/layout.tsx", "app/app/page.tsx", "components/site.tsx", "components/frame.tsx", "components/screens.tsx"]) expect(ns).toContain(f);
      expect(ns).not.toContain("components/Shell.tsx");
      expect(ns).not.toContain("app/page.tsx");
      const cfg = file(p, "lib/config.ts");
      expect(cfg).toContain(`"frame": ${JSON.stringify(archOf(p.config.templateId).frame)}`);
    }
    // Sans architecture dédiée : la coquille classique.
    const rdv = REFERENCES.find(([d]) => d === "rdv")![1];
    expect(names(rdv)).toContain("components/Shell.tsx");
    expect(names(rdv)).not.toContain("components/screens.tsx");
  });

  it("les architectures produisent des écrans réellement différents", () => {
    const screensOf = (p: Project) => generationPlan(p).gen.filter((g) => g.zone === "app").map((g) => g.kind).filter((k) => k !== "settings").sort().join(",");
    const arch = REFERENCES.filter(([, x]) => archOf(x.config.templateId).id !== "classic");
    const sets = arch.map(([, p]) => screensOf(p));
    expect(new Set(sets).size).toBe(arch.length);
    // Et aucun écran (hors paramètres) n'est partagé entre deux familles, sauf le kanban.
    const frames = arch.map(([, p]) => file(p, "lib/config.ts").match(/"frame": "(\w+)"/)![1]);
    expect(new Set(frames).size).toBe(arch.length);
  });

  it("l'accueil suit la composition du design choisi", () => {
    const home = (design: string) => file(projet("taches", "Test", design, "test", "general"), "lib/config.ts").match(/"home": "(\w+)"/)![1];
    expect(new Set(["aurora", "papier", "bento", "brutal", "terminal", "ocean"].map(home)).size).toBe(6);
  });

  it("les pages publiques suivent le modèle de revenus et les comptes", () => {
    const p = REFERENCES[0]![1];
    const gratuit = { ...p, config: { ...p.config, revenu: "gratuit" as const, modules: p.config.modules.filter((m) => m !== "auth" && m !== "abonnement" && m !== "facturation") } };
    expect(names(gratuit)).not.toContain("app/(site)/tarifs/page.tsx");
    expect(names(gratuit)).not.toContain("app/(site)/connexion/page.tsx");
    const payant = { ...p, config: { ...p.config, revenu: "abonnement" as const, modules: [...new Set([...p.config.modules, "auth" as const])] } };
    expect(names(payant)).toContain("app/(site)/tarifs/page.tsx");
    expect(names(payant)).toContain("app/(site)/inscription/page.tsx");
  });

  it("chaque type de SaaS produit des pages valides et une page de données", () => {
    for (const t of TEMPLATES) {
      const p = projet(t.id, "Test", "aurora", "test", "general");
      const { gen } = generationPlan(p);
      expect(gen.some((g) => g.kind === "settings")).toBe(true);
      for (const g of gen) expect(g.href).toMatch(/^\/[a-z0-9/-]*$/);
      expect(new Set(gen.map((g) => g.href)).size).toBe(gen.length);
      expect(() => generateNextProject(p)).not.toThrow();
    }
  });

  it("reprend les données et les notes saisies dans Décollage", () => {
    const p = { ...REFERENCES[1]![1], appData: { v: 1 as const, rows: [{ id: 7, v: ["Mon client", "Ma société", "Gagné", "—"] }], notes: { "7": "Rappeler mardi" } } };
    const cfg = file(p, "lib/config.ts");
    expect(cfg).toContain("Mon client");
    expect(cfg).toContain('"ex1": "Rappeler mardi"');
  });

  // Écrit les projets sur le disque pour les installer et les compiler (GEN_OUT=dossier npx vitest run …).
  it.runIf(!!process.env.GEN_OUT)("écrit les projets de référence", () => {
    for (const [dir, p] of REFERENCES) {
      const root = join(process.env.GEN_OUT!, dir);
      for (const sub of ["app", "components", "lib"]) rmSync(join(root, sub), { recursive: true, force: true });
      for (const f of generateNextProject(p)) {
        mkdirSync(dirname(join(root, f.name)), { recursive: true });
        writeFileSync(join(root, f.name), f.content, "utf8");
      }
    }
  });
});
