import type { LandingLayout, Police, TemplateId, VisualStyle } from "@/lib/types";
import { archOf } from "@/data/archetypes";

// Les designs de Décollage. Chacun combine un style visuel, une structure d'application (menu),
// un tableau de bord et une famille d'animations qui lui sont propres.
// Deux familles : les designs pensés pour un SaaS (outil, tableau de bord) et ceux pensés pour une
// boutique en ligne (catalogue, produits mis en avant).

export type Shell = "side" | "top" | "rail" | "float";
export type Dash = "kpi-chart" | "bento" | "donut" | "editorial" | "bars" | "table" | "wave" | "rings" | "terminal" | "mosaic";
export type Anim = "rise" | "glow" | "pop" | "slow" | "hard" | "blur" | "slide" | "flip" | "type" | "cascade";
export type Cible = "saas" | "boutique";

export type DesignDef = {
  id: string;
  nom: string;
  description: string;
  cible: Cible;
  style: VisualStyle;
  couleurs: { primaire: string; accent: string };
  police: Police;
  shell: Shell;
  dash: Dash;
  anim: Anim;
  layout: LandingLayout;
  tags: string[];
};

export const DESIGNS: DesignDef[] = [
  // ── SaaS ──
  { id: "clarte", nom: "Clarté", cible: "saas", description: "Blanc net, filets fins, indigo franc. La sobriété des meilleurs outils pros.", style: "moderne", couleurs: { primaire: "#4f46e5", accent: "#06b6d4" }, police: "systeme", shell: "side", dash: "kpi-chart", anim: "rise", layout: "dashboard", tags: ["Pro", "Clair"] },
  { id: "minuit", nom: "Minuit", cible: "saas", description: "Noir profond, cartes de verre, halo violet au-dessus du titre. Pour un produit qui impressionne.", style: "neon", couleurs: { primaire: "#a78bfa", accent: "#38bdf8" }, police: "geometrique", shell: "top", dash: "bento", anim: "blur", layout: "bento", tags: ["Sombre", "Premium"] },
  { id: "studio", nom: "Studio", cible: "saas", description: "Papier ivoire, titres à empattements, grands chiffres éditoriaux. Calme et haut de gamme.", style: "luxe", couleurs: { primaire: "#b45309", accent: "#1c1917" }, police: "elegante", shell: "side", dash: "editorial", anim: "slow", layout: "prestige", tags: ["Élégant", "Conseil"] },
  { id: "pop", nom: "Pop", cible: "saas", description: "Contours noirs, couleurs franches, ombres pleines. Joyeux, direct, impossible à rater.", style: "audacieux", couleurs: { primaire: "#2b59ff", accent: "#ffd23f" }, police: "geometrique", shell: "side", dash: "bars", anim: "hard", layout: "split", tags: ["Audacieux", "Jeune"] },
  { id: "zen", nom: "Zen", cible: "saas", description: "Presque rien : du blanc, du gris et une seule couleur. Les données passent avant tout.", style: "minimal", couleurs: { primaire: "#0f766e", accent: "#64748b" }, police: "systeme", shell: "rail", dash: "table", anim: "blur", layout: "editorial", tags: ["Sobre", "Données"] },
  { id: "flux", nom: "Flux", cible: "saas", description: "Bleu ciel et vert d'eau, grandes cartes arrondies, courbes qui glissent. Frais et rassurant.", style: "moderne", couleurs: { primaire: "#0284c7", accent: "#10b981" }, police: "arrondie", shell: "float", dash: "wave", anim: "slide", layout: "immersif", tags: ["Frais", "Santé"] },
  { id: "douceur", nom: "Douceur", cible: "saas", description: "Couleurs tendres, formes rondes, anneaux et petits rebonds. Pour le grand public et les familles.", style: "pastel", couleurs: { primaire: "#7c3aed", accent: "#f472b6" }, police: "arrondie", shell: "float", dash: "donut", anim: "pop", layout: "centre", tags: ["Doux", "Grand public"] },
  { id: "console", nom: "Console", cible: "saas", description: "Écran sombre, police technique, chiffres tapés au clavier. Pour les outils de développeurs.", style: "neon", couleurs: { primaire: "#22c55e", accent: "#eab308" }, police: "mono", shell: "rail", dash: "terminal", anim: "type", layout: "dashboard", tags: ["Tech", "Sombre"] },
  // ── Boutiques en ligne ──
  { id: "vitrine", nom: "Vitrine", cible: "boutique", description: "Fond blanc, grandes photos produits, boutons noirs. La boutique moderne qui laisse parler les produits.", style: "moderne", couleurs: { primaire: "#111827", accent: "#f97316" }, police: "geometrique", shell: "top", dash: "mosaic", anim: "rise", layout: "catalogue", tags: ["Polyvalent", "Clair"] },
  { id: "atelier", nom: "Atelier", cible: "boutique", description: "Crème, terracotta et vert olive, titres à empattements. Pour le fait main et l'artisanat.", style: "luxe", couleurs: { primaire: "#9a3412", accent: "#4d7c0f" }, police: "elegante", shell: "float", dash: "editorial", anim: "cascade", layout: "immersif", tags: ["Artisanal", "Chaleureux"] },
  { id: "marche", nom: "Marché", cible: "boutique", description: "Vert frais et jaune soleil, étiquettes arrondies, tuiles gourmandes. Pour l'alimentaire et le local.", style: "pastel", couleurs: { primaire: "#15803d", accent: "#f59e0b" }, police: "arrondie", shell: "float", dash: "bento", anim: "pop", layout: "catalogue", tags: ["Gourmand", "Local"] },
  { id: "ecrin", nom: "Écrin", cible: "boutique", description: "Noir et or, beaucoup d'espace, apparitions lentes. Pour les bijoux, la beauté et le luxe.", style: "neon", couleurs: { primaire: "#d4af37", accent: "#f5f0e6" }, police: "elegante", shell: "top", dash: "editorial", anim: "slow", layout: "prestige", tags: ["Luxe", "Sombre"] },
  { id: "street", nom: "Street", cible: "boutique", description: "Noir, blanc et jaune fluo, typographie massive, cartes inclinées. Pour la mode et le streetwear.", style: "audacieux", couleurs: { primaire: "#111111", accent: "#c6ff00" }, police: "geometrique", shell: "rail", dash: "bars", anim: "flip", layout: "bento", tags: ["Mode", "Audacieux"] },
];

