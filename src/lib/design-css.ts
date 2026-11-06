// Signature visuelle de chaque design, au-delà des couleurs : fonds, cartes, boutons, champs,
// tableaux, titres et espacements. Une feuille pour l'application (prototype) et une pour la page de vente.
// Les feuilles s'ajoutent après celles du style : à spécificité égale, elles l'emportent.
// Les designs de boutique soignent aussi la vitrine (.store-h, .store-sub) et les fiches produits (.prod, .prod-img).
// Clés : identifiants actuels des designs (un ancien identifiant passe par designId()).

/** Application (prototype). Variables disponibles : --p, --a, --bg, --sf, --sf2, --ink, --mut, --ln, --r. */
export const PROTO_DESIGN_CSS: Record<string, string> = {
  // ── SaaS ──
  clarte: `body{background:linear-gradient(180deg,color-mix(in srgb,var(--p) 6%,var(--bg)),var(--bg) 260px)}
.card{border:1px solid color-mix(in srgb,var(--ink) 9%,transparent);border-radius:12px;box-shadow:0 1px 2px rgba(15,23,42,.05)}.card:hover{box-shadow:0 1px 2px rgba(15,23,42,.05),0 10px 26px -18px rgba(15,23,42,.3)}
.side{background:var(--sf);border-right:1px solid color-mix(in srgb,var(--ink) 8%,transparent)}.side a.on{background:color-mix(in srgb,var(--p) 9%,transparent);color:var(--p)}
.b{border-radius:9px;font-weight:600}.b.primary{background:var(--p);border-color:transparent;box-shadow:inset 0 1px 0 rgba(255,255,255,.22),0 1px 2px color-mix(in srgb,var(--p) 50%,transparent)}
input,select{border-radius:9px;border:1px solid color-mix(in srgb,var(--ink) 14%,transparent)}input:focus,select:focus{border-color:var(--p);box-shadow:0 0 0 3px color-mix(in srgb,var(--p) 18%,transparent)}
h1{font-weight:700;letter-spacing:-.025em}th{background:transparent;font-size:11.5px;letter-spacing:.06em;text-transform:uppercase;color:var(--mut)}.bdg{border-radius:6px}`,

  minuit: `html{--bg:#07070b;--sf:#101016;--sf2:#16161f;--ink:#ededf3;--mut:#9a9ab0;--ln:rgba(255,255,255,.08)}
body{background:radial-gradient(820px 380px at 50% -150px,color-mix(in srgb,var(--p) 32%,transparent),transparent 70%),var(--bg)}
h1{text-shadow:none;letter-spacing:-.03em;font-weight:650}
.card{background:linear-gradient(180deg,rgba(255,255,255,.045),rgba(255,255,255,.015));border:1px solid rgba(255,255,255,.08);box-shadow:inset 0 1px 0 rgba(255,255,255,.06);backdrop-filter:blur(14px)}.card:hover{border-color:color-mix(in srgb,var(--p) 40%,transparent)}
.b{border-radius:10px}.b.primary{background:linear-gradient(180deg,#fff,#d9d9e3);color:#0a0a0f;border-color:transparent;box-shadow:0 0 0 1px rgba(255,255,255,.2),0 8px 30px -10px var(--p)}
input,select{background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.1)}input:focus,select:focus{border-color:var(--p);box-shadow:0 0 0 3px color-mix(in srgb,var(--p) 25%,transparent)}
th{background:transparent;color:var(--mut)}.side a.on{background:rgba(255,255,255,.06);box-shadow:none}`,

  studio: `.card{background:var(--sf);border:1px solid var(--ln);border-radius:0;box-shadow:none;padding:24px}
.kpis .card{border:0;border-top:2px solid var(--ink);background:transparent;padding:18px 2px}
input,select{border:0;border-bottom:1px solid color-mix(in srgb,var(--ink) 40%,transparent);border-radius:0;background:transparent;padding-left:0}input:focus,select:focus{box-shadow:none;border-color:var(--p)}
.b{border-radius:0;letter-spacing:.12em;text-transform:uppercase;font-size:11.5px;padding:11px 20px}.b.primary{background:var(--ink);border-color:var(--ink)}
h1{font-size:38px;font-weight:400;letter-spacing:-.01em}main{padding:48px 56px}.ph{border-bottom:1px solid var(--ink);padding-bottom:18px;margin-bottom:30px}
th{font-family:"Playfair Display",Georgia,serif;font-style:italic;text-transform:none;letter-spacing:0;font-size:14px;background:transparent}.big{font-weight:400}`,

  pop: `.card{border:2.5px solid var(--ink);border-radius:14px;box-shadow:6px 6px 0 var(--ink)}.card:hover{transform:translate(-2px,-2px);box-shadow:8px 8px 0 var(--ink)}
.kpis .card:nth-child(4n+1){background:color-mix(in srgb,var(--a) 70%,#fff)}.kpis .card:nth-child(4n+2){background:color-mix(in srgb,var(--p) 14%,#fff)}.kpis .card:nth-child(4n+3){background:#ffd6e7}
.b{border:2.5px solid var(--ink);border-radius:999px;font-weight:800}.b.primary{background:var(--p);color:#fff;box-shadow:3px 3px 0 var(--ink)}
input,select{border:2.5px solid var(--ink);border-radius:12px}input:focus,select:focus{box-shadow:3px 3px 0 var(--p)}
th{background:var(--ink);color:#fff}.side{border-right:2.5px solid var(--ink)}.side a.on{background:var(--a);color:var(--ink);box-shadow:inset 0 0 0 2px var(--ink)}
.bdg,.chip{border:2px solid var(--ink)}h1{font-weight:900;letter-spacing:-.04em}`,

  zen: `.card{border:0;border-bottom:1px solid var(--ln);border-radius:0;box-shadow:none;padding:16px 0;background:transparent}.card.flush{border:1px solid var(--ln);border-radius:6px;background:var(--sf)}
.kpis{gap:32px}.big{font-family:inherit;font-weight:500;font-variant-numeric:tabular-nums;letter-spacing:-.02em}
.b{border-radius:6px;font-weight:500}.b.primary{background:var(--ink);border-color:var(--ink)}input,select{border-radius:6px}
h1{font-family:inherit;font-weight:600;font-size:22px;letter-spacing:-.01em}main{padding:36px 44px;max-width:1100px}
th{background:transparent;color:var(--mut);font-weight:500;border-bottom:1px solid var(--ink)}td{font-variant-numeric:tabular-nums}.mark{background:var(--p)}`,

  flux: `body{background:linear-gradient(160deg,color-mix(in srgb,var(--p) 10%,var(--bg)) 0,var(--bg) 420px)}
main{padding:36px 40px}.card{border:0;border-radius:24px;padding:24px;box-shadow:0 1px 0 rgba(2,132,199,.05),0 18px 40px -28px color-mix(in srgb,var(--p) 70%,transparent)}
.kpis .card:first-child{background:linear-gradient(135deg,var(--p),var(--a));color:#fff}.kpis .card:first-child .mut{color:rgba(255,255,255,.85)}
.b{border-radius:999px;padding-inline:18px}.b.primary{background:linear-gradient(120deg,var(--p),var(--a));border-color:transparent}
input,select{border-radius:14px;background:color-mix(in srgb,var(--p) 5%,var(--sf));border-color:transparent}
h1{font-weight:800;letter-spacing:-.03em}.side a.on{background:color-mix(in srgb,var(--p) 12%,transparent);color:var(--p);border-radius:999px}`,

  douceur: `body{background:radial-gradient(560px 380px at 95% 0%,color-mix(in srgb,var(--a) 18%,transparent),transparent 70%),radial-gradient(520px 400px at 0% 100%,color-mix(in srgb,var(--p) 14%,transparent),transparent 70%),var(--bg);background-attachment:fixed}
.card{border:0;border-radius:28px;padding:22px;box-shadow:0 10px 30px -20px color-mix(in srgb,var(--p) 55%,transparent)}
.kpis .card:nth-child(3n+1){background:color-mix(in srgb,var(--p) 10%,#fff)}.kpis .card:nth-child(3n+2){background:color-mix(in srgb,var(--a) 12%,#fff)}.kpis .card:nth-child(3n){background:color-mix(in srgb,#facc15 14%,#fff)}
.b{border-radius:999px;font-weight:700}.b.primary{background:var(--p);box-shadow:0 8px 20px -10px var(--p)}
input,select{border-radius:999px;padding:11px 16px;border-color:transparent;background:var(--sf2)}h1{font-weight:800}th{background:transparent}`,

  console: `html{--bg:#0b0f0c;--sf:#0f1511;--sf2:#141c16;--ink:#d7f5dd;--mut:#7f9c86;--ln:rgba(34,197,94,.16)}
.card,.b,input,select,.chip,.side a,.search,.bdg,.mark,.thumb,.slot,.toggle,.toggle button,.col{border-radius:0!important}
h1{text-shadow:none}h1::before{content:"$ ";color:var(--p)}.b::before{content:"[ ";opacity:.55}.b::after{content:" ]";opacity:.55}
.card{border:1px solid var(--ln);box-shadow:none;background:var(--sf)}.b.primary{background:var(--p);color:#03130a;box-shadow:none}
input,select{background:transparent;border:0;border-bottom:1px dashed var(--p);color:var(--p)}input:focus,select:focus{box-shadow:none;border-bottom-style:solid}
th{background:transparent;color:var(--p)}`,

  // ── Boutiques en ligne ──
  vitrine: `body{background:#fff}.card{border:1px solid #eceef1;border-radius:16px;box-shadow:none}
.prod{border:0;padding:0;background:transparent;gap:10px}.prod-img{height:220px;border-radius:18px;transition:transform .35s}.prod:hover .prod-img{transform:scale(1.02)}
.b{border-radius:999px;font-weight:600}.b.primary{background:var(--p);border-color:var(--p);color:#fff}
.store-h{border-bottom:1px solid #eceef1}.store-sub a.on{color:var(--p);box-shadow:inset 0 -2px 0 var(--p)}
input,select{border-radius:12px;border-color:#e5e7eb}h1{font-weight:700;letter-spacing:-.03em}.bdg{border-radius:999px}th{background:transparent}`,

  atelier: `html{--bg:#f6efe4;--sf:#fffaf2;--sf2:#efe4d3;--ln:rgba(76,45,25,.14)}
.card{border:1px solid var(--ln);border-radius:4px;box-shadow:none;background:var(--sf)}
.prod{padding:10px;border-radius:4px;background:var(--sf)}.prod-img{height:200px;border-radius:2px;filter:sepia(.25) saturate(.8)}
.b{border-radius:2px;letter-spacing:.1em;text-transform:uppercase;font-size:11.5px}.b.primary{background:var(--p);border-color:var(--p);color:#fffaf2}
input,select{border-radius:2px;background:#fffdf8}h1{font-weight:500;font-size:34px}.store-sub a.on{color:var(--p);box-shadow:inset 0 -2px 0 var(--p)}
th{font-family:"Playfair Display",Georgia,serif;font-style:italic;text-transform:none;letter-spacing:0;background:transparent}.mark{background:var(--p)}`,

  marche: `html{--bg:#f7fbf3;--sf:#ffffff;--sf2:#eef6e8;--ln:rgba(21,128,61,.14)}
body{background:radial-gradient(520px 360px at 100% 0,color-mix(in srgb,var(--a) 20%,transparent),transparent 70%),var(--bg)}
.card{border:0;border-radius:24px;box-shadow:0 10px 26px -20px rgba(21,128,61,.55)}
.prod{border:0;border-radius:24px;padding:12px;box-shadow:0 10px 26px -20px rgba(21,128,61,.5)}.prod-img{height:170px;border-radius:18px}
.b{border-radius:999px;font-weight:800}.b.primary{background:var(--p);color:#fff}
input,select{border-radius:999px;background:var(--sf2);border-color:transparent}h1{font-weight:900;letter-spacing:-.02em}
.store-sub a.on{background:color-mix(in srgb,var(--p) 12%,transparent);color:var(--p);border-radius:999px;box-shadow:none}`,

  ecrin: `html{--bg:#0c0b09;--sf:#141210;--sf2:#1b1815;--ink:#f3ece0;--mut:#a89f90;--ln:rgba(212,175,55,.18)}
h1{text-shadow:none;font-weight:400;letter-spacing:.01em}.card{background:var(--sf);border:1px solid var(--ln);border-radius:0;box-shadow:none}
.b{border-radius:0;letter-spacing:.18em;text-transform:uppercase;font-size:11px;padding:12px 22px}.b.primary{background:var(--p);color:#0c0b09;box-shadow:none;border-color:var(--p)}
.prod{background:transparent;border:0;padding:0}.prod-img{height:240px;border-radius:0;filter:saturate(.35) contrast(1.05)}
input,select{background:transparent;border:0;border-bottom:1px solid var(--ln);border-radius:0}input:focus,select:focus{box-shadow:none;border-color:var(--p)}
th{background:transparent;color:var(--p);letter-spacing:.14em}.store-sub a.on{color:var(--p);box-shadow:inset 0 -1px 0 var(--p)}.hero-t{background:none;color:var(--p)}`,

  street: `body{background:#f4f4f0}.card{border:3px solid #111;border-radius:0;box-shadow:6px 6px 0 #111}
.prod{border:3px solid #111;border-radius:0;box-shadow:6px 6px 0 #111;background:#fff}.prod-img{height:210px;border-radius:0;border:2px solid #111}
.prod:nth-child(odd){transform:rotate(-.6deg)}.prod:nth-child(even){transform:rotate(.5deg)}
.b{border:3px solid #111;border-radius:0;font-weight:900;text-transform:uppercase}.b.primary{background:var(--a);color:#111;box-shadow:4px 4px 0 #111}
input,select{border:3px solid #111;border-radius:0}h1{font-weight:900;letter-spacing:-.05em}
th{background:#111;color:var(--a)}.side{background:#111;color:#fff}.side a{color:#ddd}.side a.on{background:var(--a);color:#111}.store-sub a.on{background:#111;color:var(--a);box-shadow:none}`,
};

