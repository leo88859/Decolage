import { DEMO } from "@/data/demo";
import { TEMPLATE_BY_ID } from "@/data/templates";
import { POLICES, policeOf } from "@/lib/config";
import { activePages } from "@/lib/modules";
import { PROTO_CSS } from "@/lib/proto-css";
import { PROTO_DESIGN_CSS } from "@/lib/design-css";
import { protoRuntime, type ProtoData } from "@/lib/proto-runtime";
import { archOf, HOME_LAYOUT, ROLES } from "@/data/archetypes";
import { DESIGN_BY_ID } from "@/data/designs";
import { ARCH_CSS } from "@/lib/arch-css";
import { protoArch } from "@/lib/proto-arch";
import type { Config, Contenu } from "@/lib/types";

// Prototype interactif (niveau 1) : une vraie mini-application qui tourne en mémoire dans le
// navigateur, avec des données d'exemple. Aucun backend : rien n'est enregistré.

const esc = (s: unknown) => String(s ?? "").replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[ch]!);

export const STYLE_VARS: Record<Config["style"], string> = {
  moderne: `--r:14px;--bd:1px solid var(--ln);--sh:0 1px 2px rgba(15,23,42,.04),0 12px 32px -20px rgba(15,23,42,.3);--ff:"Inter",system-ui,-apple-system,"Segoe UI",sans-serif`,
  minimal: `--r:4px;--bd:1px solid var(--ln);--sh:none;--ff:system-ui,-apple-system,"Segoe UI",sans-serif`,
  audacieux: `--r:8px;--bd:2px solid var(--ink);--sh:4px 4px 0 var(--ink);--ff:system-ui,-apple-system,"Segoe UI",sans-serif`,
  neon: `--r:14px;--bd:1px solid var(--ln);--sh:0 0 0 1px color-mix(in srgb,var(--p) 18%,transparent),0 0 34px -14px var(--p);--ff:system-ui,-apple-system,"Segoe UI",sans-serif`,
  pastel: `--r:22px;--bd:1px solid var(--ln);--sh:0 10px 30px -18px color-mix(in srgb,var(--p) 60%,transparent);--ff:system-ui,-apple-system,"Segoe UI",sans-serif`,
  luxe: `--r:2px;--bd:1px solid var(--ln);--sh:none;--ff:system-ui,-apple-system,"Segoe UI",sans-serif`,
};
export const STYLE_EXTRA: Record<Config["style"], string> = {
  moderne: "",
  minimal: `h1,h2,.big,.price,.hero-t{font-family:Georgia,"Times New Roman",serif;font-weight:500}.hero-t{background:none;color:var(--ink)}.mark{background:var(--ink)}`,
  audacieux: `h1,.hero-t{text-transform:uppercase;font-weight:900;letter-spacing:-.03em}.b.primary{box-shadow:3px 3px 0 var(--ink);border:2px solid var(--ink)}.b.primary:hover{transform:translate(-1px,-1px);box-shadow:4px 4px 0 var(--ink)}.hero-t{background:none;color:var(--ink)}.thumb{border:2px solid var(--ink)}.side a.on{background:var(--a);color:var(--ink)}`,
  neon: `html{--bg:#05060f;--sf:#0c0f22;--sf2:#141936;--ink:#e6f6ff;--mut:#8ea3c9;--ln:rgba(120,220,255,.14);color-scheme:dark}.b.primary{box-shadow:0 0 22px -4px var(--p);color:#05060f}.hero-t{background:linear-gradient(120deg,var(--p),var(--a));-webkit-background-clip:text;background-clip:text;text-shadow:none}h1{text-shadow:0 0 24px color-mix(in srgb,var(--p) 45%,transparent)}.side a.on{box-shadow:inset 0 0 0 1px color-mix(in srgb,var(--p) 40%,transparent)}.blob{opacity:.55}.av{background:color-mix(in srgb,var(--p) 25%,#0c0f22);color:#e6f6ff}.bdg.ok{background:rgba(34,197,94,.15);color:#86efac}.bdg.bad{background:rgba(244,63,94,.15);color:#fda4af}.bdg.warn{background:rgba(245,158,11,.15);color:#fcd34d}.bdg.info{background:color-mix(in srgb,var(--p) 18%,transparent);color:var(--p)}.paper{background:#fff}`,
  pastel: `html{--bg:#fbf7ff;--sf:#ffffff;--sf2:#f5effe;--ln:rgba(139,92,246,.14)}.b{border-radius:99px}.chip,.toggle button{border-radius:99px}.thumb{border-radius:18px}.mark{border-radius:50%}.hero-t{background:linear-gradient(120deg,var(--p),var(--a));-webkit-background-clip:text;background-clip:text}.blob{opacity:.3;filter:blur(70px)}`,
  luxe: `html{--bg:#f7f3ec;--sf:#fffdf8;--sf2:#efe8dc;--ink:#1c1917;--mut:#78716c;--ln:rgba(28,25,23,.12)}h1,h2,.big,.price,.hero-t,.cert h2{font-family:"Playfair Display",Georgia,serif;font-weight:500;letter-spacing:0}.hero-t{background:none;color:var(--ink)}.tag,.mut.sm,th{letter-spacing:.08em}.b.primary{background:var(--ink);border-color:var(--ink);color:#f7f3ec;box-shadow:none}.mark{background:var(--p);border-radius:2px}.side a.on{background:none;color:var(--p)}.side a.on::before{background:var(--p)}.thumb{filter:saturate(.6)}.blob{opacity:.18}`,
};

