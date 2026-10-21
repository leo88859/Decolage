import { DESIGN_BY_ID } from "@/data/designs";
import { isExtraKind } from "@/data/extras";
import { MODULE_BY_ID } from "@/data/modules";
import { TEMPLATE_BY_ID } from "@/data/templates";
import { dependencies, moduleIssues } from "@/lib/modules";
import type { Config, Idea, ModuleId, Police, TemplateId, VisualStyle } from "@/lib/types";

export const STYLE_PRESETS: Record<VisualStyle, { nom: string; description: string; primaire: string; accent: string }> = {
  moderne: { nom: "Moderne", description: "Coins arrondis, ombres douces, sans-serif.", primaire: "#2f5bff", accent: "#ff6b4a" },
  minimal: { nom: "Minimal", description: "Noir et blanc, lignes fines, beaucoup d'espace.", primaire: "#111827", accent: "#6b7280" },
  audacieux: { nom: "Audacieux", description: "Couleurs franches, titres massifs, contours épais.", primaire: "#7c3aed", accent: "#facc15" },
  neon: { nom: "Néon", description: "Fond sombre, couleurs lumineuses et halos.", primaire: "#22d3ee", accent: "#f472b6" },
  pastel: { nom: "Pastel", description: "Tons doux, formes très arrondies, ambiance légère.", primaire: "#8b5cf6", accent: "#fb7185" },
  luxe: { nom: "Luxe", description: "Crème et doré, titres à empattements, élégance sobre.", primaire: "#a1783f", accent: "#1c1917" },
};

/** Polices proposées. `url` = feuille Google Fonts chargée par la page générée (repli sur une police système). */
export const POLICES: Record<Police, { nom: string; famille: string; url: string }> = {
  systeme: { nom: "Système", famille: 'system-ui,-apple-system,"Segoe UI",sans-serif', url: "" },
  arrondie: { nom: "Arrondie", famille: '"Nunito",system-ui,sans-serif', url: "https://fonts.googleapis.com/css2?family=Nunito:wght@400;600;800&display=swap" },
  elegante: { nom: "Élégante", famille: '"Playfair Display",Georgia,serif', url: "https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;600;800&display=swap" },
  geometrique: { nom: "Géométrique", famille: '"Outfit",system-ui,sans-serif', url: "https://fonts.googleapis.com/css2?family=Outfit:wght@400;600;800&display=swap" },
  mono: { nom: "Technique", famille: '"JetBrains Mono",ui-monospace,monospace', url: "https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;600;800&display=swap" },
};

export const policeOf = (cfg: Config) => POLICES[cfg.police ?? "systeme"] ?? POLICES.systeme;

export const initialsOf = (name: string) =>
  name.trim().split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]!.toUpperCase()).join("") || "D";

export function defaultConfig(templateId: TemplateId, idea?: Idea): Config {
  const t = TEMPLATE_BY_ID[templateId];
  const wanted = [...t.modules.requis, ...t.modules.defaut];
  const modules: ModuleId[] = [];
  for (const m of wanted) for (const x of [...dependencies(m), m]) if (!modules.includes(x)) modules.push(x);

  // Le modèle économique de l'idée est repris s'il est compatible avec les briques du modèle.
  const ideaRevenue = idea?.modele;
  const revenu = ideaRevenue && !modules.some((m) => MODULE_BY_ID[m].revenusIncompatibles.includes(ideaRevenue)) ? ideaRevenue : t.revenu;
  const nom = idea?.nom ?? t.nom;
  const reglages: Record<string, string> = {};
  for (const m of modules) for (const r of MODULE_BY_ID[m].reglages) reglages[r.id] = r.options[0]!;

  return {
    templateId,
    templateVersion: t.version,
    nom,
    description: idea?.description ?? t.accroche,
    cible: idea?.cible ?? "",
    couleurs: { primaire: STYLE_PRESETS.moderne.primaire, accent: STYLE_PRESETS.moderne.accent },
    initiales: initialsOf(nom),
    logo: "",
    style: "moderne",
    police: "systeme",
    modules,
    reglages,
    roles: [...t.roles],
    pages: {},
    revenu,
    prix: revenu === "gratuit" ? 0 : t.prix || 9,
    domaine: "",
  };
}