export const SHELL_LABEL: Record<Shell, string> = { side: "Menu latéral", top: "Barre en haut", rail: "Rail d'icônes", float: "Menu flottant" };
export const DASH_LABEL: Record<Dash, string> = {
  "kpi-chart": "Chiffres et courbe", bento: "Tuiles bento", donut: "Graphique en anneau", editorial: "Grands chiffres éditoriaux", bars: "Histogramme",
  table: "Tableau dense", wave: "Vagues de données", rings: "Jauges d'objectifs", terminal: "Journal d'activité", mosaic: "Bandeau et anneaux",
};
export const ANIM_LABEL: Record<Anim, string> = {
  rise: "Montée douce", glow: "Halo lumineux", pop: "Rebond", slow: "Fondu lent", hard: "Mouvement sec", blur: "Mise au point", slide: "Glissement", flip: "Bascule", type: "Frappe clavier", cascade: "Cascade",
};
export const CIBLE_LABEL: Record<Cible, string> = { saas: "SaaS", boutique: "Boutique en ligne" };

/** Filtres de la galerie : la famille (SaaS ou boutique), puis des ambiances. */
export const AMBIANCES: { id: string; label: string; ids: string[] }[] = [
  { id: "saas", label: "SaaS", ids: DESIGNS.filter((d) => d.cible === "saas").map((d) => d.id) },
  { id: "boutique", label: "Boutique", ids: DESIGNS.filter((d) => d.cible === "boutique").map((d) => d.id) },
  { id: "clair", label: "Clair", ids: ["clarte", "studio", "pop", "zen", "flux", "douceur", "vitrine", "atelier", "marche"] },
  { id: "sombre", label: "Sombre", ids: ["minuit", "console", "ecrin", "street"] },
  { id: "elegant", label: "Élégant", ids: ["studio", "atelier", "ecrin", "zen"] },
  { id: "audacieux", label: "Audacieux", ids: ["pop", "street", "minuit", "console"] },
  { id: "doux", label: "Doux", ids: ["douceur", "flux", "marche"] },
];

