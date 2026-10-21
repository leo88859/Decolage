import { describe, expect, it } from "vitest";
import { IDEA_BY_ID } from "@/data/ideas";
import { defaultConfig, validateConfig } from "@/lib/config";
import { parseImport, projectFiles, projectJson, dataJson, slug } from "@/lib/export";
import { buildLanding, fill, moveSection, renderLanding, syncLanding } from "@/lib/landing";
import { activePages, disableModule, enableModule, setRevenue } from "@/lib/modules";
import { launchActionsFor, roadmapFor } from "@/lib/plan-builder";
import { averagePaid, breakEven, scenario } from "@/lib/pricing";
import { duplicateProject, newProject, projectProgress } from "@/lib/project";
import { prototypeData, renderPrototype } from "@/lib/prototype";
import { TEMPLATES } from "@/data/templates";
import { buildReport, QUESTIONS } from "@/lib/validation";
import { crc32, zip } from "@/lib/zip";

describe("activation des briques", () => {
  it("ajoute automatiquement les dépendances", () => {
    const cfg = defaultConfig("taches");
    const r = enableModule({ ...cfg, modules: ["donnees"] }, "facturation");
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.config.modules).toEqual(expect.arrayContaining(["auth", "profil", "abonnement", "facturation"]));
      expect(r.ajoutes).toEqual(expect.arrayContaining(["auth", "profil", "abonnement"]));
    }
  });

  it("refuse une brique en conflit et explique pourquoi", () => {
    const cfg = defaultConfig("liste-attente"); // accès sans compte actif
    const r = enableModule(cfg, "favoris"); // nécessite l'authentification
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.raison).toMatch(/Authentification.*incompatible.*Accès sans compte/);
  });

  it("refuse une brique incompatible avec le modèle de revenus", () => {
    const cfg = { ...defaultConfig("taches"), revenu: "gratuit" as const, prix: 0 };
    const r = enableModule(cfg, "abonnement");
    expect(r.ok).toBe(false);
  });

  it("empêche de retirer une brique utilisée par une autre ou requise par le modèle", () => {
    const cfg = defaultConfig("abonnement");
    expect(disableModule(cfg, "auth").ok).toBe(false);
    const r = disableModule(cfg, "profil");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.raison).toMatch(/Abonnement/);
  });

  it("met à jour les pages et la navigation", () => {
    const cfg = defaultConfig("taches");
    const before = activePages(cfg).map((p) => p.id);
    const r = enableModule(cfg, "admin");
    expect(r.ok).toBe(true);
    if (r.ok) {
      const after = activePages(r.config);
      expect(before).not.toContain("admin");
      expect(after.find((p) => p.id === "admin")?.nav).toBe(true);
    }
    expect(activePages({ ...cfg, pages: { aujourdhui: false } }).map((p) => p.id)).not.toContain("aujourdhui");
  });

  it("bloque un changement de revenus incompatible", () => {
    expect(setRevenue(defaultConfig("abonnement"), "gratuit").ok).toBe(false);
    const ok = setRevenue(defaultConfig("taches"), "gratuit");
    expect(ok.ok && ok.config.prix).toBe(0);
  });
});

describe("validation de configuration", () => {
  it("signale les champs invalides", () => {
    const e = validateConfig({ ...defaultConfig("crm"), nom: "", couleurs: { primaire: "bleu", accent: "#000000" }, domaine: "pas un domaine", roles: [] });
    expect(Object.keys(e)).toEqual(expect.arrayContaining(["nom", "couleurs", "domaine", "roles"]));
  });
  it("accepte un domaine correct", () => {
    expect(validateConfig({ ...defaultConfig("crm"), domaine: "mon-crm.fr" }).domaine).toBeUndefined();
  });
});

describe("rapport de validation", () => {
  const full = { probleme: "x", qui: "y", actuel: "bricolage", frequence: "hebdo", enjeu: "argent", payer: "moyen", entretiens: "10+", concurrents: "quelques", acces: "communaute" };

  it("est déterministe et complet", () => {
    const a = buildReport(full);
    expect(a).toEqual(buildReport(full));
    expect(a.complet).toBe(true);
    expect(a.repondu).toBe(QUESTIONS.length);
    expect(a.solidite).toBeGreaterThan(80);
    expect(a.recommandation.action).toBe("constructeur");
  });

  it("recommande des entretiens quand personne n'a été interrogé", () => {
    expect(buildReport({ ...full, entretiens: "0" }).recommandation.action).toBe("entretiens");
  });

  it("signale l'absence de modèle économique", () => {
    const r = buildReport({ ...full, payer: "0" });
    expect(r.recommandation.action).toBe("modele");
    expect(r.risques.join(" ")).toMatch(/modèle économique/);
  });

  it("reste dans l'intervalle 0–100 pour un questionnaire vide", () => {
    const r = buildReport({});
    expect(r.complet).toBe(false);
    expect(r.solidite).toBe(0);
  });

  it("ne recommande rien de définitif tant que le questionnaire est incomplet", () => {
    const r = buildReport({ probleme: "x", qui: "y" });
    expect(r.recommandation.action).toBe("completer");
    expect(r.recommandation.texte).toContain("7 questions");
  });
});