/** Graine stable par modèle : les courbes d'exemple sont toujours les mêmes. */
const seedOf = (s: string) => [...s].reduce((h, c) => (h * 31 + c.charCodeAt(0)) % 2147483647, 7) || 7;

/** Enregistrement des données : `persist` + `storeKey` ; `initial` = données de départ (ex. celles du projet). */
export type ProtoOpts = { persist?: boolean; storeKey?: string; initial?: unknown };

export function prototypeData(cfg: Config, start = "accueil", contenu?: Contenu, opts: ProtoOpts = {}): ProtoData {
  const t = TEMPLATE_BY_ID[cfg.templateId];
  const a = archOf(cfg.templateId);
  // Architecture dédiée : site public + espace utilisateur, avec le rôle de chaque colonne.
  const arch = a.id === "classic" ? null : {
    id: a.id, frame: a.frame, roles: { ...ROLES[cfg.templateId] } as Record<string, number>,
    home: HOME_LAYOUT[cfg.design ?? ""] ?? "centre", accounts: cfg.modules.includes("auth"),
  };
  const heroTitre = (contenu?.copy.heroTitre ?? t.copy.heroTitre).replaceAll("{nom}", cfg.nom).replaceAll("{cible}", cfg.cible);
  return { ...baseData(cfg, start, contenu), arch, heroTitre, ...(opts.persist ? { persist: true, storeKey: opts.storeKey ?? cfg.nom } : {}), ...(opts.initial ? { initial: opts.initial } : {}) };
}

function baseData(cfg: Config, start: string, contenu?: Contenu): ProtoData {
  const t = TEMPLATE_BY_ID[cfg.templateId];
  const demo = DEMO[cfg.templateId];
  const pages = activePages(cfg);
  const d = cfg.design ? DESIGN_BY_ID[cfg.design] : undefined;
  const layout = { shell: d?.shell ?? "side", dash: d?.dash ?? "kpi-chart", anim: d?.anim ?? "rise" };
  // Le contenu rempli à partir de l'idée remplace les données d'exemple du modèle (même format).
  if (contenu && contenu.lignes.length && contenu.lignes.every((r) => r.length === t.entite.champs.length)) {
    const nomize = (s: string) => s.replaceAll("{nom}", cfg.nom);
    return {
      name: cfg.nom, initials: cfg.initiales, logo: cfg.logo, cible: cfg.cible, description: cfg.description,
      style: cfg.style, prix: cfg.prix, revenu: cfg.revenu,
      start: pages.some((p) => p.id === start) ? start : "accueil",
      pages, mods: Object.fromEntries(cfg.modules.map((m) => [m, true])), reglages: cfg.reglages, roles: cfg.roles,
      entity: contenu.entite, rows: contenu.lignes, status: demo.status, statuses: contenu.statuts, kpis: contenu.kpis, serie: contenu.serie,
      features: contenu.fonctionnalites.map(([a, b]) => [nomize(a), nomize(b)]),
      seed: seedOf(`${cfg.templateId}|${contenu.idee}`),
      ...layout,
    };
  }
  return {
    name: cfg.nom, initials: cfg.initiales, logo: cfg.logo, cible: cfg.cible, description: cfg.description,
    style: cfg.style, prix: cfg.prix, revenu: cfg.revenu,
    start: pages.some((p) => p.id === start) ? start : "accueil",
    pages,
    mods: Object.fromEntries(cfg.modules.map((m) => [m, true])),
    reglages: cfg.reglages,
    roles: cfg.roles,
    entity: { nom: t.entite.nom, pluriel: t.entite.pluriel, champs: t.entite.champs },
    rows: demo.rows, status: demo.status, statuses: demo.statuses, kpis: demo.kpis, serie: demo.serie,
    features: t.copy.features,
    seed: seedOf(cfg.templateId),
    ...layout,
  };
}

/** Sérialise sans risque dans une balise <script>. */
const safeScript = (s: string) => s.replace(/</g, "\\u003c");

export function renderPrototype(cfg: Config, start = "accueil", contenu?: Contenu, opts: ProtoOpts = {}): string {
  const data = prototypeData(cfg, start, contenu, opts);
  const runtime = protoRuntime.toString().replace(/<\/script/gi, "<\\/script");
  const font = policeOf(cfg);
  return `<!doctype html><html lang="fr" class="s-${cfg.style} shell-${data.shell} dash-${data.dash} anim-${data.anim}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${esc(cfg.nom)} — prototype</title>
${font.url ? `<link rel="stylesheet" href="${font.url}">` : ""}${cfg.style === "luxe" ? `<link rel="stylesheet" href="${POLICES.elegante.url}">` : ""}
<style>:root{--p:${cfg.couleurs.primaire};--a:${cfg.couleurs.accent};${STYLE_VARS[cfg.style]}${font.url ? `;--ff:${font.famille}` : ""}}${PROTO_CSS}${data.arch ? ARCH_CSS : ""}${STYLE_EXTRA[cfg.style]}${(cfg.design && PROTO_DESIGN_CSS[cfg.design]) || ""}</style></head>
<body><noscript>Ce prototype a besoin de JavaScript.</noscript>
<script>(${runtime})(${safeScript(JSON.stringify(data))}${data.arch ? `, ${protoArch.toString().replace(/<\/script/gi, "<\\/script")}` : ""});</script></body></html>`;
}
