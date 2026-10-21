import type { LandingLayout, Police, VisualStyle } from "@/lib/types";

// 10 designs de SaaS. Chacun combine un style visuel, une structure d'application (menu),
// un tableau de bord et une famille d'animations qui lui sont propres.

export type Shell = "side" | "top" | "rail" | "float";
export type Dash = "kpi-chart" | "bento" | "donut" | "editorial" | "bars" | "table" | "wave" | "rings" | "terminal" | "mosaic";
export type Anim = "rise" | "glow" | "pop" | "slow" | "hard" | "blur" | "slide" | "flip" | "type" | "cascade";

export type DesignDef = {
  id: string;
  nom: string;
  description: string;
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
  { id: "aurora", nom: "Aurora", description: "Menu latéral, chiffres clés et courbe qui se dessine. Le classique qui marche partout.", style: "moderne", couleurs: { primaire: "#2f5bff", accent: "#ff6b4a" }, police: "systeme", shell: "side", dash: "kpi-chart", anim: "rise", layout: "centre", tags: ["Polyvalent", "Clair"] },
  { id: "neon", nom: "Néon Pulse", description: "Fond nuit, jauges lumineuses et halos qui pulsent. Pour un produit qui en jette.", style: "neon", couleurs: { primaire: "#22d3ee", accent: "#f472b6" }, police: "geometrique", shell: "top", dash: "rings", anim: "glow", layout: "split", tags: ["Sombre", "Tech"] },
  { id: "pastel", nom: "Nuage Pastel", description: "Formes rondes, couleurs douces, graphique en anneau et petits rebonds.", style: "pastel", couleurs: { primaire: "#8b5cf6", accent: "#fb7185" }, police: "arrondie", shell: "float", dash: "donut", anim: "pop", layout: "centre", tags: ["Doux", "Grand public"] },
  { id: "maison", nom: "Maison", description: "Crème et doré, grands chiffres à empattements, apparitions lentes et élégantes.", style: "luxe", couleurs: { primaire: "#a1783f", accent: "#1c1917" }, police: "elegante", shell: "top", dash: "editorial", anim: "slow", layout: "editorial", tags: ["Élégant", "Premium"] },
  { id: "brutal", nom: "Brutal", description: "Contours épais, ombres décalées, histogramme massif et mouvements secs.", style: "audacieux", couleurs: { primaire: "#7c3aed", accent: "#facc15" }, police: "geometrique", shell: "side", dash: "bars", anim: "hard", layout: "split", tags: ["Audacieux", "Jeune"] },
  { id: "papier", nom: "Papier", description: "Noir et blanc, tableau dense au premier plan, transitions floues et discrètes.", style: "minimal", couleurs: { primaire: "#111827", accent: "#6b7280" }, police: "elegante", shell: "top", dash: "table", anim: "blur", layout: "editorial", tags: ["Sobre", "Pro"] },
  { id: "ocean", nom: "Océan", description: "Menu en icônes, vagues de données et éléments qui glissent depuis la gauche.", style: "moderne", couleurs: { primaire: "#0891b2", accent: "#14b8a6" }, police: "geometrique", shell: "rail", dash: "wave", anim: "slide", layout: "split", tags: ["Frais", "Calme"] },
  { id: "sunset", nom: "Coucher de soleil", description: "Bandeau dégradé chaud, anneaux de progression et cartes qui se retournent.", style: "moderne", couleurs: { primaire: "#ea580c", accent: "#db2777" }, police: "arrondie", shell: "float", dash: "mosaic", anim: "flip", layout: "centre", tags: ["Chaleureux", "Dynamique"] },
  { id: "terminal", nom: "Terminal", description: "Police technique, écran sombre, chiffres tapés à la machine et lignes de journal.", style: "neon", couleurs: { primaire: "#22c55e", accent: "#a3e635" }, police: "mono", shell: "rail", dash: "terminal", anim: "type", layout: "editorial", tags: ["Développeurs", "Geek"] },
  { id: "bento", nom: "Bento", description: "Grille de tuiles de tailles variées qui apparaissent en cascade, façon boîte bento.", style: "pastel", couleurs: { primaire: "#2563eb", accent: "#f59e0b" }, police: "systeme", shell: "side", dash: "bento", anim: "cascade", layout: "split", tags: ["Moderne", "Visuel"] },
];

export const SHELL_LABEL: Record<Shell, string> = { side: "Menu latéral", top: "Barre en haut", rail: "Rail d'icônes", float: "Menu flottant" };
export const DASH_LABEL: Record<Dash, string> = {
  "kpi-chart": "Chiffres et courbe", bento: "Tuiles bento", donut: "Graphique en anneau", editorial: "Grands chiffres éditoriaux", bars: "Histogramme",
  table: "Tableau dense", wave: "Vagues de données", rings: "Jauges d'objectifs", terminal: "Journal d'activité", mosaic: "Bandeau et anneaux",
};
export const ANIM_LABEL: Record<Anim, string> = {
  rise: "Montée douce", glow: "Halo lumineux", pop: "Rebond", slow: "Fondu lent", hard: "Mouvement sec", blur: "Mise au point", slide: "Glissement", flip: "Bascule", type: "Frappe clavier", cascade: "Cascade",
};

/** Ambiances pour filtrer la galerie. */
export const AMBIANCES: { id: string; label: string; ids: string[] }[] = [
  { id: "clair", label: "Clair", ids: ["aurora", "pastel", "maison", "brutal", "papier", "ocean", "sunset", "bento"] },
  { id: "sombre", label: "Sombre", ids: ["neon", "terminal"] },
  { id: "elegant", label: "Élégant", ids: ["maison", "papier", "aurora"] },
  { id: "audacieux", label: "Audacieux", ids: ["brutal", "neon", "sunset", "terminal"] },
  { id: "doux", label: "Doux", ids: ["pastel", "ocean", "bento"] },
];

export const DESIGN_BY_ID = Object.fromEntries(DESIGNS.map((d) => [d.id, d])) as Record<string, DesignDef>;

// Design proposé d'office, selon l'ambiance du métier puis du type de SaaS. Règles fixes, modifiables par l'utilisateur.
const PAR_SECTEUR: Record<string, string> = {
  informatique: "terminal", gaming: "neon", musique: "neon",
  immobilier: "maison", cabinet: "maison", mode: "maison", beaute: "maison", evenement: "maison", tatouage: "brutal",
  enfance: "pastel", animaux: "pastel", bienetre: "pastel", soutien: "pastel", etudiants: "pastel", langues: "pastel",
  sport: "brutal", auto: "brutal",
  restauration: "sunset", boulangerie: "sunset", voyage: "sunset", createurs: "sunset", artisanat: "sunset", photo: "sunset",
  sante: "ocean", jardin: "ocean", menage: "ocean", livraison: "ocean",
  budget: "bento", freelance: "bento", association: "bento", coiffure: "aurora",
  batiment: "papier",
};
const PAR_TYPE: Partial<Record<string, string>> = { crm: "papier", documents: "papier", tickets: "papier", "suivi-gains": "bento", projets: "bento", formation: "pastel", abonnement: "neon" };

export const designFor = (type: string, secteur: string): DesignDef =>
  DESIGN_BY_ID[PAR_SECTEUR[secteur] ?? PAR_TYPE[type] ?? "aurora"] ?? DESIGNS[0]!;
