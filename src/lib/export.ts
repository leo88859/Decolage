import { MODULE_BY_ID } from "@/data/modules";
import { TEMPLATE_BY_ID } from "@/data/templates";
import { validateConfig } from "@/lib/config";
import { landingCss, renderLanding } from "@/lib/landing";
import { activePages, REVENUE_LABEL } from "@/lib/modules";
import { contenuOf } from "@/lib/project";
import { renderPrototype } from "@/lib/prototype";
import type { AppData, Project } from "@/lib/types";

// Format documenté dans docs/FORMAT.md.
export const PROJECT_FORMAT = "decollage-projet";
export const DATA_FORMAT = "decollage-donnees";
export const FORMAT_VERSION = 2;

export function projectJson(p: Project): string {
  return JSON.stringify({ format: PROJECT_FORMAT, version: FORMAT_VERSION, exportedAt: new Date().toISOString(), project: p }, null, 2);
}

export function dataJson(d: AppData): string {
  return JSON.stringify({ format: DATA_FORMAT, version: FORMAT_VERSION, exportedAt: new Date().toISOString(), data: d }, null, 2);
}

export const slug = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "projet";

function readme(p: Project): string {
  const c = p.config;
  const t = TEMPLATE_BY_ID[c.templateId];
  return `# ${c.nom}

Généré avec Décollage à partir du modèle « ${t.nom} » (version ${c.templateVersion}).

## Contenu de l'archive

| Fichier | Rôle |
|---|---|
| index.html + style.css | Landing page statique, prête à être hébergée |
| prototype.html | Prototype cliquable (niveau 1) — données d'exemple, aucun enregistrement |
| decollage.json | Configuration complète du projet (format documenté « ${PROJECT_FORMAT} » v${FORMAT_VERSION}) |

## Où en est ce projet

- **Niveau 1 — Prototype : oui.** \`prototype.html\` montre l'apparence et la navigation.
- **Niveau 2 — Projet exportable : oui.** Cette archive et la configuration JSON.
- **Niveau 3 — Application déployée : non.** Aucune base de données, aucune authentification réelle, aucun paiement ne sont actifs.

## Configuration

- Modèle de revenus : ${REVENUE_LABEL[c.revenu]}${c.prix ? ` (${c.prix} €)` : ""}
- Types d'utilisateurs : ${c.roles.join(", ")}
- Pages : ${activePages(c).map((x) => x.titre).join(", ")}
- Briques : ${c.modules.map((m) => MODULE_BY_ID[m].nom).join(", ")}
${c.domaine ? `- Domaine souhaité : ${c.domaine} (non réservé par Décollage)\n` : ""}
## Pour passer en production

1. Choisir une plateforme (no-code ou code) et recréer les pages listées ci-dessus.
2. Mettre en place une base de données et une authentification réelles pour les briques qui en ont besoin.
3. Brancher un prestataire de paiement si le modèle de revenus le demande.
4. Rédiger mentions légales, politique de confidentialité et conditions d'utilisation.
5. Héberger la landing (index.html + style.css) et réserver le nom de domaine.
6. Tester sur mobile, mettre en place des sauvegardes et le suivi des erreurs.

La feuille de route détaillée se trouve dans Décollage, onglet « Feuille de route ».
`;
}

export function projectFiles(p: Project): { name: string; content: string }[] {
  const pricing = p.pricing.offres.length ? p.pricing : null;
  const contenu = contenuOf(p);
  return [
    { name: "index.html", content: renderLanding(p.config, p.landing, pricing, { inlineCss: false, contenu }) },
    { name: "style.css", content: landingCss(p.config, p.landing) },
    // Application autonome : démarre avec les données du projet, puis enregistre dans le navigateur.
    { name: "prototype.html", content: renderPrototype(p.config, "accueil", contenu, { persist: true, storeKey: p.id, initial: p.appData }) },
    { name: "decollage.json", content: projectJson(p) },
    { name: "README.md", content: readme(p) },
  ];
}

type ImportResult = { ok: true; projects: Project[]; favorites: string[] } | { ok: false; error: string };

function checkProject(x: unknown): string | null {
  const p = x as Project;
  if (!p || typeof p !== "object" || typeof p.id !== "string" || !p.config || !p.landing) return "Structure de projet invalide.";
  if (!TEMPLATE_BY_ID[p.config.templateId]) return `Modèle inconnu : ${String(p.config.templateId)}.`;
  if (!Array.isArray(p.config.modules) || p.config.modules.some((m) => !MODULE_BY_ID[m])) return "Liste de briques invalide.";
  if (!Array.isArray(p.landing.sections) || !p.pricing || !Array.isArray(p.metrics)) return "Données de projet incomplètes.";
  const errors = validateConfig(p.config);
  const first = Object.values(errors)[0];
  return first ? `Configuration invalide : ${first}` : null;
}

/** Lit un export Décollage (projet seul ou données complètes) et vérifie chaque projet. */
export function parseImport(text: string): ImportResult {
  let raw: { format?: string; version?: number; project?: unknown; data?: AppData };
  try {
    raw = JSON.parse(text);
  } catch {
    return { ok: false, error: "Le fichier n'est pas un JSON valide." };
  }
  if (raw.version !== FORMAT_VERSION) return { ok: false, error: `Version de format non prise en charge (${String(raw.version)}).` };
  const projects = raw.format === PROJECT_FORMAT ? [raw.project] : raw.format === DATA_FORMAT ? (raw.data?.projects ?? []) : null;
  if (!projects) return { ok: false, error: "Ce fichier n'est pas un export Décollage." };
  for (const p of projects) {
    const err = checkProject(p);
    if (err) return { ok: false, error: err };
  }
  const favorites = raw.format === DATA_FORMAT && Array.isArray(raw.data?.favorites) ? raw.data!.favorites.filter((f) => typeof f === "string") : [];
  return { ok: true, projects: projects as Project[], favorites };
}
