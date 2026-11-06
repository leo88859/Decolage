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
  bento: { nom: "Grille animée", description: "Titre en dégradé, aperçu sous faisceau lumineux, bandeau défilant, tuiles bento." },
  dashboard: { nom: "Tableau de bord", description: "Aperçu avec courbe qui se dessine, chiffres qui comptent, rangées alternées." },
  prestige: { nom: "Prestige", description: "En-tête sombre, citations en relief, services numérotés. Pour le conseil et le haut de gamme." },
  immersif: { nom: "Immersive", description: "En-tête plein écran au fond animé, grands panneaux. Pour une ambiance forte." },
  catalogue: { nom: "Catalogue", description: "Grand visuel rond, étiquettes de prix, grille de produits. Pour une boutique." },
};
/** Mises en page avec leurs propres blocs (au-delà de la grille de cartes classique). */
const RICHE = new Set<LandingLayout>(["bento", "dashboard", "prestige", "immersif", "catalogue"]);

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

function layoutCss(layout: LandingLayout, p: string, a: string): string {
  const centre = `.hero{text-align:center}.hero .lead{margin-left:auto;margin-right:auto}.hero .btns,.hero .wl{justify-content:center}h2{text-align:center}`;
  const deux = (g: string) => `.hero .split{display:grid;grid-template-columns:${g};gap:52px;align-items:center}`;
  if (layout === "split") return `${deux("1.05fr .95fr")}.feat-rows .card{display:grid;grid-template-columns:48px 1fr;gap:16px;align-items:start}.feat-rows{display:grid;gap:16px;max-width:760px}`;
  if (layout === "editorial") return `.hero h1{max-width:900px}.ed{max-width:760px}.ed h2{display:flex;gap:16px;align-items:baseline}.ed h2 .n{font-size:15px;opacity:.5;font-weight:600}.ed .grid{grid-template-columns:1fr}`;
  // Grille animée (effets à la Magic UI) : fond quadrillé, titre en dégradé, tuiles bento de tailles variées.
  if (layout === "bento") return `${centre}.hero{padding:120px 0 40px}.mock-wide{max-width:980px}
.bento{display:grid;grid-template-columns:repeat(3,1fr);grid-auto-rows:minmax(190px,auto);gap:16px}.bento .card{display:flex;flex-direction:column;justify-content:flex-end}
.bento .card:nth-child(1){grid-column:span 2;grid-row:span 2;background-image:radial-gradient(circle at 85% 15%,${p}2e,transparent 55%)}.bento .card:nth-child(1) h3{font-size:30px}.bento .card:nth-child(1) .ic{width:64px;height:64px;border-radius:18px;margin-bottom:auto}
.bento .card:nth-child(4){grid-column:span 2;background-image:radial-gradient(circle at 10% 90%,${a}2e,transparent 55%)}
@media(max-width:760px){.bento{grid-template-columns:1fr}.bento .card{grid-column:auto!important;grid-row:auto!important}}`;
  // Tableau de bord (inspiré du modèle « Finance ») : aperçu avec courbe qui se dessine, rangées alternées.
  if (layout === "dashboard") return `${deux("1fr 1.12fr")}.hero{padding:96px 0 64px}
.chart{padding:16px 18px 8px;border-top:1px solid #e2e8f0}.chart svg{width:100%;height:120px;display:block}.chart .l{fill:none;stroke:${p};stroke-width:3;stroke-linecap:round;stroke-dasharray:1000;stroke-dashoffset:1000;animation:draw 2.4s .6s cubic-bezier(.6,0,.2,1) forwards}.chart .f{opacity:0;animation:w 1s 2.2s forwards}@keyframes draw{to{stroke-dashoffset:0}}
.rows{display:grid;gap:56px}.row{display:grid;grid-template-columns:1fr 1fr;gap:56px;align-items:center}.row:nth-child(even) .viz{order:-1}.row h3{font-size:26px;margin:0 0 10px}
.viz{aspect-ratio:16/10;border-radius:22px;display:grid;place-items:center;background:radial-gradient(circle at 25% 25%,${p}3a,transparent 58%),radial-gradient(circle at 80% 75%,${a}33,transparent 58%),${p}0d;border:1px solid ${p}22}.viz .ic{transform:scale(1.9);margin:0}
@media(max-width:760px){.row{grid-template-columns:1fr;gap:20px}.row .viz{order:0!important}}`;
  // Prestige (inspiré du modèle « Lawgroup ») : bandeau sombre, citations qui chevauchent, services numérotés.
  if (layout === "prestige") return `${deux("1.25fr .75fr")}.hero{padding:110px 0 160px;color:#fff;background:linear-gradient(160deg,color-mix(in srgb,${p} 30%,#0b0b12),#0b0b12)}
.hero h1{color:#fff;text-shadow:none}.hero .lead{color:#ffffffd0!important}.hero .btn{background:transparent;color:#fff;border:1px solid #ffffff80}.hero .btn.primary{background:#fff;color:#0b0b12;border-color:#fff}.hero .orb{display:none}
.hstats{display:grid;gap:22px;border-left:1px solid #ffffff40;padding-left:28px}.hstats b{display:block;font-size:44px;line-height:1;letter-spacing:-.02em}.hstats span{color:#ffffffb0;font-size:14px}
.quotes{display:grid;grid-template-columns:repeat(3,1fr);gap:18px;margin-top:-100px;position:relative;z-index:2}.quotes .card{background:#fff;color:#16161d;border:0;border-top:4px solid ${p};border-radius:6px;padding:26px;box-shadow:0 30px 60px -30px #0007}.quotes .card p{font-size:18px;font-style:italic}.quotes .card p::before{content:"“";display:block;font-size:54px;line-height:.6;color:${p};font-style:normal}
.svc .card{display:grid;grid-template-columns:72px 1fr 1.3fr;gap:24px;align-items:baseline;border:0;border-top:1px solid currentColor;border-radius:0;padding:28px 4px;background:transparent;box-shadow:none}.svc .card:last-child{border-bottom:1px solid currentColor}.svc .card:hover{transform:translateX(10px);box-shadow:none}.svc .no{font-size:34px;color:${p};font-weight:500}
@media(max-width:760px){.quotes{grid-template-columns:1fr;margin-top:-70px}.svc .card{grid-template-columns:1fr;gap:6px}.hstats{border-left:0;padding-left:0}}`;
  // Immersive (inspirée de « Bistro » et « Brick Property ») : plein écran, fond animé, grands panneaux.
  if (layout === "immersif") return `${centre}.hero{min-height:92vh;display:grid;align-items:center;color:#fff;background:#0b0b0f}.hero .orb{display:none}
.hero::before{content:"";position:absolute;inset:-25%;z-index:-2;background:radial-gradient(38% 48% at 22% 30%,${p},transparent 70%),radial-gradient(42% 52% at 78% 62%,${a},transparent 70%),radial-gradient(34% 40% at 50% 105%,${p},transparent 70%);filter:blur(50px) saturate(1.15);animation:mesh 18s ease-in-out infinite alternate}
.hero::after{content:"";position:absolute;inset:0;z-index:-1;background:linear-gradient(180deg,#0000004d,#000000a6)}@keyframes mesh{to{transform:rotate(14deg) scale(1.18)}}
.hero h1{color:#fff;font-size:clamp(46px,8vw,104px);text-shadow:0 6px 40px #0008}.hero .lead{color:#ffffffe0!important}.hero .btn{background:#ffffff1f;color:#fff;border:1px solid #ffffff66;backdrop-filter:blur(6px)}.hero .btn.primary{background:#fff;color:#111;border-color:#fff}
.cue{position:absolute;left:50%;bottom:30px;width:26px;height:42px;border:2px solid #ffffffb0;border-radius:20px;transform:translateX(-50%)}.cue::after{content:"";position:absolute;left:50%;top:8px;width:4px;height:8px;margin-left:-2px;border-radius:2px;background:#fff;animation:cue 1.8s infinite}@keyframes cue{to{transform:translateY(14px);opacity:0}}
.panels{display:grid;gap:22px}.panels .card{display:grid;grid-template-columns:1fr 1fr;min-height:300px;padding:0;overflow:hidden}.panels .pic{background:linear-gradient(135deg,hsl(var(--h) 55% 55%),hsl(calc(var(--h) + 50) 60% 35%));display:grid;place-items:center;transition:transform .6s}.panels .card:hover .pic{transform:scale(1.04)}.panels .pic .ic{background:#ffffff26;color:#fff;transform:scale(1.7)}
.panels .txt{padding:44px;align-self:center}.panels .txt h3{font-size:28px}.panels .card:nth-child(even) .pic{order:2}
@media(max-width:760px){.panels .card{grid-template-columns:1fr}.panels .pic{min-height:180px;order:0!important}.panels .txt{padding:26px}}`;
  // Catalogue (inspiré de « Nutrio ») : grand visuel rond qui tourne, étiquettes de prix, grille de produits.
  return `${deux("1fr 1fr")}.hero{padding:90px 0}
.orbit{position:relative;aspect-ratio:1;max-width:460px;width:100%;margin:0 auto}.orbit::before{content:"";position:absolute;inset:0;border-radius:50%;border:2px dashed ${p}77;animation:spin 36s linear infinite}@keyframes spin{to{transform:rotate(360deg)}}
.disc{position:absolute;inset:9%;border-radius:50%;background:radial-gradient(circle at 32% 28%,#ffffff8c,transparent 42%),linear-gradient(140deg,${p},${a});box-shadow:0 44px 80px -34px ${p};display:grid;place-items:center;font-size:clamp(64px,10vw,124px);font-weight:800;color:#ffffffa6;overflow:hidden}.disc img{width:100%;height:100%;object-fit:cover}
.ptag{position:absolute;background:#fff;color:#111;border-radius:16px;padding:10px 16px;font-size:13.5px;box-shadow:0 16px 34px -16px #0008;animation:floaty 6s ease-in-out infinite}.ptag b{display:block;font-size:18px}.ptag.t1{top:6%;left:-4%}.ptag.t2{bottom:10%;right:-5%;animation-delay:-3s}
.prods{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:18px}.prods .card{padding:12px}.prods .pic{aspect-ratio:1;border-radius:14px;margin-bottom:12px;background:linear-gradient(135deg,hsl(var(--h) 72% 82%),hsl(calc(var(--h) + 40) 70% 64%));transition:transform .4s}.prods .card:hover .pic{transform:scale(1.04)}.prods .pr{font-weight:800;margin-top:6px}
@media(max-width:760px){.ptag.t1{left:0}.ptag.t2{right:0}}`;
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
.shine{background:linear-gradient(90deg,${p},${a},${p});background-size:200% auto;-webkit-background-clip:text;background-clip:text;color:transparent;animation:w .8s cubic-bezier(.2,.7,.2,1) forwards,shine 6s linear infinite;animation-delay:calc(var(--w) * 70ms + 80ms),0s}@keyframes shine{to{background-position:200% center}}
.marquee{overflow:hidden;padding:24px 0;border-top:1px solid #8883;border-bottom:1px solid #8883;-webkit-mask:linear-gradient(90deg,transparent,#000 12%,#000 88%,transparent);mask:linear-gradient(90deg,transparent,#000 12%,#000 88%,transparent)}
.mq{display:flex;gap:52px;width:max-content;animation:mq 34s linear infinite}.marquee:hover .mq{animation-play-state:paused}.mq span{white-space:nowrap;font-weight:600;font-size:18px;display:flex;align-items:center;gap:14px}.mq span::before{content:"✦";color:${a}}@keyframes mq{to{transform:translateX(-50%)}}
.stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:24px;text-align:center}.stats b{display:block;font-size:clamp(36px,5vw,56px);letter-spacing:-.03em;line-height:1.05}.stats span{opacity:.7}.band{padding:56px 0}
.beam{position:relative;border-radius:22px;padding:2px;background:conic-gradient(from var(--ang),transparent 0 72%,${p} 84%,${a} 92%,transparent 100%);animation:beam 6s linear infinite}.beam>.mock{border-radius:20px;margin:0!important;max-width:none}@property --ang{syntax:"<angle>";inherits:false;initial-value:0deg}@keyframes beam{to{--ang:360deg}}
.spot{position:relative;overflow:hidden}.spot::after{content:"";position:absolute;inset:0;border-radius:inherit;background:radial-gradient(280px circle at var(--mx,50%) var(--my,-60%),${p}2e,transparent 70%);opacity:0;transition:opacity .3s;pointer-events:none}.spot:hover::after{opacity:1}
.gridbg::before{content:"";position:absolute;inset:0;z-index:-1;background-image:linear-gradient(#8882 1px,transparent 1px),linear-gradient(90deg,#8882 1px,transparent 1px);background-size:46px 46px;-webkit-mask:radial-gradient(ellipse 70% 60% at 50% 0%,#000 35%,transparent 80%);mask:radial-gradient(ellipse 70% 60% at 50% 0%,#000 35%,transparent 80%)}
@media(prefers-reduced-motion:reduce){*,*::before,*::after{animation:none!important;transition:none!important}.w,.fade-in{opacity:1;transform:none}.chart .l{stroke-dashoffset:0}.chart .f,.shine{opacity:1}}`;
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
  return styleCss(cfg.style, p, a) + layoutCss(landing.layout, p, a) + motionCss(cfg.style, p, a) + fontCss + designCss;
}

/** Feuilles de polices à charger (police choisie + police de titres du style Luxe). */
const fontLinks = (cfg: Config) =>
  [...new Set([policeOf(cfg).url, cfg.style === "luxe" ? POLICES.elegante.url : ""].filter(Boolean))].map((u) => `<link rel="stylesheet" href="${u}">`).join("");

const ICON_PATHS = ["M4 4h7v7H4zM13 4h7v4h-7zM13 10h7v10h-7zM4 13h7v7H4z", "M5 13l4 4L19 7", "M12 7v5l3 2M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z", "M4 19h16M6 16l4-5 3 3 5-7", "M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z", "M6 16V11a6 6 0 1 1 12 0v5l2 2H4zM10 20h4"];
const ic = (i: number) => `<span class="ic"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${ICON_PATHS[i % ICON_PATHS.length]}"/></svg></span>`;

// Apparition au défilement, chiffres qui comptent (la valeur finale est déjà écrite : sans script, rien ne manque)
// et halo qui suit la souris sur les cartes « .spot ».
const REVEAL_SCRIPT = `<script>(function(){var d=document.documentElement;if(!("IntersectionObserver" in window)||matchMedia("(prefers-reduced-motion: reduce)").matches)return;d.classList.add("js");
function count(el){var to=parseFloat(el.getAttribute("data-to"))||0,u=el.getAttribute("data-u")||"",t0=null,dec=to%1!==0;function f(t){if(!t0)t0=t;var k=Math.min(1,(t-t0)/1400),v=to*(1-Math.pow(1-k,3));el.textContent=(dec?v.toFixed(1).replace(".",","):Math.round(v).toLocaleString("fr-FR"))+u;if(k<1)requestAnimationFrame(f)}requestAnimationFrame(f)}
var io=new IntersectionObserver(function(es){es.forEach(function(e){if(e.isIntersecting){e.target.classList.add("in");if(e.target.hasAttribute("data-to"))count(e.target);io.unobserve(e.target)}})},{rootMargin:"0px 0px -8% 0px"});document.querySelectorAll(".rv,.tick").forEach(function(el){io.observe(el)});
document.querySelectorAll(".spot").forEach(function(c){c.addEventListener("pointermove",function(e){var r=c.getBoundingClientRect();c.style.setProperty("--mx",e.clientX-r.left+"px");c.style.setProperty("--my",e.clientY-r.top+"px")})})})();</script>`;

// Miniature de galerie : la page défile seule, lentement, pour montrer les animations au défilement
// (pause en bas, retour en haut, et on recommence). Jamais sur un vrai site, ni si l'utilisateur réduit les animations.
const DEMO_SCROLL = `<script>(function(){if(matchMedia("(prefers-reduced-motion: reduce)").matches)return;var d=document.documentElement,y=0,pause=150;d.style.scrollBehavior="auto";
function f(){var max=d.scrollHeight-innerHeight;if(pause>0)pause--;else{y+=2.2;if(y>=max){y=0;pause=150;scrollTo(0,max);requestAnimationFrame(function(){setTimeout(function(){scrollTo(0,0);requestAnimationFrame(f)},1800)});return}scrollTo(0,y)}requestAnimationFrame(f)}
addEventListener("load",function(){setTimeout(function(){requestAnimationFrame(f)},900)})})();</script>`;

/** Corps HTML de la landing. `inlineCss` = un seul fichier (aperçu) ; sinon lien vers style.css (export). */
/** Liste d'attente : `action` = URL d'envoi du formulaire (null = aperçu, rien n'est envoyé). */
export type WaitlistOpts = { action: string | null; merci?: boolean; erreur?: boolean; appHref?: string };

export function renderLanding(cfg: Config, landing: Landing, pricing: Pricing | null, opts: { inlineCss: boolean; waitlist?: WaitlistOpts; contenu?: Contenu; demoScroll?: boolean }): string {
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
  const L = landing.layout;
  // Titre mot par mot ; en grille animée et tableau de bord, les deux derniers mots passent en dégradé animé.
  const words = (s: string) => {
    const ws = s.split(" ");
    const brillants = L === "bento" || L === "dashboard" ? Math.min(2, ws.length - 1) : 0;
    return ws.map((w, i) => `<span class="w${i >= ws.length - brillants ? " shine" : ""}" style="--w:${i}">${esc(w)}</span>`).join(" ");
  };
  const fmt = (v: number) => v.toLocaleString("fr-FR");
  /** Chiffre qui compte jusqu'à sa valeur (la valeur finale est écrite d'avance). */
  const tick = (v: number, u: string) => `<b class="tick" data-to="${esc(v)}" data-u="${esc(u)}">${esc(fmt(v))}${esc(u)}</b>`;
  const stats = `<section class="band"><div class="wrap stats">${demo.kpis.map(([l, v, u], i) => `<div class="rv" style="--i:${i}">${tick(v, u)}<span>${esc(l)}</span></div>`).join("")}</div></section>`;
  const avantages = landing.sections.find((x) => x.type === "avantages" && x.visible)?.items.map((x) => x.titre).filter(Boolean) ?? [];
  const bandeau = avantages.length ? `<div class="marquee" aria-hidden="true"><div class="mq">${[...avantages, ...avantages].map((x) => `<span>${esc(x)}</span>`).join("")}</div></div>` : "";
  // Courbe de l'aperçu « tableau de bord » : toujours la même (déterministe), elle se dessine à l'ouverture.
  const chart = `<div class="chart" aria-hidden="true"><svg viewBox="0 0 600 120" preserveAspectRatio="none"><defs><linearGradient id="lg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${esc(cfg.couleurs.primaire)}" stop-opacity=".28"/><stop offset="1" stop-color="${esc(cfg.couleurs.primaire)}" stop-opacity="0"/></linearGradient></defs><path class="f" fill="url(#lg)" d="M0 96 C60 90 90 70 150 74 S240 40 300 52 S400 20 460 30 S560 8 600 12 L600 120 L0 120Z"/><path class="l" d="M0 96 C60 90 90 70 150 74 S240 40 300 52 S400 20 460 30 S560 8 600 12"/></svg></div>`;
  const hue = (i: number) => (i * 47 + 12) % 360;

  const offres = pricing?.offres.length ? pricing.offres : [{ id: "x", nom: "Offre", prix: cfg.prix, periode: "mois" as const, features: [] }];

  const body = landing.sections.filter((s) => s.visible).map((s) => {
    switch (s.type) {
      case "hero": {
        const actions = wl
          ? `<div class="fade-in">${form("inscription")}${wl.appHref ? `<a class="btn" href="${esc(wl.appHref)}" style="margin-top:12px">Voir la démo de l'application →</a>` : ""}</div>`
          : `<div class="btns fade-in"><a class="btn primary" href="#cta">${esc(landing.boutonPrincipal)}</a><a class="btn" href="#etapes">${esc(landing.boutonSecondaire)}</a></div>`;
        const text = `<h1>${words(s.titre)}</h1><p class="lead fade-in">${esc(s.texte)}</p>${actions}`;
        const orbs = `<span class="orb o1"></span><span class="orb o2"></span>`;
        const r0 = demo.rows[0], r1 = demo.rows[1];
        const visuel =
          L === "split" ? mock
          // Le faisceau a sa propre animation : l'apparition (fade-in) se fait sur un conteneur à part, sinon elle serait écrasée.
          : L === "dashboard" ? `<div class="fade-in"><div class="beam">${mock.replace("fade-in", "").replace(/<\/div><\/div><\/div>$/, `</div></div>${chart}</div>`)}</div></div>`
          : L === "prestige" ? `<div class="hstats fade-in">${demo.kpis.map(([l, v, u]) => `<div>${tick(v, u)}<span>${esc(l)}</span></div>`).join("")}</div>`
          : L === "catalogue" ? `<div class="orbit fade-in" aria-hidden="true"><div class="disc">${cfg.logo ? `<img src="${esc(cfg.logo)}" alt="">` : esc(cfg.initiales)}</div>${r0 ? `<span class="ptag t1"><b>${esc(r0[0])}</b>${esc(r0[1])}</span>` : ""}${r1 ? `<span class="ptag t2"><b>${esc(r1[0])}</b>${esc(r1[1])}</span>` : ""}</div>`
          : "";
        let hero: string;
        if (L === "bento") hero = `<section class="hero hero-bg gridbg">${orbs}<div class="wrap">${text}<div class="mock-wide fade-in"><div class="beam">${mock.replace("mock-wide fade-in", "")}</div></div></div></section>`;
        else if (L === "immersif") hero = `<section class="hero"><div class="wrap">${text}</div><span class="cue" aria-hidden="true"></span></section>`;
        else if (visuel) hero = `<section class="hero hero-bg">${orbs}<div class="wrap"><div class="split"><div>${text}</div>${visuel}</div></div></section>`;
        else hero = `<section class="hero hero-bg">${orbs}<div class="wrap">${text + mock}</div></section>`;
        // Blocs propres à chaque mise en page, juste après l'en-tête.
        const apres =
          L === "bento" ? bandeau + stats
          : L === "dashboard" ? stats + bandeau
          : L === "immersif" ? stats
          : L === "prestige" && avantages.length ? `<section style="padding-top:0"><div class="wrap quotes">${avantages.slice(0, 3).map((x, i) => `<div class="card rv" style="--i:${i}"><p>${esc(x)}</p></div>`).join("")}</div></section>`
          : L === "catalogue" ? `${bandeau}<section><div class="wrap"><h2 class="rv" style="text-align:left">Nos produits</h2><div class="prods">${demo.rows.slice(0, 4).map((r, i) => `<div class="card spot rv" style="--i:${i}"><div class="pic" style="--h:${hue(i)}"></div><h3>${esc(r[0])}</h3><p class="muted pr">${esc(r[1])}</p></div>`).join("")}</div></div></section>`
          : "";
        return hero + apres;
      }
      case "features": {
        if (L === "bento") return `<section id="features"><div class="wrap"><h2 class="rv">${esc(s.titre)}</h2>${s.texte ? `<p class="lead muted rv" style="margin:-12px auto 32px;text-align:center">${esc(s.texte)}</p>` : ""}<div class="bento">${s.items.map((x, i) => `<div class="card spot rv" style="--i:${i}">${ic(i)}<h3>${esc(x.titre)}</h3><p class="muted">${esc(x.texte)}</p></div>`).join("")}</div></div></section>`;
        if (L === "dashboard") return `<section id="features"><div class="wrap"><h2 class="rv">${esc(s.titre)}</h2><div class="rows">${s.items.map((x, i) => `<div class="row rv" style="--i:0"><div><h3>${esc(x.titre)}</h3><p class="lead muted">${esc(x.texte)}</p></div><div class="viz">${ic(i)}</div></div>`).join("")}</div></div></section>`;
        if (L === "prestige") return `<section id="features"><div class="wrap"><h2 class="rv">${esc(s.titre)}</h2><div class="svc">${s.items.map((x, i) => `<div class="card rv" style="--i:${i}"><span class="no">${String(i + 1).padStart(2, "0")}</span><h3>${esc(x.titre)}</h3><p class="muted">${esc(x.texte)}</p></div>`).join("")}</div></div></section>`;
        if (L === "immersif") return `<section id="features"><div class="wrap"><h2 class="rv">${esc(s.titre)}</h2><div class="panels">${s.items.map((x, i) => `<div class="card rv" style="--i:0"><div class="pic" style="--h:${hue(i)}">${ic(i)}</div><div class="txt"><h3>${esc(x.titre)}</h3><p class="lead muted">${esc(x.texte)}</p></div></div>`).join("")}</div></div></section>`;
        if (RICHE.has(L)) return `<section id="features"><div class="wrap"><h2 class="rv">${esc(s.titre)}</h2><div class="grid">${s.items.map((x, i) => `<div class="card spot rv" style="--i:${i}">${ic(i)}<h3>${esc(x.titre)}</h3><p class="muted">${esc(x.texte)}</p></div>`).join("")}</div></div></section>`;
        const cards = s.items.map((x, i) => `<div class="card rv" style="--i:${i}">${landing.layout === "split" ? `${ic(i)}<div>` : ic(i)}<h3>${esc(x.titre)}</h3><p class="muted">${esc(x.texte)}</p>${landing.layout === "split" ? "</div>" : ""}</div>`).join("");
        return `<section id="features"><div class="wrap ed"><h2 class="rv">${num()}${esc(s.titre)}</h2>${s.texte ? `<p class="lead muted rv" style="margin:-12px 0 28px">${esc(s.texte)}</p>` : ""}<div class="${landing.layout === "split" ? "feat-rows" : "grid"}">${cards}</div></div></section>`;
      }
      case "etapes":
        return `<section id="etapes" class="tint"><div class="wrap ed"><h2 class="rv">${num()}${esc(s.titre)}</h2><div class="grid">${s.items.map((x, i) => `<div class="card rv" style="--i:${i}"><div class="price" style="font-size:28px">${i + 1}.</div><h3>${esc(x.titre)}</h3><p class="muted">${esc(x.texte)}</p></div>`).join("")}</div></div></section>`;
      case "avantages":
        // Déjà montrés juste après l'en-tête (bandeau défilant ou citations).
        if (L === "bento" || L === "dashboard" || L === "catalogue" || (L === "prestige" && s.items.length)) return "";
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
${foot}${REVEAL_SCRIPT}${opts.demoScroll ? DEMO_SCROLL : ""}</body></html>`;
}

/** Texte brut de la landing, pour le bouton « Copier le texte ». */
export function landingText(landing: Landing): string {
  return landing.sections.filter((s) => s.visible).map((s) => [s.titre, s.texte, ...s.items.map((i) => (i.texte ? `- ${i.titre} : ${i.texte}` : `- ${i.titre}`))].filter(Boolean).join("\n")).join("\n\n");
}