describe("calculateur de prix", () => {
  const calc = { clients: 0, fraisPct: 2, fraisFixe: 0.25, hebergement: 20, autres: 10 };

  it("calcule chiffre d'affaires, frais et résultat", () => {
    const s = scenario(100, 10, calc);
    expect(s.brut).toBe(1000);
    expect(s.fraisPaiement).toBe(45);
    expect(s.fraisFixes).toBe(30);
    expect(s.resultat).toBe(925);
  });

  it("calcule le seuil de rentabilité", () => {
    expect(breakEven(10, calc)).toBe(4); // 30 € / 9,55 € par client
    expect(breakEven(0, calc)).toBeNull();
  });

  it("ramène les offres au mois", () => {
    expect(averagePaid([{ id: "a", nom: "A", prix: 0, periode: "mois", features: [] }, { id: "b", nom: "B", prix: 120, periode: "an", features: [] }])).toBe(10);
  });
});

describe("landing", () => {
  it("remplit les variables et corrige les contractions", () => {
    const cfg = { ...defaultConfig("rendez-vous"), nom: "Créno", cible: "Coiffeurs indépendants" };
    expect(fill("{nom} permet à {cible} de réserver", cfg)).toBe("Créno permet aux coiffeurs indépendants de réserver");
  });

  it("garde le hero en premier lors d'un déplacement", () => {
    const l = buildLanding(defaultConfig("crm"));
    expect(moveSection(l, 1, -1)).toBe(l);
    const moved = moveSection(l, 1, 1);
    expect(moved.sections[2]!.type).toBe("features");
    expect(moved.edited).toBe(true);
  });

  it("suit les changements du constructeur tant que les textes n'ont pas été modifiés", () => {
    const cfg = defaultConfig("crm");
    const l = buildLanding(cfg);
    expect(syncLanding({ ...cfg, nom: "Nouveau" }, l).sections[1]!.titre).toContain("Nouveau");
    expect(syncLanding({ ...cfg, nom: "Nouveau" }, { ...l, edited: true })).toEqual({ ...l, edited: true });
  });

  it("échappe le HTML saisi par l'utilisateur", () => {
    const cfg = { ...defaultConfig("crm"), nom: "<script>x</script>" };
    const html = renderLanding(cfg, buildLanding(cfg), null, { inlineCss: true });
    expect(html).not.toContain("<script>x");
    expect(html).toContain("&lt;script&gt;");
  });

  it("produit des mises en page différentes", () => {
    const cfg = defaultConfig("crm");
    const l = buildLanding(cfg);
    const a = renderLanding(cfg, { ...l, layout: "centre" }, null, { inlineCss: true });
    const b = renderLanding(cfg, { ...l, layout: "split" }, null, { inlineCss: true });
    expect(a).not.toEqual(b);
    expect(b).toContain('class="split"');
  });
});

