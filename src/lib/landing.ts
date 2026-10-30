import { DEMO } from "@/data/demo";
import { DESIGN_BY_ID, type Anim } from "@/data/designs";
import { POLICES, policeOf } from "@/lib/config";
import { LANDING_DESIGN_CSS } from "@/lib/design-css";
import { TEMPLATE_BY_ID } from "@/data/templates";
import type { Config, Contenu, Landing, LandingLayout, LandingSection, LandingSectionType, Pricing, VisualStyle } from "@/lib/types";

export const SECTION_LABEL: Record<LandingSectionType, string> = {
  hero: "En-tête principal", features: "Fonctionnalités", etapes: "Fonctionnement", avantages: "Avantages", tarifs: "Tarifs", faq: "FAQ", cta: "Appel à l'action final",
};

export const LAYOUTS: Record<LandingLayout, { nom: string; description: string }> = {
  centre: { nom: "Centrée", description: "Titre centré, fonctionnalités en grille." },
  split: { nom: "Divisée", description: "Texte à gauche, aperçu du produit à droite." },
  editorial: { nom: "Éditoriale", description: "Grand titre, sections numérotées, colonne de lecture." },
};

const DETERMINANT = /^(les|des|la|le|l'|l’|tes|vos|ton|ta|ses|leurs|chaque|tout|toute|tous|toutes|un|une)\b/i;

/** Remplace {nom}, {cible} et {prix}, puis corrige les contractions (« à les » → « aux »). */
export function fill(text: string, cfg: Config): string {
  let cible = cfg.cible.trim().replace(/[.\s]+$/, "") || "tes utilisateurs";
  cible = cible[0]!.toLowerCase() + cible.slice(1);
  if (!DETERMINANT.test(cible)) cible = `les ${cible}`;
  return text
    .replaceAll("{nom}", cfg.nom || "Ton produit")
    .replaceAll("{cible}", cible)
    .replaceAll("{prix}", String(cfg.prix))
    .replace(/(^|\s)à les(?=\s)/g, "$1aux")
    .replace(/(^|\s)de les(?=\s)/g, "$1des");
}

/** Sections par défaut : textes remplis à partir de l'idée (contenu) ou, à défaut, du modèle. Déterministe. */
export function buildLanding(cfg: Config, contenu?: Contenu): Landing {
  const t = TEMPLATE_BY_ID[cfg.templateId].copy;
  const c = contenu
    ? { ...contenu.copy, features: contenu.fonctionnalites }
    : t;
  const f = (s: string) => fill(s, cfg);
  const s = (type: LandingSectionType, titre: string, texte: string, items: [string, string][] = []): LandingSection => ({
    id: type, type, visible: true, titre: f(titre), texte: f(texte), items: items.map(([a, b]) => ({ titre: f(a), texte: f(b) })),
  });
  const sections: LandingSection[] = [
    s("hero", c.heroTitre, c.heroSous),
    s("features", "Ce que fait {nom}", "Les fonctionnalités essentielles, sans superflu.", c.features),
    s("etapes", "Comment ça marche", "Trois étapes pour commencer.", c.etapes),
    s("avantages", "Pourquoi {nom}", "", c.avantages.map((a) => [a, ""])),
    s("tarifs", "Tarifs", "Des offres simples, sans engagement caché."),
    s("faq", "Questions fréquentes", "", c.faq),
    s("cta", c.cta, "Rejoins {nom} dès aujourd'hui."),
  ];
  if (cfg.revenu === "gratuit") sections.find((x) => x.type === "tarifs")!.visible = false;
  return { layout: "centre", sections, boutonPrincipal: "Commencer", boutonSecondaire: "Voir comment ça marche", edited: false };
}

/** Met à jour les textes liés au modèle tant que l'utilisateur ne les a pas modifiés à la main. */
export function syncLanding(cfg: Config, landing: Landing, contenu?: Contenu): Landing {
  if (landing.edited) return landing;
  const fresh = buildLanding(cfg, contenu);
  return { ...fresh, layout: landing.layout, sections: landing.sections.map((old) => ({ ...fresh.sections.find((x) => x.type === old.type)!, visible: old.visible })) };
}

export function moveSection(landing: Landing, index: number, dir: -1 | 1): Landing {
  const j = index + dir;
  // Le hero reste toujours en premier.
  if (index === 0 || j <= 0 || j >= landing.sections.length) return landing;
  const sections = [...landing.sections];
  [sections[index], sections[j]] = [sections[j]!, sections[index]!];
  return { ...landing, sections, edited: true };
}

const esc = (s: unknown) => String(s ?? "").replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[ch]!);

