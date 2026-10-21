// Signature visuelle de chaque design, au-delà des couleurs : fonds, cartes, boutons, champs,
// tableaux, titres et espacements. Une feuille pour l'application (prototype) et une pour la page de vente.
// Les feuilles s'ajoutent après celles du style : à spécificité égale, elles l'emportent.

/** Application (prototype). Variables disponibles : --p, --a, --bg, --sf, --sf2, --ink, --mut, --ln, --r. */
export const PROTO_DESIGN_CSS: Record<string, string> = {
  aurora: `body{background:radial-gradient(1100px 480px at 100% -10%,color-mix(in srgb,var(--p) 11%,transparent),transparent 62%),radial-gradient(900px 420px at -10% 0%,color-mix(in srgb,var(--a) 8%,transparent),transparent 60%),var(--bg)}
.card{background:color-mix(in srgb,var(--sf) 86%,transparent);backdrop-filter:blur(8px)}.side{background:color-mix(in srgb,var(--sf) 78%,transparent);backdrop-filter:blur(12px)}
.b.primary{background:linear-gradient(135deg,var(--p),color-mix(in srgb,var(--p) 55%,var(--a)));border-color:transparent}
input,select{background:var(--sf2);border-color:transparent}h1{font-weight:750}`,

  neon: `body{background-image:linear-gradient(color-mix(in srgb,var(--p) 7%,transparent) 1px,transparent 1px),linear-gradient(90deg,color-mix(in srgb,var(--p) 7%,transparent) 1px,transparent 1px);background-size:44px 44px}
.card{position:relative;background:linear-gradient(180deg,color-mix(in srgb,var(--p) 7%,var(--sf)),var(--sf))}
.card:not(.flush)::before{content:"";position:absolute;left:18px;right:18px;top:-1px;height:1px;background:linear-gradient(90deg,transparent,var(--p),transparent);pointer-events:none}
.b{text-transform:uppercase;letter-spacing:.09em;font-size:12px}h1{letter-spacing:.005em}
input,select{background:#070917;border:1px solid color-mix(in srgb,var(--p) 32%,transparent)}input:focus,select:focus{box-shadow:0 0 0 3px color-mix(in srgb,var(--p) 30%,transparent),0 0 26px -4px var(--p)}
.bdg{background:transparent!important;border:1px solid currentColor}th{background:transparent;color:var(--p)}`,

  pastel: `body{background:radial-gradient(620px 420px at 92% 6%,color-mix(in srgb,var(--a) 15%,transparent),transparent 70%),radial-gradient(520px 420px at 6% 96%,color-mix(in srgb,var(--p) 13%,transparent),transparent 70%),var(--bg);background-attachment:fixed}
.card{border:0;padding:22px}.kpis .card:nth-child(3n+1),.gridc .card:nth-child(3n+1){background:color-mix(in srgb,var(--p) 9%,var(--sf))}.kpis .card:nth-child(3n+2),.gridc .card:nth-child(3n+2){background:color-mix(in srgb,var(--a) 10%,var(--sf))}
input,select{border-radius:99px;padding:11px 16px}main{padding:32px}h1{font-weight:800}th{background:transparent}`,

  maison: `.card{background:transparent;border:0;border-top:1px solid var(--ln);border-radius:0;box-shadow:none;padding:22px 2px}.card.flush{border:1px solid var(--ln);background:var(--sf)}
input,select{border:0;border-bottom:1px solid var(--ink);border-radius:0;background:transparent;padding-left:0}input:focus,select:focus{box-shadow:none;border-color:var(--p)}
.b{border-radius:0;text-transform:uppercase;letter-spacing:.15em;font-size:11.5px;padding:11px 18px}
h1{font-size:36px}main{padding:46px 52px}.ph{border-bottom:1px solid var(--ink);padding-bottom:18px;margin-bottom:28px}
th{font-family:"Playfair Display",Georgia,serif;font-style:italic;text-transform:none;letter-spacing:0;font-size:14px;background:transparent}`,

  brutal: `body{background-image:radial-gradient(color-mix(in srgb,var(--ink) 22%,transparent) 1px,transparent 1px);background-size:22px 22px;background-color:var(--bg)}
.card{border:2.5px solid var(--ink);box-shadow:5px 5px 0 var(--ink);border-radius:6px}.card:hover{transform:translate(-2px,-2px);box-shadow:7px 7px 0 var(--ink)}
input,select{border:2.5px solid var(--ink);border-radius:4px;box-shadow:3px 3px 0 var(--ink)}input:focus,select:focus{box-shadow:3px 3px 0 var(--p)}
th{background:var(--ink);color:var(--bg)}.chip{border:2px solid var(--ink);border-radius:4px}.side{border-right:3px solid var(--ink)}
h1:not(.hero-t){background:linear-gradient(transparent 58%,var(--a) 58%);display:inline}`,

  papier: `body{background:repeating-linear-gradient(var(--bg) 0 31px,color-mix(in srgb,var(--ink) 5%,transparent) 31px 32px)}
.card{box-shadow:none;border:1px solid var(--ink);border-radius:2px;padding:14px}main{padding:20px 24px}
td,th{padding:8px 12px}th{background:var(--ink);color:var(--bg)}.b{border-radius:2px;padding:7px 12px;font-size:13px}
input,select{border-radius:2px;padding:7px 10px}.kpis{gap:0}.kpis .card{margin-left:-1px}
h1{font-size:21px;text-transform:uppercase;letter-spacing:.07em}.big{font-size:24px}`,

  ocean: `body{background:linear-gradient(180deg,color-mix(in srgb,var(--p) 13%,var(--bg)) 0,var(--bg) 380px)}
main{padding:40px 44px;max-width:1240px}.card{border-radius:22px;border:1px solid color-mix(in srgb,var(--p) 15%,transparent);box-shadow:0 20px 40px -32px var(--p);padding:24px}
.b{border-radius:14px}.b.primary{background:linear-gradient(120deg,var(--p),var(--a));border-color:transparent}
input,select{border-radius:14px;background:color-mix(in srgb,var(--p) 5%,var(--sf))}h1{font-weight:500;font-size:30px;letter-spacing:-.035em}.kpis{gap:20px}`,

  sunset: `body{background:linear-gradient(160deg,color-mix(in srgb,var(--a) 8%,var(--bg)),color-mix(in srgb,var(--p) 10%,var(--bg)));background-attachment:fixed}
.card{background:linear-gradient(90deg,var(--p),var(--a)) top/100% 4px no-repeat,var(--sf);border:0;border-radius:18px}.card.flush{background:var(--sf)}
.b{border-radius:99px}.b.primary{background:linear-gradient(120deg,var(--p),var(--a));border-color:transparent}
input,select{border-radius:12px;border-color:color-mix(in srgb,var(--p) 26%,transparent)}h1{font-weight:800}`,

  terminal: `.card,.b,input,select,.chip,.side a,.search,.bdg,.mark,.thumb,.slot,.toggle,.toggle button,.col{border-radius:0!important}
.b::before{content:"[ ";opacity:.6}.b::after{content:" ]";opacity:.6}h1::before{content:"> ";color:var(--p)}
.card{border:1px solid color-mix(in srgb,var(--p) 40%,transparent);box-shadow:none;background:color-mix(in srgb,var(--p) 3%,var(--sf))}
input,select{background:transparent;border:0;border-bottom:1px dashed var(--p);color:var(--p)}input:focus,select:focus{box-shadow:none;border-bottom-style:solid}
body::after{content:"";position:fixed;inset:0;pointer-events:none;background:repeating-linear-gradient(0deg,rgba(0,0,0,.16) 0 1px,transparent 1px 3px);z-index:100}`,

  bento: `.card{border:0;border-radius:26px;box-shadow:0 1px 0 rgba(0,0,0,.04),0 12px 30px -22px rgba(15,23,42,.35)}
.kpis .card:nth-child(1){background:var(--p);color:#fff}.kpis .card:nth-child(1) .mut{color:rgba(255,255,255,.78)}.kpis .card:nth-child(2){background:color-mix(in srgb,var(--a) 22%,var(--sf))}
main{padding:24px}.b{border-radius:14px}input,select{border-radius:14px;border-color:transparent;background:var(--sf2)}h1{font-weight:800;letter-spacing:-.045em}`,
};