describe("projets, export et import", () => {
  const idea = IDEA_BY_ID["achat-revente"]!;

  it("crée un projet à partir d'une idée", () => {
    const p = newProject(idea.template, idea);
    expect(p.config.nom).toBe(idea.nom);
    expect(p.ideaId).toBe(idea.id);
    expect(p.validation.probleme).toBe(idea.probleme);
    expect(projectProgress(p, false).pct).toBe(0);
  });

  it("duplique sans partager l'état", () => {
    const p = newProject("crm");
    const c = duplicateProject(p);
    expect(c.id).not.toBe(p.id);
    c.config.modules.push("admin");
    expect(p.config.modules).not.toContain("admin");
  });

  it("réimporte un projet exporté à l'identique", () => {
    const p = newProject(idea.template, idea);
    const r = parseImport(projectJson(p));
    expect(r.ok && r.projects[0]).toEqual(p);
  });

  it("réimporte toutes les données", () => {
    const p = newProject("crm");
    const r = parseImport(dataJson({ version: 2, projects: [p], favorites: ["coloc"], plan: "gratuit" }));
    expect(r.ok && r.favorites).toEqual(["coloc"]);
  });

  it("refuse un fichier invalide ou incohérent", () => {
    expect(parseImport("pas du json").ok).toBe(false);
    expect(parseImport(JSON.stringify({ format: "autre", version: 2 })).ok).toBe(false);
    const p = newProject("liste-attente");
    p.config.modules.push("auth"); // conflit avec « accès sans compte »
    const r = parseImport(projectJson(p));
    expect(r.ok).toBe(false);
  });

  it("génère des fichiers réels et cohérents", () => {
    const p = newProject("rendez-vous");
    const files = projectFiles(p);
    expect(files.map((f) => f.name)).toEqual(["index.html", "style.css", "prototype.html", "decollage.json", "README.md"]);
    expect(files[0]!.content).toContain('href="style.css"');
    expect(files[2]!.content).toContain('"id":"agenda"');
    expect(JSON.parse(files[3]!.content).project.id).toBe(p.id);
    expect(files[4]!.content).toContain("Application déployée : non");
  });

  it("crée un slug de fichier propre", () => {
    expect(slug("Mon Projet Génial !")).toBe("mon-projet-genial");
  });
});

describe("plans adaptés au modèle", () => {
  it("ajoute les tâches du modèle et retire les paiements d'un produit gratuit", () => {
    const shop = roadmapFor(defaultConfig("boutique"), false).flatMap((s) => s.tasks.map((t) => t.id));
    expect(shop).toContain("bo-cgv");
    const free = roadmapFor(defaultConfig("liste-attente"), false).map((s) => s.id);
    expect(free).not.toContain("paiements");
  });

  it("ajoute les tâches des briques en plan détaillé", () => {
    const cfg = defaultConfig("abonnement");
    const ids = (d: boolean) => roadmapFor(cfg, d).flatMap((s) => s.tasks.map((t) => t.id));
    expect(ids(false)).not.toContain("m-abo");
    expect(ids(true)).toContain("m-abo");
  });

  it("sélectionne des actions de lancement pertinentes", () => {
    const local = launchActionsFor(defaultConfig("rendez-vous")).map((a) => a.id);
    const b2b = launchActionsFor(defaultConfig("tickets")).map((a) => a.id);
    expect(local).toContain("commerces");
    expect(b2b).not.toContain("commerces");
    expect(b2b).toContain("linkedin");
  });
});

describe("prototype", () => {
  it("embarque toutes les pages actives et les données d'exemple du modèle", () => {
    const cfg = defaultConfig("crm");
    const d = prototypeData(cfg);
    expect(d.pages.map((p) => p.id)).toEqual(activePages(cfg).map((p) => p.id));
    expect(d.rows.every((r) => r.length === d.entity.champs.length)).toBe(true);
    expect(d.statuses).toContain(d.rows[0]![d.status]);
  });

  it("a des données de démonstration cohérentes pour les 16 modèles", () => {
    for (const t of TEMPLATES) {
      const d = prototypeData(defaultConfig(t.id));
      expect(d.rows.length, t.id).toBeGreaterThanOrEqual(6);
      expect(d.rows.every((r) => r.length === t.entite.champs.length && d.statuses.includes(r[d.status]!)), t.id).toBe(true);
      expect(d.kpis).toHaveLength(3);
    }
  });

  it("résiste à l'injection de code dans les textes", () => {
    const cfg = { ...defaultConfig("crm"), nom: "</script><script>alert(1)</script>" };
    const html = renderPrototype(cfg);
    expect(html.match(/<\/script/gi)).toHaveLength(1);
  });

  it("démarre sur la page demandée si elle existe", () => {
    const cfg = defaultConfig("crm");
    expect(prototypeData(cfg, "pipeline").start).toBe("pipeline");
    expect(prototypeData(cfg, "inexistante").start).toBe("accueil");
  });
});

describe("zip", () => {
  it("calcule le CRC32 standard", () => {
    expect(crc32(new TextEncoder().encode("123456789"))).toBe(0xcbf43926);
  });

  it("écrit une archive avec signature et répertoire central", () => {
    const z = zip([{ name: "a.txt", content: "bonjour" }, { name: "é.txt", content: "€" }]);
    const v = new DataView(z.buffer);
    expect(v.getUint32(0, true)).toBe(0x04034b50);
    expect(v.getUint32(z.length - 22, true)).toBe(0x06054b50);
    expect(v.getUint16(z.length - 22 + 10, true)).toBe(2);
  });
});