const HEX = /^#[0-9a-f]{6}$/i;
const DOMAIN = /^(?!-)[a-z0-9-]{1,63}(\.[a-z0-9-]{1,63})*\.[a-z]{2,}$/i;

/** Erreurs par champ. Un objet vide = configuration valide. */
export function validateConfig(cfg: Config): Record<string, string> {
  const e: Record<string, string> = {};
  if (!TEMPLATE_BY_ID[cfg.templateId]) e.templateId = "Modèle inconnu.";
  if (!(cfg.style in STYLE_PRESETS)) e.style = "Style inconnu.";
  if (cfg.police !== undefined && !(cfg.police in POLICES)) e.police = "Police inconnue.";
  if (cfg.design !== undefined && !DESIGN_BY_ID[cfg.design]) e.design = "Design inconnu.";
  if (cfg.extras !== undefined && (!Array.isArray(cfg.extras) || cfg.extras.length > 5 || !cfg.extras.every(isExtraKind) || new Set(cfg.extras).size !== cfg.extras.length)) e.extras = "Pages ajoutées invalides.";
  if (!["gratuit", "abonnement", "paiement-unique", "freemium", "commission"].includes(cfg.revenu)) e.revenu = "Modèle de revenus inconnu.";
  if (typeof cfg.nom !== "string" || typeof cfg.description !== "string" || typeof cfg.cible !== "string" || typeof cfg.domaine !== "string" || typeof cfg.logo !== "string" || !Array.isArray(cfg.roles) || !Array.isArray(cfg.modules)) {
    e.format = "Format de configuration invalide.";
    return e;
  }
  if (Object.values(cfg.reglages ?? {}).some((v) => typeof v !== "string" || v.length > 60)) e.reglages = "Réglage invalide.";
  if (!cfg.nom.trim()) e.nom = "Le nom du produit est obligatoire.";
  else if (cfg.nom.length > 40) e.nom = "40 caractères maximum.";
  if (cfg.description.length > 220) e.description = "220 caractères maximum.";
  if (cfg.cible.length > 120) e.cible = "120 caractères maximum.";
  if (!HEX.test(cfg.couleurs.primaire) || !HEX.test(cfg.couleurs.accent)) e.couleurs = "Couleur invalide (format #RRGGBB).";
  if (!/^[\p{L}\p{N}]{1,3}$/u.test(cfg.initiales)) e.initiales = "1 à 3 lettres ou chiffres.";
  if (cfg.logo && (!cfg.logo.startsWith("data:image/") || cfg.logo.length > 400_000)) e.logo = "Image invalide ou trop lourde (300 Ko maximum).";
  if (!Number.isFinite(cfg.prix) || cfg.prix < 0 || cfg.prix > 10_000) e.prix = "Prix entre 0 et 10 000 €.";
  if (cfg.revenu !== "gratuit" && cfg.prix === 0 && cfg.revenu !== "freemium") e.prix = "Indique un prix supérieur à 0 pour ce modèle de revenus.";
  if (cfg.domaine && !DOMAIN.test(cfg.domaine)) e.domaine = "Format de domaine invalide (ex. : monprojet.fr).";
  if (!cfg.roles.length) e.roles = "Au moins un type d'utilisateur.";
  else if (cfg.roles.some((r) => !r.trim() || r.length > 30)) e.roles = "Chaque rôle doit faire entre 1 et 30 caractères.";
  const issues = moduleIssues(cfg);
  if (issues.length) e.modules = issues.join(" ");
  return e;
}