/** Période d'une offre : liste blanche, puis échappement. Toute autre valeur est ignorée (jamais insérée telle quelle). */
const PERIODE_HTML: Record<string, string> = { mois: " / mois", an: " / an", unique: " une fois" };
const periodeHtml = (p: unknown) => (typeof p === "string" && Object.hasOwn(PERIODE_HTML, p) ? esc(PERIODE_HTML[p]) : "");

function styleCss(style: VisualStyle, p: string, a: string): string {
  const base = `*{box-sizing:border-box}html{scroll-behavior:smooth}body{margin:0;-webkit-font-smoothing:antialiased}img{max-width:100%}
.wrap{max-width:1080px;margin:0 auto;padding:0 24px}section{padding:80px 0}
.top{display:flex;align-items:center;justify-content:space-between;gap:12px;padding-top:20px;padding-bottom:20px}
.brand{display:flex;align-items:center;gap:10px;font-weight:700}.mark{width:34px;height:34px;display:grid;place-items:center;font-weight:800;font-size:14px;overflow:hidden}
.mark img{width:100%;height:100%;object-fit:cover}.btn{display:inline-block;padding:13px 22px;text-decoration:none;font-weight:600;cursor:pointer}
.btns{display:flex;gap:12px;flex-wrap:wrap}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(230px,1fr));gap:20px}
.card h3{margin:0 0 8px;font-size:19px}.card p{margin:0}.lead{font-size:20px;max-width:620px}
.price{font-size:40px;font-weight:800;margin:8px 0}.price small{font-size:15px;font-weight:500;opacity:.6}
ul.ticks{padding:0;list-style:none;margin:14px 0 0}ul.ticks li{padding:4px 0 4px 24px;position:relative}ul.ticks li:before{content:"✓";position:absolute;left:0;color:${a};font-weight:800}
details{padding:18px 0;border-bottom:1px solid rgba(0,0,0,.1)}summary{cursor:pointer;font-weight:600;font-size:17px}details p{margin:10px 0 0;opacity:.75}
footer{padding:36px 0;font-size:14px;opacity:.7}.mock{border-radius:inherit}.mock table{width:100%;border-collapse:collapse;font-size:14px}.mock td,.mock th{text-align:left;padding:9px 10px;border-bottom:1px solid rgba(0,0,0,.08)}
@media(max-width:760px){section{padding:56px 0}.split{grid-template-columns:1fr!important}.lead{font-size:18px}}`;
  if (style === "minimal")
    return `${base}body{font:17px/1.7 Georgia,"Times New Roman",serif;color:#111;background:#fff}h1,h2{font-weight:400;letter-spacing:-.01em}
h1{font-size:clamp(40px,6vw,64px);line-height:1.08;margin:0 0 20px}h2{font-size:34px;margin:0 0 28px}
.btn{border:1px solid #111;color:#111;font-family:system-ui,sans-serif;font-size:15px}.btn.primary{background:#111;color:#fff}
.mark{border:1px solid #111;font-family:system-ui}.card{border-top:1px solid #111;padding-top:18px}.lead,.muted{color:#555}
.tint{background:#fafafa;border-top:1px solid #eee;border-bottom:1px solid #eee}.hl{border-top:3px solid ${p}}.mock{border:1px solid #111;background:#fff}`;
  if (style === "audacieux")
    return `${base}body{font:17px/1.6 system-ui,-apple-system,"Segoe UI",sans-serif;color:#0b0b0b;background:#fffdf5}
h1,h2{font-weight:900;text-transform:uppercase;letter-spacing:-.02em;line-height:.98}h1{font-size:clamp(44px,8vw,92px);margin:0 0 22px}h2{font-size:clamp(30px,4vw,44px);margin:0 0 30px}
.btn{border:3px solid #0b0b0b;color:#0b0b0b;background:#fff;box-shadow:5px 5px 0 #0b0b0b;transition:transform .15s,box-shadow .15s}.btn:hover{transform:translate(2px,2px);box-shadow:3px 3px 0 #0b0b0b}
.btn.primary{background:${a};}.mark{background:${p};color:#fff;border:3px solid #0b0b0b}
.card{border:3px solid #0b0b0b;padding:24px;background:#fff;box-shadow:6px 6px 0 #0b0b0b}.lead,.muted{color:#333}
.tint{background:${p};color:#fff}.tint .card{color:#0b0b0b}.tint>.wrap>.lead,.tint>.wrap>.muted,.tint .wrap>p.muted{color:#fff;opacity:.88}.hl{background:${a}}.hl ul.ticks li:before{color:#0b0b0b}.mock{border:3px solid #0b0b0b;background:#fff;box-shadow:8px 8px 0 #0b0b0b}`;
  if (style === "neon")
    return `${base}body{font:17px/1.6 system-ui,-apple-system,"Segoe UI",sans-serif;color:#e6f6ff;background:#05060f}
h1,h2{letter-spacing:-.025em;line-height:1.06}h1{font-size:clamp(42px,7vw,76px);margin:0 0 20px;text-shadow:0 0 40px ${p}66}h2{font-size:clamp(28px,4vw,42px);margin:0 0 28px}
.btn{border-radius:12px;background:rgba(255,255,255,.06);color:#e6f6ff;border:1px solid rgba(120,220,255,.25);transition:transform .15s,box-shadow .2s}.btn:hover{transform:translateY(-1px)}
.btn.primary{background:${p};color:#05060f;border-color:${p};box-shadow:0 0 30px -4px ${p}}.mark{border-radius:10px;background:linear-gradient(135deg,${p},${a});color:#05060f}
.card{border:1px solid rgba(120,220,255,.16);border-radius:18px;padding:24px;background:#0c0f22;box-shadow:0 0 40px -24px ${p}}.lead,.muted{color:#8ea3c9}
.tint{background:#0a0d1d}.hero-bg{background:radial-gradient(60% 60% at 50% 0%,${p}33,transparent 70%)}details{border-color:rgba(255,255,255,.1)}
.hl{border:1px solid ${p};box-shadow:0 0 50px -16px ${p}}.mock{border:1px solid rgba(120,220,255,.25);border-radius:18px;background:#fff;box-shadow:0 0 80px -30px ${p}}.wl input[type=email]{background:#0c0f22;color:#e6f6ff;border-color:rgba(120,220,255,.3)}`;
  if (style === "pastel")
    return `${base}body{font:17px/1.6 system-ui,-apple-system,"Segoe UI",sans-serif;color:#2e1065;background:#fbf7ff}
h1,h2{letter-spacing:-.02em;line-height:1.08}h1{font-size:clamp(40px,6.5vw,68px);margin:0 0 20px}h2{font-size:clamp(28px,4vw,40px);margin:0 0 28px}
.btn{border-radius:99px;background:#fff;color:#2e1065;border:1px solid ${p}33;transition:transform .15s}.btn:hover{transform:translateY(-2px)}
.btn.primary{background:linear-gradient(120deg,${p},${a});color:#fff;border:0;box-shadow:0 12px 28px -12px ${p}}.mark{border-radius:50%;background:linear-gradient(135deg,${p},${a});color:#fff}
.card{border:1px solid ${p}22;border-radius:28px;padding:26px;background:#fff;box-shadow:0 16px 40px -28px ${p}}.lead,.muted{color:#6b5b8c}
.tint{background:linear-gradient(180deg,${p}12,${a}12)}.hero-bg{background:radial-gradient(60% 60% at 30% 0%,${p}26,transparent 70%),radial-gradient(50% 50% at 80% 10%,${a}26,transparent 70%)}
.hl{border:2px solid ${p}66}.mock{border:1px solid ${p}22;border-radius:28px;background:#fff;box-shadow:0 30px 60px -30px ${p}}.wl input[type=email]{border-radius:99px}`;
  if (style === "luxe")
    return `${base}body{font:17px/1.7 system-ui,-apple-system,"Segoe UI",sans-serif;color:#1c1917;background:#f7f3ec}
h1,h2{font-family:"Playfair Display",Georgia,serif;font-weight:500;letter-spacing:-.01em;line-height:1.08}h1{font-size:clamp(42px,6.5vw,72px);margin:0 0 22px}h2{font-size:clamp(30px,4vw,44px);margin:0 0 30px}
.btn{border-radius:2px;background:transparent;color:#1c1917;border:1px solid #1c1917;letter-spacing:.08em;text-transform:uppercase;font-size:13px}.btn.primary{background:#1c1917;color:#f7f3ec}
.mark{border-radius:2px;background:${p};color:#fff;font-family:"Playfair Display",Georgia,serif}.card{border-top:1px solid ${p};padding:26px 4px 0}.card h3{font-family:"Playfair Display",Georgia,serif;font-weight:500;font-size:22px}
.lead,.muted{color:#78716c}.tint{background:#efe8dc}.hero-bg{background:radial-gradient(50% 60% at 50% 0%,${p}1f,transparent 70%)}.hl{border-top:3px solid ${p}}
.mock{border:1px solid #d6cbb8;background:#fff;box-shadow:0 30px 60px -36px rgba(28,25,23,.4)}.price{font-family:"Playfair Display",Georgia,serif;font-weight:500}.wl input[type=email]{border-radius:2px}`;
  return `${base}body{font:17px/1.6 system-ui,-apple-system,"Segoe UI",sans-serif;color:#0f172a;background:#fff}
h1,h2{letter-spacing:-.025em;line-height:1.08}h1{font-size:clamp(40px,6.5vw,70px);margin:0 0 20px}h2{font-size:clamp(28px,4vw,40px);margin:0 0 28px}
.btn{border-radius:12px;background:#f1f5f9;color:#0f172a;transition:transform .15s,box-shadow .2s}.btn:hover{transform:translateY(-1px)}
.btn.primary{background:${p};color:#fff;box-shadow:0 10px 24px -10px ${p}}.mark{border-radius:10px;background:${p};color:#fff}
.card{border:1px solid #e2e8f0;border-radius:18px;padding:24px;background:#fff}.lead,.muted{color:#475569}
.tint{background:linear-gradient(180deg,${p}0d,${a}0d)}.hero-bg{background:radial-gradient(60% 60% at 50% 0%,${p}22,transparent 70%)}
.hl{border:2px solid ${p};box-shadow:0 24px 50px -28px ${p}}.mock{border:1px solid #e2e8f0;border-radius:18px;background:#fff;box-shadow:0 30px 60px -30px rgba(15,23,42,.35)}`;
}