/** Page de vente. Reçoit les couleurs primaire et accent. */
export const LANDING_DESIGN_CSS: Record<string, (p: string, a: string) => string> = {
  // ── SaaS ──
  clarte: (p, a) => `.hero-bg{background:linear-gradient(180deg,${p}14,transparent 75%)}.card{border:1px solid #0f172a14;border-radius:14px;box-shadow:0 1px 2px #0f172a0d}.card:hover{box-shadow:0 14px 34px -20px #0f172a55}.btn{border-radius:10px}.btn.primary{background:${p};box-shadow:inset 0 1px 0 #ffffff40,0 8px 22px -10px ${p}}h1{letter-spacing:-.04em}.mark{background:linear-gradient(135deg,${p},${a})}`,
  minuit: (p, a) => `body{background:#07070b}.hero-bg{background:radial-gradient(55% 60% at 50% -5%,${p}66,transparent 70%)}h1{text-shadow:none;letter-spacing:-.04em}.card{background:linear-gradient(180deg,#ffffff0f,#ffffff05);border:1px solid #ffffff17;box-shadow:inset 0 1px 0 #ffffff12}.btn{border-radius:10px}.btn.primary{background:linear-gradient(180deg,#fff,#d9d9e3);color:#0a0a0f;border-color:transparent;box-shadow:0 10px 40px -12px ${p}}.tint{background:#0c0c13}.mark{background:linear-gradient(135deg,${p},${a})}`,
  studio: (p) => `.hero h1{font-size:clamp(48px,7vw,92px);font-weight:400}.card{border:0;border-top:1px solid #1c1917;border-radius:0;box-shadow:none;background:transparent;padding:22px 2px 0}.card:hover{transform:none;box-shadow:none}section:not(.hero) .lead::first-letter{font-family:"Playfair Display",Georgia,serif;font-size:3.1em;float:left;line-height:.9;margin:4px 10px 0 0;color:${p}}section{padding:104px 0}.top{border-bottom:1px solid #1c1917}.mock{border-radius:0}.btn.primary{background:${p};border-color:${p}}`,
  pop: (p, a) => `body{background:#fffdf5}h1 .w:last-child{background:linear-gradient(transparent 60%,${a} 60%)}.card{border-radius:18px}.grid .card:nth-child(3n+1){background:${a}}.grid .card:nth-child(3n+2){background:#ffd6e7}.grid .card:nth-child(3n){background:${p}1f}.btn{border-radius:999px}.btn.primary{background:${p};color:#fff}.mark{border-radius:12px}.wl input[type=email]{border:3px solid #0b0b0b;border-radius:999px;box-shadow:4px 4px 0 #0b0b0b}`,
  zen: (p) => `body{background:#fff}.hero-bg{background:none}h1,h2{font-family:system-ui,-apple-system,"Segoe UI",sans-serif!important;font-weight:600}h1{letter-spacing:-.04em}h2{font-size:clamp(24px,3vw,32px)}.card{border:0;border-top:1px solid #e5e7eb;padding:20px 0 0}.btn{border-radius:8px}.btn.primary{background:#111;color:#fff}.hl{border-top:3px solid ${p}}section{padding:72px 0}.mark{background:${p};color:#fff;border:0}`,
  flux: (p, a) => `.hero-bg{background:linear-gradient(160deg,${p}26,${a}14 55%,transparent)}.hero{clip-path:ellipse(160% 100% at 50% 0);padding-bottom:110px}.card{border:0;border-radius:26px;box-shadow:0 20px 44px -30px ${p}}.btn{border-radius:999px}.btn.primary{background:linear-gradient(120deg,${p},${a})}section{padding:92px 0}.mark{border-radius:50%;background:linear-gradient(135deg,${p},${a})}`,
  douceur: (p, a) => `body{background:radial-gradient(620px 420px at 90% 0%,${a}24,transparent 70%),radial-gradient(520px 420px at 0% 50%,${p}1c,transparent 70%),#fbf7ff}.card{border:0}.grid .card:nth-child(3n+1){background:${p}14}.grid .card:nth-child(3n+2){background:${a}18}.grid .card:nth-child(3n){background:#facc1522}section{padding:88px 0}`,
  console: (p) => `body,.btn,h1,h2{font-family:"JetBrains Mono",ui-monospace,monospace!important}body{background:#0b0f0c}h1{text-shadow:none}.btn,.card,.mock,.mark,.wl input[type=email]{border-radius:0!important}.btn::before{content:"[ "}.btn::after{content:" ]"}h1::before{content:"$ ";color:${p}}.card{border:1px solid ${p}44;background:#0f1511;box-shadow:none}.btn.primary{background:${p};color:#03130a;box-shadow:none}.tint{background:#0d130f}.hero-bg{background:radial-gradient(60% 60% at 20% 0%,${p}22,transparent 70%)}`,
  // ── Boutiques en ligne ──
  vitrine: (p, a) => `body{background:#fff}.hero-bg{background:linear-gradient(180deg,#f5f5f4,transparent)}.card{border:0;border-radius:20px;background:#f5f5f4;box-shadow:none}.card:hover{transform:translateY(-4px)}.btn{border-radius:999px}.btn.primary{background:${p};color:#fff;box-shadow:none}.hl{border:2px solid ${a}}.mark{background:${p};border-radius:999px}.mock{border-radius:24px}`,
  atelier: (p, a) => `body{background:#f6efe4}.hero-bg{background:radial-gradient(55% 60% at 50% 0%,${p}22,transparent 70%)}.card{border:1px solid #4c2d1924;border-radius:4px;background:#fffaf2;padding:24px}.btn.primary{background:${p};border-color:${p};color:#fffaf2}.tint{background:#efe4d3}section:not(.hero) .lead::first-letter{font-family:"Playfair Display",Georgia,serif;font-size:2.8em;float:left;line-height:.9;margin:4px 10px 0 0;color:${a}}.mark{background:${p}}.mock{border-radius:4px}`,
  marche: (p, a) => `body{background:#f7fbf3;color:#14321d}h1,h2{color:#14321d}.lead,.muted{color:#4d6b55}.hero-bg{background:radial-gradient(55% 60% at 85% 0%,${a}40,transparent 70%),radial-gradient(50% 60% at 0% 30%,${p}22,transparent 70%)}.card{border:0;border-radius:26px;background:#fff;box-shadow:0 14px 34px -24px ${p}}.grid .card:nth-child(odd){background:${a}1f}.btn.primary{background:${p};color:#fff;box-shadow:0 12px 26px -12px ${p}}.mark{background:${a};color:#14321d}`,
  ecrin: (p) => `body{background:#0c0b09;color:#f3ece0}h1,h2{font-family:"Playfair Display",Georgia,serif;font-weight:400;letter-spacing:.005em;text-shadow:none;color:#f3ece0}.hero h1{font-size:clamp(46px,7vw,88px)}.lead,.muted{color:#a89f90}.card{background:#141210;border:1px solid ${p}33;border-radius:0;box-shadow:none}.btn{border-radius:0;letter-spacing:.18em;text-transform:uppercase;font-size:12px;border-color:${p}66;color:#f3ece0}.btn.primary{background:${p};color:#0c0b09;border-color:${p};box-shadow:none}.mark{background:${p};color:#0c0b09;border-radius:0}.tint{background:#12100d}.hero-bg{background:radial-gradient(50% 60% at 50% 0%,${p}26,transparent 70%)}.hl{border:1px solid ${p};box-shadow:none}.mock{border-radius:0;border-color:${p}44}.wl input[type=email]{background:#141210;color:#f3ece0;border-color:${p}55;border-radius:0}`,
  street: (p, a) => `body{background:#f4f4f0}h1{font-size:clamp(40px,6.5vw,80px);letter-spacing:-.045em;line-height:.95}h1 .w:last-child{background:${a};padding:0 .1em}.card{border-radius:0}.grid .card:nth-child(odd){transform:rotate(-.8deg)}.grid .card:nth-child(even){transform:rotate(.7deg)}.btn{border-radius:0}.btn.primary{background:${a};color:${p}}.mark{background:${p};color:${a}}.tint{background:${p};color:#fff}.hl{background:${a}}.wl input[type=email]{border:3px solid #111;border-radius:0;box-shadow:4px 4px 0 #111}`,
};