/**
 * Les anciens designs (avant novembre 2026) basculent sur le nouveau design le plus proche, de même style
 * de base : un projet existant garde ses couleurs et sa structure, et prend la nouvelle signature visuelle.
 */
export const ANCIENS_DESIGNS: Record<string, string> = {
  aurora: "clarte", neon: "minuit", pastel: "douceur", maison: "studio", brutal: "pop",
  papier: "zen", ocean: "flux", sunset: "flux", terminal: "console", bento: "douceur",
};

const PAR_ID = Object.fromEntries(DESIGNS.map((d) => [d.id, d])) as Record<string, DesignDef>;
/** Un design par identifiant ; un ancien identifiant mène au design qui le remplace. */
export const DESIGN_BY_ID: Record<string, DesignDef> = {
  ...PAR_ID,
  ...Object.fromEntries(Object.entries(ANCIENS_DESIGNS).map(([ancien, nouveau]) => [ancien, PAR_ID[nouveau]!])),
};
/** L'identifiant actuel d'un design (un ancien identifiant donne celui qui le remplace). */
export const designId = (id: string | undefined) => (id ? DESIGN_BY_ID[id]?.id : undefined);

/** Un type de SaaS qui vend des produits (architecture e-commerce) prend les designs de boutique. */
export const cibleDuType = (type: string): Cible => (archOf(type as TemplateId)?.id === "commerce" ? "boutique" : "saas");
/** Les designs d'une famille d'abord, puis les autres. */
export const designsPour = (cible: Cible) => [...DESIGNS.filter((d) => d.cible === cible), ...DESIGNS.filter((d) => d.cible !== cible)];

// Design proposé d'office, selon l'ambiance du métier puis du type de SaaS. Règles fixes, modifiables par l'utilisateur.
const PAR_SECTEUR: Record<string, string> = {
  informatique: "console", gaming: "minuit", musique: "minuit", photo: "minuit",
  immobilier: "studio", cabinet: "studio", evenement: "studio", artisanat: "studio", mode: "studio", beaute: "studio",
  enfance: "douceur", animaux: "douceur", bienetre: "douceur", soutien: "douceur", etudiants: "douceur", langues: "douceur", association: "douceur",
  sport: "pop", auto: "pop", createurs: "pop", tatouage: "pop",
  sante: "flux", jardin: "flux", menage: "flux", livraison: "flux", voyage: "flux",
  restauration: "clarte", boulangerie: "clarte", budget: "clarte", freelance: "clarte", coiffure: "clarte",
  batiment: "zen",
};
const PAR_TYPE: Partial<Record<string, string>> = { crm: "zen", documents: "zen", tickets: "zen", "suivi-gains": "clarte", projets: "clarte", formation: "douceur", abonnement: "minuit" };
/** Pour une boutique : le design de boutique qui va avec le métier. */
const BOUTIQUE_PAR_SECTEUR: Record<string, string> = {
  mode: "street", sport: "street", tatouage: "street", gaming: "street",
  beaute: "ecrin", evenement: "ecrin", photo: "ecrin",
  artisanat: "atelier", createurs: "atelier", jardin: "atelier", animaux: "atelier",
  restauration: "marche", boulangerie: "marche", livraison: "marche", bienetre: "marche",
};

export const designFor = (type: string, secteur: string): DesignDef =>
  cibleDuType(type) === "boutique"
    ? PAR_ID[BOUTIQUE_PAR_SECTEUR[secteur] ?? "vitrine"]!
    : PAR_ID[PAR_SECTEUR[secteur] ?? PAR_TYPE[type] ?? "clarte"] ?? DESIGNS[0]!;