function layoutCss(layout: LandingLayout): string {
  if (layout === "split") return `.hero .split{display:grid;grid-template-columns:1.05fr .95fr;gap:48px;align-items:center}.feat-rows .card{display:grid;grid-template-columns:48px 1fr;gap:16px;align-items:start}.feat-rows{display:grid;gap:16px;max-width:760px}`;
  if (layout === "editorial") return `.hero h1{max-width:900px}.ed{max-width:760px}.ed h2{display:flex;gap:16px;align-items:baseline}.ed h2 .n{font-size:15px;opacity:.5;font-weight:600}.ed .grid{grid-template-columns:1fr}`;
  return `.hero{text-align:center}.hero .lead{margin-left:auto;margin-right:auto}.hero .btns{justify-content:center}h2{text-align:center}`;
}

// Animations : apparition au défilement (activée par le script, sinon tout reste visible),
// halos du hero, titre mot par mot, aperçu flottant, survols. Désactivées si l'utilisateur réduit les animations.
function motionCss(style: VisualStyle, p: string, a: string): string {
  const orb = style === "minimal" ? 0.12 : style === "audacieux" ? 0.5 : 0.32;
  const hover = style === "audacieux" ? ".card:hover{transform:translate(-3px,-3px);box-shadow:9px 9px 0 #0b0b0b}" : ".card:hover{transform:translateY(-5px);box-shadow:0 24px 48px -28px rgba(15,23,42,.35)}";
  return `.js .rv{opacity:0;transform:translateY(26px);transition:opacity .8s cubic-bezier(.2,.7,.2,1),transform .8s cubic-bezier(.2,.7,.2,1);transition-delay:calc(var(--i,0) * 90ms)}.js .rv.in{opacity:1;transform:none}
.hero{position:relative;overflow:hidden;isolation:isolate}.orb{position:absolute;border-radius:50%;filter:blur(${style === "audacieux" ? 0 : 70}px);z-index:-1;opacity:${orb};animation:orb 12s ease-in-out infinite;pointer-events:none}
.orb.o1{width:420px;height:420px;background:${p};top:-180px;left:-140px}.orb.o2{width:360px;height:360px;background:${a};bottom:-160px;right:-120px;animation-direction:reverse}@keyframes orb{50%{transform:translate(50px,40px) scale(1.12)}}
.w{display:inline-block;opacity:0;transform:translateY(.35em);animation:w .8s cubic-bezier(.2,.7,.2,1) forwards;animation-delay:calc(var(--w) * 70ms + 80ms)}@keyframes w{to{opacity:1;transform:none}}
.fade-in{opacity:0;animation:w .9s .5s cubic-bezier(.2,.7,.2,1) forwards}
.card{transition:transform .3s cubic-bezier(.2,.7,.2,1),box-shadow .3s}${hover}
.mock.fade-in{animation:w .9s .5s cubic-bezier(.2,.7,.2,1) forwards,floaty 7s 1.5s ease-in-out infinite}@keyframes floaty{50%{transform:translateY(-10px)}}
.mock-wide{max-width:920px;margin:64px auto 0}.btn.primary{position:relative;overflow:hidden}.btn.primary::after{content:"";position:absolute;inset:0;background:linear-gradient(120deg,transparent 30%,rgba(255,255,255,.35) 50%,transparent 70%);transform:translateX(-100%);transition:transform .6s}.btn.primary:hover::after{transform:translateX(100%)}
.ic{width:44px;height:44px;border-radius:12px;display:grid;place-items:center;background:${p}1a;color:${p};margin-bottom:14px;transition:transform .3s}.card:hover .ic{transform:rotate(-8deg) scale(1.08)}
details summary{transition:color .2s}details summary:hover{color:${p}}details[open] p{animation:w .4s forwards}
.app{display:grid;grid-template-columns:150px 1fr;text-align:left;font:13px/1.45 system-ui,sans-serif;color:#0f172a}.app-side{background:#f8fafc;border-right:1px solid #e2e8f0;padding:14px 10px;display:grid;gap:4px;align-content:start}
.app-side b{display:flex;gap:8px;align-items:center;margin-bottom:10px}.app-side i{display:block;padding:7px 9px;border-radius:8px;color:#64748b;font-style:normal}.app-side i:first-of-type{background:${p}1a;color:${p};font-weight:600}
.app-main{padding:16px;display:grid;gap:12px}.app-kpis{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}.app-kpis div{border:1px solid #e2e8f0;border-radius:10px;padding:10px;background:#fff}.app-kpis b{display:block;font-size:20px;letter-spacing:-.02em}
.app-kpis span{color:#64748b;font-size:11.5px}.app-row{display:flex;justify-content:space-between;gap:10px;align-items:center;padding:8px 10px;border:1px solid #f1f5f9;border-radius:9px;background:#fff}.pill{font-size:11px;font-weight:650;padding:2px 8px;border-radius:99px;background:${p}1a;color:${p};white-space:nowrap}
.bar{display:flex;gap:6px;padding:10px 14px;border-bottom:1px solid #e2e8f0}.bar i{width:9px;height:9px;border-radius:50%;background:#e2e8f0;display:block}
@media(max-width:620px){.app{grid-template-columns:1fr}.app-side{display:none}}
.wl{display:flex;gap:8px;flex-wrap:wrap;max-width:520px;margin:0 auto;justify-content:center}.wl input[type=email]{flex:1;min-width:220px;padding:14px 16px;border:1.5px solid #cbd5e1;border-radius:12px;font:inherit;background:#fff;color:#0f172a}.wl input[type=email]:focus{outline:none;border-color:${p};box-shadow:0 0 0 4px ${p}33}
.wl-note{width:100%;font-size:13.5px;margin:6px 0 0;text-align:center}.hp{position:absolute;left:-9999px;width:1px;height:1px;opacity:0}
.wl-banner{position:sticky;top:0;z-index:10;text-align:center;padding:12px;font-weight:600;font-family:system-ui,sans-serif}.wl-banner.ok{background:#dcfce7;color:#14532d}.wl-banner.bad{background:#ffe4e6;color:#881337}
.wl-rgpd{width:100%;font-size:12.5px;line-height:1.5;margin:2px 0 0;text-align:center}.wl-rgpd a{color:inherit;text-decoration:underline}
.split .wl{margin:0;justify-content:flex-start}.split .wl-note,.split .wl-rgpd{text-align:left}
@media(prefers-reduced-motion:reduce){*,*::before,*::after{animation:none!important;transition:none!important}.w,.fade-in{opacity:1;transform:none}}`;
}