/** Page de vente. Reçoit les couleurs primaire et accent. */
export const LANDING_DESIGN_CSS: Record<string, (p: string, a: string) => string> = {
  aurora: (p, a) => `.hero-bg{background:radial-gradient(70% 70% at 15% 0%,${p}30,transparent 70%),radial-gradient(60% 60% at 90% 10%,${a}26,transparent 70%)}.card{background:rgba(255,255,255,.72);backdrop-filter:blur(10px)}.btn.primary{background:linear-gradient(135deg,${p},${a})}`,
  neon: (p) => `body{background-image:linear-gradient(${p}12 1px,transparent 1px),linear-gradient(90deg,${p}12 1px,transparent 1px);background-size:48px 48px}.card{position:relative}.card::before{content:"";position:absolute;left:20px;right:20px;top:-1px;height:1px;background:linear-gradient(90deg,transparent,${p},transparent)}.btn{text-transform:uppercase;letter-spacing:.1em;font-size:13px}h2{letter-spacing:.01em}`,
  pastel: (p, a) => `body{background:radial-gradient(600px 420px at 90% 5%,${a}22,transparent 70%),radial-gradient(520px 420px at 5% 60%,${p}1c,transparent 70%),#fbf7ff}.card{border:0}.grid .card:nth-child(3n+1){background:${p}14}.grid .card:nth-child(3n+2){background:${a}16}section{padding:88px 0}`,
  maison: (p) => `.hero h1{font-size:clamp(46px,7vw,86px)}.card{border:0;border-top:1px solid #1c1917;border-radius:0;box-shadow:none;background:transparent;padding:22px 2px 0}.card:hover{transform:none;box-shadow:none}section:not(.hero) .lead::first-letter{font-family:"Playfair Display",Georgia,serif;font-size:3.1em;float:left;line-height:.9;margin:4px 10px 0 0;color:${p}}section{padding:100px 0}.top{border-bottom:1px solid #1c1917}.mock{border-radius:0}`,
  brutal: (p, a) => `body{background-image:radial-gradient(#0b0b0b33 1px,transparent 1px);background-size:22px 22px}h1 .w:last-child{background:linear-gradient(transparent 58%,${a} 58%)}.card:nth-child(even){transform:rotate(.6deg)}.card:nth-child(odd){transform:rotate(-.5deg)}.wl input[type=email]{border:3px solid #0b0b0b;border-radius:0;box-shadow:4px 4px 0 #0b0b0b}.tint{background:${p}}`,
  papier: () => `body{background:repeating-linear-gradient(#fff 0 31px,#0000000d 31px 32px)}.card{border:1px solid #111;border-top:1px solid #111;padding:18px;background:#fff}section{padding:56px 0}h2{font-family:system-ui,sans-serif;font-size:15px;text-transform:uppercase;letter-spacing:.14em;font-weight:700}.btn{border-radius:0}`,
  ocean: (p, a) => `.hero{clip-path:ellipse(150% 100% at 50% 0);padding-bottom:120px}.hero-bg{background:linear-gradient(180deg,${p}26,${a}10 70%,transparent)}.card{border-radius:24px}.btn{border-radius:16px}.btn.primary{background:linear-gradient(120deg,${p},${a})}section{padding:96px 0}`,
  sunset: (p, a) => `.hero-bg{background:linear-gradient(160deg,${a}26,${p}30 60%,transparent)}.card{background:linear-gradient(90deg,${p},${a}) top/100% 5px no-repeat,#fff;border:0}.btn{border-radius:99px}.btn.primary{background:linear-gradient(120deg,${p},${a})}.tint{background:linear-gradient(160deg,${p}10,${a}14)}`,
  terminal: (p) => `body,.btn,h1,h2{font-family:"JetBrains Mono",ui-monospace,monospace!important}.btn,.card,.mock,.mark,.wl input[type=email]{border-radius:0!important}.btn::before{content:"[ "}.btn::after{content:" ]"}h1::before{content:"> ";color:${p}}.card{border:1px solid ${p}55;background:transparent}body::after{content:"";position:fixed;inset:0;pointer-events:none;background:repeating-linear-gradient(0deg,rgba(0,0,0,.18) 0 1px,transparent 1px 3px)}`,
  bento: (p, a) => `.grid{grid-auto-flow:dense}.grid .card{border:0;border-radius:28px;box-shadow:0 14px 34px -24px rgba(15,23,42,.4)}.grid .card:first-child{grid-column:span 2;background:${p};color:#fff}.grid .card:first-child .muted{color:rgba(255,255,255,.8)}.grid .card:nth-child(4){background:${a}26}@media(max-width:760px){.grid .card:first-child{grid-column:auto}}`,
};