// Animations propres à chaque design : comment les blocs apparaissent au défilement.
const DESIGN_MOTION: Record<Anim, string> = {
  rise: "",
  glow: `.js .rv{transform:scale(.96);filter:brightness(1.6)}.js .rv.in{filter:none}h1{animation:glowp 3.5s ease-in-out infinite}@keyframes glowp{50%{text-shadow:0 0 50px currentColor}}`,
  pop: `.js .rv{transform:scale(.82);transition-timing-function:cubic-bezier(.34,1.56,.64,1)}`,
  slow: `.js .rv{transform:none;transition-duration:1.5s}.w{animation-duration:1.4s}`,
  hard: `.js .rv{transform:translate(-24px,24px);transition-timing-function:cubic-bezier(.8,0,.2,1);transition-duration:.45s}`,
  blur: `.js .rv{transform:none;filter:blur(12px)}.js .rv.in{filter:none}.w{filter:blur(8px);animation-name:wblur}@keyframes wblur{to{opacity:1;transform:none;filter:none}}`,
  slide: `.js .rv{transform:translateX(-60px)}`,
  flip: `.js .rv{transform:perspective(800px) rotateX(-38deg);transform-origin:top}`,
  type: `.w{animation:wtype .05s steps(1) forwards;animation-delay:calc(var(--w) * 120ms + 100ms);transform:none}@keyframes wtype{to{opacity:1}}.js .rv{transform:translateY(8px)}`,
  cascade: `.js .rv{transform:translateY(30px) scale(.92);transition-delay:calc(var(--i,0) * 160ms)}`,
};

export function landingCss(cfg: Config, landing: Landing) {
  const { primaire: p, accent: a } = cfg.couleurs;
  const font = policeOf(cfg);
  const fontCss = font.url ? `body,.btn{font-family:${font.famille}}${cfg.police === "elegante" ? "" : `h1,h2{font-family:${font.famille}}`}` : "";
  const design = cfg.design ? DESIGN_BY_ID[cfg.design] : undefined;
  const designCss = design ? `${LANDING_DESIGN_CSS[design.id]?.(p, a) ?? ""}${DESIGN_MOTION[design.anim]}@media(prefers-reduced-motion:reduce){.w,.rv{filter:none!important;opacity:1!important;transform:none!important}h1{animation:none!important}}` : "";
  return styleCss(cfg.style, p, a) + layoutCss(landing.layout) + motionCss(cfg.style, p, a) + fontCss + designCss;
}

/** Feuilles de polices à charger (police choisie + police de titres du style Luxe). */
const fontLinks = (cfg: Config) =>
  [...new Set([policeOf(cfg).url, cfg.style === "luxe" ? POLICES.elegante.url : ""].filter(Boolean))].map((u) => `<link rel="stylesheet" href="${u}">`).join("");

const ICON_PATHS = ["M4 4h7v7H4zM13 4h7v4h-7zM13 10h7v10h-7zM4 13h7v7H4z", "M5 13l4 4L19 7", "M12 7v5l3 2M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z", "M4 19h16M6 16l4-5 3 3 5-7", "M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z", "M6 16V11a6 6 0 1 1 12 0v5l2 2H4zM10 20h4"];
const ic = (i: number) => `<span class="ic"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${ICON_PATHS[i % ICON_PATHS.length]}"/></svg></span>`;

const REVEAL_SCRIPT = `<script>(function(){var d=document.documentElement;if(!("IntersectionObserver" in window)||matchMedia("(prefers-reduced-motion: reduce)").matches)return;d.classList.add("js");var io=new IntersectionObserver(function(es){es.forEach(function(e){if(e.isIntersecting){e.target.classList.add("in");io.unobserve(e.target)}})},{rootMargin:"0px 0px -8% 0px"});document.querySelectorAll(".rv").forEach(function(el){io.observe(el)})})();</script>`;

/** Corps HTML de la landing. `inlineCss` = un seul fichier (aperçu) ; sinon lien vers style.css (export). */
/** Liste d'attente : `action` = URL d'envoi du formulaire (null = aperçu, rien n'est envoyé). */
export type WaitlistOpts = { action: string | null; merci?: boolean; erreur?: boolean; appHref?: string };

export function renderLanding(cfg: Config, landing: Landing, pricing: Pricing | null, opts: { inlineCss: boolean; waitlist?: WaitlistOpts; contenu?: Contenu }): string {
  const wl = opts.waitlist;
  const form = (id: string) =>
    `<form class="wl" id="${id}" method="post" ${wl!.action ? `action="${esc(wl!.action)}"` : `onsubmit="event.preventDefault();this.querySelector('.wl-note').textContent='Aperçu : rien n’est envoyé tant que le site n’est pas publié.'"`}><input type="email" name="email" required maxlength="254" placeholder="ton@email.fr" aria-label="Ton adresse email"><input type="text" name="site" class="hp" tabindex="-1" autocomplete="off" aria-hidden="true"><button class="btn primary">${esc(landing.boutonPrincipal)}</button><p class="wl-note muted">Inscris-toi pour être prévenu·e du lancement.</p><p class="wl-rgpd muted">Ton adresse e-mail sert uniquement à te prévenir du lancement de ${esc(cfg.nom)} : elle est collectée pour le compte de l’éditeur de ce site. Pour exercer tes droits (accès, suppression…), utilise le contact indiqué dans la <a href="/confidentialite" target="_blank" rel="noopener">politique de confidentialité</a> de Décollage, qui héberge ce site.</p></form>`;
  const t = TEMPLATE_BY_ID[cfg.templateId];
  const mark = cfg.logo ? `<img src="${esc(cfg.logo)}" alt="">` : esc(cfg.initiales);
  const head = `<div class="wrap top"><div class="brand"><span class="mark">${mark}</span>${esc(cfg.nom)}</div><a class="btn primary" href="#cta">${esc(landing.boutonPrincipal)}</a></div>`;
  let n = 0;
  const num = () => (landing.layout === "editorial" ? `<span class="n">0${++n}</span>` : "");

  // Aperçu du produit : mini-interface avec menu, chiffres et éléments d'exemple.
  const base = DEMO[cfg.templateId];
  const demo = opts.contenu ? { ...base, kpis: opts.contenu.kpis, rows: opts.contenu.lignes } : base;
  const mock = `<div class="mock ${landing.layout === "split" ? "" : "mock-wide"} fade-in" style="overflow:hidden;padding:0"><div class="bar"><i></i><i></i><i></i></div><div class="app"><div class="app-side"><b><span class="mark" style="width:24px;height:24px;font-size:10px">${mark}</span>${esc(cfg.nom)}</b>${t.pages.slice(0, 4).map((pg) => `<i>${esc(pg.titre)}</i>`).join("")}</div><div class="app-main"><div class="app-kpis">${demo.kpis.map(([l, v, u]) => `<div><b>${esc(v.toLocaleString("fr-FR"))}${esc(u)}</b><span>${esc(l)}</span></div>`).join("")}</div>${demo.rows.slice(0, landing.layout === "split" ? 3 : 4).map((r) => `<div class="app-row"><span><b>${esc(r[0])}</b> <span class="muted">· ${esc(r[1])}</span></span><span class="pill">${esc(r[demo.status])}</span></div>`).join("")}<span class="muted" style="font-size:11px">Données d'exemple</span></div></div></div>`;
  const words = (s: string) => s.split(" ").map((w, i) => `<span class="w" style="--w:${i}">${esc(w)}</span>`).join(" ");

  const offres = pricing?.offres.length ? pricing.offres : [{ id: "x", nom: "Offre", prix: cfg.prix, periode: "mois" as const, features: [] }];

  const body = landing.sections.filter((s) => s.visible).map((s) => {
    switch (s.type) {
      case "hero": {
        const actions = wl
          ? `<div class="fade-in">${form("inscription")}${wl.appHref ? `<a class="btn" href="${esc(wl.appHref)}" style="margin-top:12px">Voir la démo de l'application →</a>` : ""}</div>`
          : `<div class="btns fade-in"><a class="btn primary" href="#cta">${esc(landing.boutonPrincipal)}</a><a class="btn" href="#etapes">${esc(landing.boutonSecondaire)}</a></div>`;
        const text = `<h1>${words(s.titre)}</h1><p class="lead fade-in">${esc(s.texte)}</p>${actions}`;
        return `<section class="hero hero-bg"><span class="orb o1"></span><span class="orb o2"></span><div class="wrap">${landing.layout === "split" ? `<div class="split"><div>${text}</div>${mock}</div>` : text + mock}</div></section>`;
      }
      case "features": {
        const cards = s.items.map((x, i) => `<div class="card rv" style="--i:${i}">${landing.layout === "split" ? `${ic(i)}<div>` : ic(i)}<h3>${esc(x.titre)}</h3><p class="muted">${esc(x.texte)}</p>${landing.layout === "split" ? "</div>" : ""}</div>`).join("");
        return `<section id="features"><div class="wrap ed"><h2 class="rv">${num()}${esc(s.titre)}</h2>${s.texte ? `<p class="lead muted rv" style="margin:-12px 0 28px">${esc(s.texte)}</p>` : ""}<div class="${landing.layout === "split" ? "feat-rows" : "grid"}">${cards}</div></div></section>`;
      }
      case "etapes":
        return `<section id="etapes" class="tint"><div class="wrap ed"><h2 class="rv">${num()}${esc(s.titre)}</h2><div class="grid">${s.items.map((x, i) => `<div class="card rv" style="--i:${i}"><div class="price" style="font-size:28px">${i + 1}.</div><h3>${esc(x.titre)}</h3><p class="muted">${esc(x.texte)}</p></div>`).join("")}</div></div></section>`;
      case "avantages":
        return `<section><div class="wrap ed"><h2 class="rv">${num()}${esc(s.titre)}</h2><ul class="ticks" style="font-size:19px">${s.items.map((x, i) => `<li class="rv" style="--i:${i}">${esc(x.titre)}</li>`).join("")}</ul></div></section>`;
      case "tarifs":
        return `<section id="tarifs" class="tint"><div class="wrap ed"><h2 class="rv">${num()}${esc(s.titre)}</h2>${s.texte ? `<p class="lead muted rv" style="margin:-12px 0 28px">${esc(s.texte)}</p>` : ""}<div class="grid">${offres.map((o, i) => `<div class="card rv${i === Math.min(1, offres.length - 1) && offres.length > 1 ? " hl" : ""}" style="--i:${i}"><h3>${esc(o.nom)}</h3><div class="price">${o.prix === 0 ? "Gratuit" : `${esc(o.prix)} €<small>${periodeHtml(o.periode)}</small>`}</div><ul class="ticks">${o.features.filter((f) => f.trim()).map((f) => `<li>${esc(f)}</li>`).join("")}</ul></div>`).join("")}</div></div></section>`;
      case "faq":
        return `<section><div class="wrap ed" style="max-width:760px"><h2 class="rv">${num()}${esc(s.titre)}</h2>${s.items.map((x, i) => `<details class="rv" style="--i:${i}"><summary>${esc(x.titre)}</summary><p>${esc(x.texte)}</p></details>`).join("")}</div></section>`;
      case "cta":
        return `<section id="cta" class="tint" style="text-align:center"><div class="wrap rv"><h2 style="text-align:center">${esc(s.titre)}</h2><p class="lead muted" style="margin:0 auto 28px">${esc(s.texte)}</p>${wl ? form("inscription-fin") : `<a class="btn primary" href="#cta">${esc(landing.boutonPrincipal)}</a>`}</div></section>`;
    }
  }).join("\n");

  const foot = `<footer><div class="wrap" style="display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap"><span>© ${new Date().getFullYear()} ${esc(cfg.nom)}</span><span>${cfg.domaine ? esc(cfg.domaine) : ""}</span></div></footer>`;
  const css = opts.inlineCss ? `<style>${landingCss(cfg, landing)}</style>` : `<link rel="stylesheet" href="style.css">`;
  const hero = landing.sections.find((s) => s.type === "hero");
  return `<!doctype html>
<html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(cfg.nom)}</title><meta name="description" content="${esc(hero?.texte ?? cfg.description)}">${fontLinks(cfg)}${css}</head>
<body>${wl?.merci ? `<div class="wl-banner ok" role="status">✓ Merci ! Ton inscription est enregistrée.</div>` : wl?.erreur ? `<div class="wl-banner bad" role="alert">Adresse invalide ou inscription impossible. Réessaie.</div>` : ""}${head}
${body}
${foot}${REVEAL_SCRIPT}</body></html>`;
}

/** Texte brut de la landing, pour le bouton « Copier le texte ». */
export function landingText(landing: Landing): string {
  return landing.sections.filter((s) => s.visible).map((s) => [s.titre, s.texte, ...s.items.map((i) => (i.texte ? `- ${i.titre} : ${i.texte}` : `- ${i.titre}`))].filter(Boolean).join("\n")).join("\n\n");
}
